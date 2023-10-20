import { GameTypes } from '../../enums/daruma-training.js';
import { Game } from '../../utils/classes/dt-game.js';
import { Player } from '../../utils/classes/dt-player.js';

export interface RollData {
  readonly roll: number;
  readonly damage: number;
  readonly totalScore: number;
}
export interface RoundData {
  readonly rolls: RollData[];
}
export interface PlayerRoundsData {
  readonly rounds: RoundData[];
  readonly gameWinRoundIndex: number;
  readonly gameWinRollIndex: number;
}

export type EmbedOptions = Player;

export interface GameWinInfo {
  readonly gameWinRoundIndex: number;
  readonly gameWinRollIndex: number;
  readonly zen: boolean;
  readonly payout: number;
}
export type IdtGames = Record<string, Game>;

export interface ChannelSettings {
  readonly minCapacity: number;
  readonly maxCapacity: number;
  readonly channelId: string;
  readonly gameType: GameTypes;
  readonly coolDown: number;
  readonly token: ChannelTokenSettings;
}
export interface ChannelTokenSettings {
  readonly baseAmount: number;
  readonly roundModifier: number;
  readonly zenMultiplier: number;
  readonly zenRoundModifier: number;
}
export interface GameRoundState {
  readonly rollIndex: number;
  readonly roundIndex: number;
  readonly playerIndex: number;
  readonly currentPlayer?: Player | undefined;
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
