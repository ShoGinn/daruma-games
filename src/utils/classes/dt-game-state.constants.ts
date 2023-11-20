import { GameRoundState, GameWinInfo } from '../../types/daruma-training.js';

export const defaultGameRoundState: GameRoundState = {
  roundIndex: 0,
  rollIndex: 0,
  playerIndex: 0,
  currentPlayer: undefined,
};

export const defaultGameWinInfo: GameWinInfo = {
  gameWinRollIndex: Number.MAX_SAFE_INTEGER,
  gameWinRoundIndex: Number.MAX_SAFE_INTEGER,
  payout: 0,
  zen: false,
};
