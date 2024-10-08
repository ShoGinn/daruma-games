import { immerable, produce } from 'immer';

import {
  GameStatus,
  IGameBoardRender,
  IGameNPC,
  RenderPhase,
} from '../../enums/daruma-training.js';
import { ChannelTokenSettings, GameRoundState, GameWinInfo } from '../../types/daruma-training.js';
import { karmaPayoutCalculator } from '../functions/dt-utils.js';

import { darumaTrainingBoard } from './dt-board.js';
import { defaultGameRoundState, defaultGameWinInfo } from './dt-game-state.constants.js';
import { Player } from './dt-player.js';
import { PlayerManager } from './dt-playermanager.js';

export class GameState {
  [immerable] = true;
  readonly gameRoundState: GameRoundState;
  readonly gameWinInfo: GameWinInfo;
  readonly playerManager: PlayerManager;
  readonly encounterId: number | undefined;

  constructor(
    readonly token: ChannelTokenSettings,
    readonly npc: IGameNPC | undefined,
    readonly status: GameStatus = GameStatus.waitingRoom,
    gameRoundState?: GameRoundState,
    gameWinInfo?: GameWinInfo,
    playerManager?: PlayerManager,
    encounterId?: number,
  ) {
    this.status = status;
    this.gameRoundState = gameRoundState ?? { ...defaultGameRoundState };
    this.gameWinInfo = gameWinInfo ?? { ...defaultGameWinInfo };
    this.playerManager = playerManager ?? new PlayerManager(this.npc);
    this.encounterId = encounterId;
  }
  reset(): GameState {
    return new GameState(this.token, this.npc);
  }

  updateStatus(newStatus: GameStatus): this {
    return produce(this, (draft) => {
      draft.status = newStatus;
    });
  }
  setCurrentPlayer(player: Player, playerIndex: number): this {
    return produce(this, (draft) => {
      draft.gameRoundState.currentPlayer = player;
      draft.gameRoundState.playerIndex = playerIndex;
    });
  }

  canStartGame(maxCapacity: number): boolean {
    return (
      this.playerManager.getPlayerCount() >= maxCapacity && this.status === GameStatus.waitingRoom
    );
  }
  maintenance(): this {
    if (this.status !== GameStatus.waitingRoom) {
      throw new Error(`Can't set the game to maintenance from the current state`);
    }
    return this.updateStatus(GameStatus.maintenance);
  }
  startGame(encounterId: number): this {
    if (this.status !== GameStatus.waitingRoom) {
      throw new Error(`Can't start the game from the current state`);
    }
    return produce(this, (draft) => {
      draft.status = GameStatus.activeGame;
      draft.encounterId = encounterId;
    });
  }

  finishGame(): this {
    if (this.status !== GameStatus.win) {
      throw new Error(`Can't finish the game from the current state`);
    }
    return this.updateStatus(GameStatus.finished);
  }
  renderThisBoard(renderPhase: RenderPhase): string {
    const gameBoardRender: IGameBoardRender = {
      players: this.playerManager.getAllPlayers(),
      roundState: {
        rollIndex: this.gameRoundState.rollIndex,
        roundIndex: this.gameRoundState.roundIndex,
        playerIndex: this.gameRoundState.playerIndex,
        phase: renderPhase,
      },
    };
    return darumaTrainingBoard.renderBoard(gameBoardRender);
  }

  nextRoll(): this {
    if (this.checkForWin()) {
      return this.updateStatus(GameStatus.win);
    }
    return this.shouldIncrementRound() ? this.nextRound() : this.incrementRoll();
  }
  checkForWin(): boolean {
    const { currentPlayer, roundIndex, rollIndex } = this.gameRoundState;
    const { gameWinRoundIndex, gameWinRollIndex } = this.gameWinInfo;

    const isCurrentPlayerWinning =
      currentPlayer && roundIndex === gameWinRoundIndex && rollIndex === gameWinRollIndex;
    const isGameStatusWin = this.status == GameStatus.win;

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    return isCurrentPlayerWinning || isGameStatusWin;
  }

  shouldIncrementRound(): boolean {
    const { rollIndex } = this.gameRoundState;
    return (rollIndex + 1) % 3 === 0;
  }
  incrementRoll(): this {
    return produce(this, (draft) => {
      draft.gameRoundState.rollIndex++;
    });
  }
  nextRound(): this {
    return produce(this, (draft) => {
      draft.gameRoundState.roundIndex++;
      draft.gameRoundState.rollIndex = 0;
    });
  }

  findZenAndWinners(token: ChannelTokenSettings = this.token, payoutModifier?: number): this {
    return produce(this, (draft) => {
      const players = this.playerManager.getAllPlayers();
      if (players.length === 0) {
        throw new Error(`Can't find zen and winners with no players`);
      }
      // Find the playerArray with both the lowest round and roll index
      for (const player of players) {
        const winningRollIndex = player.roundsData.gameWinRollIndex;
        const winningRoundIndex = player.roundsData.gameWinRoundIndex;

        if (winningRoundIndex < draft.gameWinInfo.gameWinRoundIndex) {
          draft.gameWinInfo.gameWinRoundIndex = winningRoundIndex;
          draft.gameWinInfo.gameWinRollIndex = winningRollIndex;
        } else if (
          winningRoundIndex === draft.gameWinInfo.gameWinRoundIndex &&
          winningRollIndex < draft.gameWinInfo.gameWinRollIndex
        ) {
          draft.gameWinInfo.gameWinRollIndex = winningRollIndex;
        }
      }

      // Find the number of players with zen
      let zenCount = 0;
      for (const player of players) {
        const winningRollIndex = player.roundsData.gameWinRollIndex;
        const winningRoundIndex = player.roundsData.gameWinRoundIndex;

        if (
          winningRollIndex === draft.gameWinInfo.gameWinRollIndex &&
          winningRoundIndex === draft.gameWinInfo.gameWinRoundIndex
        ) {
          player.isWinner = true;
          zenCount++;
        }
      }

      draft.gameWinInfo.zen = zenCount > 1;

      // Calculate the payout
      const karmaWinningRound = draft.gameWinInfo.gameWinRoundIndex + 1;
      draft.gameWinInfo.payout = karmaPayoutCalculator(
        karmaWinningRound,
        token,
        draft.gameWinInfo.zen,
        payoutModifier,
      );
    });
  }
}
