import { TextChannel } from 'discord.js';

import { inject, injectable } from 'tsyringe';

import {
  gameNPCs,
  GameStatus,
  GameTypes,
  IGameNPC,
  RenderPhase,
  renderPhasesArray,
} from '../../enums/daruma-training.js';
import { BoostService } from '../../services/boost-payout.js';
import { DarumaTrainingEncountersService } from '../../services/dt-encounters.js';
import { DiscordId } from '../../types/core.js';
import type { ChannelSettings } from '../../types/daruma-training.js';
import { generateNPCPlayer } from '../functions/dt-npc-player.js';
import { phaseDelay } from '../functions/dt-utils.js';
import logger from '../functions/logger-factory.js';

import { EmbedManager } from './dt-embedmanager.js';
import { GameState } from './dt-game-state.js';
import { Player } from './dt-player.js';
import { WaitingRoomManager } from './dt-waitingroommanager.js';

/**
 * Main game class
 */
@injectable()
export class Game {
  private _state?: GameState;
  private _settings?: ChannelSettings;
  public payoutModifier: number | undefined;
  constructor(
    @inject(WaitingRoomManager) public waitingRoomManager: WaitingRoomManager,
    @inject(EmbedManager) public embedManager: EmbedManager,
    @inject(BoostService) public boostService: BoostService,
    @inject(DarumaTrainingEncountersService)
    public dtEncountersService: DarumaTrainingEncountersService,
  ) {}
  get state(): GameState {
    if (!this._state) {
      throw new Error('State has not been initialized yet');
    }
    return this._state;
  }

  get settings(): ChannelSettings {
    if (!this._settings) {
      throw new Error('Settings have not been initialized yet');
    }
    return this._settings;
  }
  get getNPC(): IGameNPC | undefined {
    return gameNPCs.find((npc) => npc.gameType === this.settings.gameType);
  }
  updateState(state: GameState): void {
    this._state = state;
  }

  async initialize(channelSettings: ChannelSettings, channel: TextChannel): Promise<void> {
    this._settings = channelSettings;
    this.updateState(new GameState(this.settings.token, generateNPCPlayer(this.getNPC)));
    await this.waitingRoomManager.initialize(this, channel);
  }
  public async addPlayer(player: Player): Promise<boolean> {
    const playerAdded = this.state.playerManager.addPlayer(player);
    await this.embedManager.updateWaitingRoomEmbed(this);
    return playerAdded;
  }
  public async removePlayer(discordId: DiscordId): Promise<boolean> {
    const playerRemoved = this.state.playerManager.removePlayer(discordId);
    await this.embedManager.updateWaitingRoomEmbed(this);
    return playerRemoved;
  }
  private async endGamePlayerUpdate(): Promise<void> {
    this.payoutModifier = await this.boostService.getTemporaryPayoutModifier();
    this.updateState(this.state.findZenAndWinners(undefined, this.payoutModifier));
    for (const player of this.state.playerManager.getAllPlayers()) {
      await player.userAndAssetEndGameUpdate(this.state.gameWinInfo, this.settings.coolDown);
    }
  }
  private async saveEncounter(): Promise<number> {
    await this.endGamePlayerUpdate();
    const { gameType, channelId } = this.settings;
    const allPlayers = this.state.playerManager.getAllPlayers();
    return await this.dtEncountersService.create(allPlayers, channelId, gameType);
  }
  async startChannelGame(): Promise<void> {
    await this.startGame();
    await this.handleGameLogic();
    await this.finishGame();
  }
  private async startGame(): Promise<void> {
    const encounterId = await this.saveEncounter();
    this.updateState(this.state.startGame(encounterId));
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
          this.updateState(this.state.setCurrentPlayer(player, index));

          for (const phase of renderPhasesArray) {
            const board = this.state.renderThisBoard(phase);
            await this.embedManager.executeGameBoardMessage(this, board);
            await phaseDelayFunction(gameType, phase);
          }
        }

        this.updateState(this.state.nextRoll());
      }
    } catch (error) {
      logger.error(`Error in gameHandler: ${JSON.stringify(error)}`);
      this.updateState(this.state.updateStatus(GameStatus.win));
    }
  }
  private async finishGame(): Promise<void> {
    await this.embedManager.finishGame(this);
  }
}
