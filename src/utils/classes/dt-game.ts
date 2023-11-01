import type { ChannelSettings } from '../../model/types/daruma-training.js';
import { Client } from 'discordx';
import { injectable } from 'tsyringe';

import { EmbedManager } from './dt-embedmanager.js';
import { GameState } from './dt-game-state.js';
import { Player } from './dt-player.js';
import { WaitingRoomManager } from './dt-waitingroommanager.js';
import { createEncounter } from '../../entities/dt-encounters.mongo.js';
import {
  gameNPCs,
  GameStatus,
  GameTypes,
  IGameNPC,
  RenderPhase,
  renderPhasesArray,
} from '../../enums/daruma-training.js';
import { DarumaTrainingGameRepository } from '../../repositories/dt-game-repository.js';
import { getTemporaryPayoutModifier } from '../functions/dt-boost.js';
import { phaseDelay } from '../functions/dt-utils.js';
import logger from '../functions/logger-factory.js';

/**
 * Main game class
 */
@injectable()
export class Game {
  public dtGameRepository: DarumaTrainingGameRepository;
  public waitingRoomManager: WaitingRoomManager;
  public embedManager: EmbedManager;

  public state: GameState;
  public payoutModifier: number | undefined;
  public NPC: Player | undefined;
  constructor(
    public settings: ChannelSettings,
    public gameRepoInject?: DarumaTrainingGameRepository,
    public waitingRoomManagerInject?: WaitingRoomManager,
    public embedManagerInject?: EmbedManager,
  ) {
    this.state = new GameState(this);

    this.waitingRoomManager = waitingRoomManagerInject ?? new WaitingRoomManager(this);
    this.embedManager = embedManagerInject ?? new EmbedManager();
    this.dtGameRepository = gameRepoInject ?? new DarumaTrainingGameRepository();
  }
  async initialize(client: Client): Promise<void> {
    await this.addNpc();
    await this.waitingRoomManager.initialize(client);
  }
  get getNPC(): IGameNPC | undefined {
    return gameNPCs.find((npc) => npc.gameType === this.settings.gameType);
  }
  public async addPlayer(player: Player): Promise<boolean> {
    const playerAdded = this.state.playerManager.addPlayer(player);
    await this.embedManager.updateWaitingRoomEmbed(this);
    return playerAdded;
  }
  public async removePlayer(discordId: string): Promise<boolean> {
    const playerRemoved = this.state.playerManager.removePlayer(discordId);
    await this.embedManager.updateWaitingRoomEmbed(this);
    return playerRemoved;
  }
  private async addNpc(): Promise<void> {
    this.NPC = undefined;
    if (!this.getNPC) {
      return;
    }
    const npcID = this.getNPC.assetIndex;
    try {
      this.NPC = await this.dtGameRepository.getNPCPlayer(npcID);
    } catch (error) {
      logger.error(`Could not find NPC with ID: ${npcID}`, error);
    }
    this.state = this.state.reset();
  }
  private async endGamePlayerUpdate(): Promise<void> {
    this.payoutModifier = await getTemporaryPayoutModifier();
    this.state = this.state.findZenAndWinners(undefined, this.payoutModifier);
    for (const player of this.state.playerManager.getAllPlayers()) {
      await player.userAndAssetEndGameUpdate(this.state.gameWinInfo, this.settings.coolDown);
    }
  }
  private async saveEncounter(): Promise<number> {
    await this.endGamePlayerUpdate();
    return await createEncounter(this);
  }

  async startChannelGame(): Promise<void> {
    await this.startGame();
    await this.handleGameLogic();
    await this.finishGame();
  }
  private async startGame(): Promise<void> {
    const encounterId = await this.saveEncounter();
    this.state = this.state.startGame(encounterId);
    await this.embedManager.startGame(this);
  }
  private async handleGameLogic(
    phaseDelayFunction: (
      gameType: GameTypes,
      phase: RenderPhase,
    ) => Promise<[number, number]> = phaseDelay,
  ): Promise<void> {
    try {
      const { gameType } = this.settings;
      const allPlayers = this.state.playerManager.getAllPlayers();
      while (this.state.status === GameStatus.activeGame) {
        for (const [index, player] of allPlayers.entries()) {
          this.state = this.state.setCurrentPlayer(player, index);

          for (const phase of renderPhasesArray) {
            const board = this.state.renderThisBoard(phase);
            await this.embedManager.executeGameBoardMessage(this, board);
            await phaseDelayFunction(gameType, phase);
          }
        }

        this.state = this.state.nextRoll();
      }
    } catch (error) {
      logger.error(`Error in gameHandler: ${JSON.stringify(error)}`);
      this.state = this.state.updateStatus(GameStatus.win);
    }
  }
  private async finishGame(): Promise<void> {
    await this.embedManager.finishGame(this);
  }
}
