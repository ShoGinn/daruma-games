import { GameTypes } from '../../enums/daruma-training.js';
import { Game } from '../../utils/classes/dt-game.js';
import { Player } from '../../utils/classes/dt-player.js';

export interface RollData {
  roll: number;
  damage: number;
  totalScore: number;
}
export interface RoundData {
  rolls: RollData[];
}
export interface PlayerRoundsData {
  readonly rounds: RoundData[];
  readonly gameWinRoundIndex: number;
  readonly gameWinRollIndex: number;
}

export type EmbedOptions = Player;

export interface GameWinInfo {
  gameWinRoundIndex: number;
  gameWinRollIndex: number;
  zen: boolean;
  payout: number;
}
export type IdtGames = Record<string, Game>;

export interface ChannelSettings {
  minCapacity: number;
  maxCapacity: number;
  channelId: string;
  gameType: GameTypes;
  coolDown: number;
  token: ChannelTokenSettings;
  messageId?: string | undefined;
}
export interface ChannelTokenSettings {
  baseAmount: number;
  roundModifier: number;
  zenMultiplier: number;
  zenRoundModifier: number;
}
export interface GameRoundState {
  rollIndex: number;
  roundIndex: number;
  playerIndex: number;
  currentPlayer?: Player | undefined;
}
export interface FakeAsset {
  assetIndex: number;
  name: string;
  unitName: string;
  url: string;
}
export type GameBonusData = {
  averageTotalGames: number;
  assetTotalGames: number;
  averageWins: number;
  assetWins: number;
  averageRank: number;
  assetRank: number;
  averageTotalAssets: number;
  userTotalAssets: number;
};
export interface IGameStats {
  wins: number;
  losses: number;
  zen: number;
}
