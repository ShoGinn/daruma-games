import { GuildMember } from 'discord.js';

import { MikroORM } from '@mikro-orm/core';
import { produce } from 'immer';
import { container } from 'tsyringe';

import { AlgoNFTAsset } from '../../entities/algo-nft-asset.entity.js';
import { AlgoWallet } from '../../entities/algo-wallet.entity.js';
import { IDarumaTrainingChannel } from '../../entities/dt-channel.mongo.js';
import {
  GameTypes,
  GIF_RENDER_PHASE,
  renderConfig,
  RenderPhase,
} from '../../enums/daruma-training.js';
import {
  ChannelSettings,
  ChannelTokenSettings,
  GameBonusData,
  GameRoundState,
  GameWinInfo,
  IdtGames,
} from '../../model/types/daruma-training.js';
import { ObjectUtil, RandomUtils } from '../utils.js';

export function isPlayerAssetRegisteredInGames(
  games: IdtGames,
  discordUser: string,
  assetId: string,
): boolean {
  return [...games.values()].some((game) => {
    const player = game.state.playerManager.getPlayer(discordUser);
    return player?.playableNFT.id === Number(assetId);
  });
}
export function isCoolDownOrRegistered(
  daruma: AlgoNFTAsset,
  discordId: string,
  games: IdtGames,
): boolean {
  const isCooledDown = daruma.dojoCoolDown < new Date();
  const isRegistered = isPlayerAssetRegisteredInGames(games, discordId, daruma.id.toString());
  return isCooledDown && !isRegistered;
}

export function isNotCooledDownOrRegistered(
  daruma: AlgoNFTAsset,
  discordId: string,
  games: IdtGames,
): boolean {
  const isNotCooledDown = daruma.dojoCoolDown > new Date();
  const isRegistered = isPlayerAssetRegisteredInGames(games, discordId, daruma.id.toString());
  return isNotCooledDown && !isRegistered;
}

export function filterDarumaIndex(
  darumaIndex: AlgoNFTAsset[],
  discordId: string,
  games: IdtGames,
  filterFunction: (daruma: AlgoNFTAsset, discordId: string, games: IdtGames) => boolean,
): AlgoNFTAsset[] {
  return darumaIndex.filter((daruma) => filterFunction(daruma, discordId, games));
}
export function filterCoolDownOrRegistered(
  darumaIndex: AlgoNFTAsset[],
  discordId: string,
  games: IdtGames,
): AlgoNFTAsset[] {
  return filterDarumaIndex(darumaIndex, discordId, games, isCoolDownOrRegistered);
}

export function filterNotCooledDownOrRegistered(
  darumaIndex: AlgoNFTAsset[],
  discordId: string,
  games: IdtGames,
): AlgoNFTAsset[] {
  return filterDarumaIndex(darumaIndex, discordId, games, isNotCooledDownOrRegistered);
}
export function buildGameType(darumaTrainingChannel: IDarumaTrainingChannel): ChannelSettings {
  // Default settings
  const cooldownInMilli = 21_600_000; // 6 hours in milliseconds
  const defaults: ChannelSettings = {
    minCapacity: 0,
    maxCapacity: 0,
    channelId: darumaTrainingChannel.id,
    gameType: darumaTrainingChannel.gameType,
    coolDown: cooldownInMilli,
    token: {
      baseAmount: 5,
      roundModifier: 5,
      zenMultiplier: 1.5,
      zenRoundModifier: 0.5,
    },
  };
  return produce(defaults, (draft) => {
    switch (darumaTrainingChannel.gameType) {
      case GameTypes.OneVsNpc: {
        draft.minCapacity = 2;
        draft.maxCapacity = 2;
        draft.token.zenMultiplier = 1;
        break;
      }
      case GameTypes.OneVsOne: {
        draft.token.baseAmount = 20;
        draft.minCapacity = 2;
        draft.maxCapacity = 2;
        break;
      }
      case GameTypes.FourVsNpc: {
        draft.minCapacity = 5;
        draft.maxCapacity = 5;
        draft.coolDown = 5_400_000; // 1.5 hours in milliseconds;
        draft.token.baseAmount = 30;
        draft.token.zenMultiplier = 3.5;
        break;
      }
    }
  });
}

/**
 * This is the game payout rules for the game
 * It takes the game winning round (not index)
 * as well as the game channel settings to produce a payout
 *
 * @param {number} winningRound
 * @param {ChannelTokenSettings} tokenSettings
 * @param {boolean} zen
 * @param {number} [payoutModifier]
 * @returns {*}  {number}
 */
export function karmaPayoutCalculator(
  winningRound: number,
  tokenSettings: ChannelTokenSettings,
  zen: boolean,
  payoutModifier?: number | undefined,
): number {
  const { baseAmount, roundModifier, zenMultiplier, zenRoundModifier } = tokenSettings;
  const roundMultiplier = Math.max(0, winningRound - 5);
  const regularPayout = baseAmount + roundModifier * roundMultiplier;
  const zenPayout = regularPayout * (zenRoundModifier * roundMultiplier + zenMultiplier);
  const payout = zen ? zenPayout : regularPayout;
  return Math.floor(payoutModifier ? payout * payoutModifier : payout);
}
/**
 * This function gets the current rank of an asset
 *

 * @param {AlgoNFTAsset} asset
 * @returns {*}  {Promise<{ currentRank: string; totalAssets: string }>}
 */
export async function assetCurrentRank(
  asset: AlgoNFTAsset,
): Promise<{ currentRank: string; totalAssets: string }> {
  const database = container.resolve(MikroORM).em.fork();
  const allAssetRanks = await database.getRepository(AlgoNFTAsset).assetRankingByWinsTotalGames();
  const assetRank =
    allAssetRanks.findIndex((rankedAsset: AlgoNFTAsset) => rankedAsset.id === asset.id) + 1;
  return {
    currentRank: assetRank.toLocaleString(),
    totalAssets: allAssetRanks.length.toLocaleString(),
  };
}

/**
 * This function gets the assets that are in cool down for a user
 * and sorts them in descending order
 *

 * @param {GuildMember} user
 * @returns {*}  {Promise<Array<AlgoNFTAsset>>}
 */
export async function coolDownsDescending(user: GuildMember): Promise<AlgoNFTAsset[]> {
  const database = container.resolve(MikroORM).em.fork();
  const playableAssets = await database.getRepository(AlgoWallet).getPlayableAssets(user.id);

  // remove assets that are not in cool down
  const assetsInCoolDown = playableAssets.filter((asset) => {
    return asset.dojoCoolDown > new Date();
  });
  return assetsInCoolDown.sort((a, b) => b.dojoCoolDown.getTime() - a.dojoCoolDown.getTime());
}

/**
 * This function gets the average number of daruma owned by all users
 *

 * @returns {*}  {Promise<number>}
 */
export async function getAverageDarumaOwned(): Promise<number> {
  const database = container.resolve(MikroORM).em.fork();
  const allUsersWithTotalAssets = await database.getRepository(AlgoWallet).topNFTHolders();
  const arrayOfTotalAssets = [...allUsersWithTotalAssets.values()].filter(
    (v) => typeof v === 'number',
  );
  const totalAssets = arrayOfTotalAssets.reduce((a, b) => a + b, 0);
  return arrayOfTotalAssets.length > 0 ? Math.round(totalAssets / arrayOfTotalAssets.length) : 0;
}

/**
 * This function returns the cool down time for a user
 * based upon the number of daruma they own
 * and the number of daruma the average user owns
 *
 * @param {AlgoNFTAsset} asset
 * @param {string} discordUser
 * @param {number} channelCoolDown
 * @param {() => { increaseRoll: number; decreaseRoll: number }} [coolDownRollsFunction=coolDownRolls]
 * @param {(asset: AlgoNFTAsset, discordUserId: string) => Promise<IIncreaseDecrease>} [factorChancePctFunction=factorChancePct]
 * @returns {*}  {Promise<number>}
 */
export async function rollForCoolDown(
  asset: AlgoNFTAsset,
  discordUser: string,
  channelCoolDown: number,
  coolDownRollsFunction: () => { increaseRoll: number; decreaseRoll: number } = coolDownRolls,
  factorChancePctFunction: (
    asset: AlgoNFTAsset,
    discordUserId: string,
  ) => Promise<IIncreaseDecrease> = factorChancePct,
): Promise<number> {
  // Get the chance of increasing or decreasing the cool down
  const { increase: increasePct, decrease: decreasePct } = await factorChancePctFunction(
    asset,
    discordUser,
  );
  // Get the time to increase or decrease the cool down
  const { increase: increaseTime, decrease: decreaseTime } = calculateTimePct(
    { increase: increasePct, decrease: decreasePct },
    channelCoolDown,
  );

  // Check each roll against the chance to increase or decrease
  // If the roll is less than the chance, then increase or decrease the cool down
  let coolDown = channelCoolDown;
  const { increaseRoll, decreaseRoll } = coolDownRollsFunction();

  if (increaseRoll < increasePct) {
    coolDown += increaseTime;
  } else if (decreaseRoll < decreasePct) {
    coolDown -= decreaseTime;
  }
  return coolDown;
}
export function coolDownRolls(
  randomBoolFunction: () => boolean = RandomUtils.random.bool.bind(RandomUtils.random),
): { increaseRoll: number; decreaseRoll: number } {
  const increaseRoll = randomBoolFunction() ? 1 : 0;
  const decreaseRoll = randomBoolFunction() ? 1 : 0;
  return { increaseRoll, decreaseRoll };
}
/**
 * This function calculates the chance of increasing or decreasing the cool down
 *
 * @param {AlgoNFTAsset} asset
 * @param {string} discordUser
 * @returns {*}  {Promise<IIncreaseDecrease>}
 */
async function factorChancePct(
  asset: AlgoNFTAsset,
  discordUser: string,
): Promise<IIncreaseDecrease> {
  const database = container.resolve(MikroORM).em.fork();
  const algoNftAssets = database.getRepository(AlgoNFTAsset);
  const userTotalAssets = await database
    .getRepository(AlgoWallet)
    .getTotalAssetsByDiscordUser(discordUser);
  const bonusStats = await algoNftAssets.getBonusData(asset, userTotalAssets);
  return calculateFactorChancePct(bonusStats);
}

/**
 * This function calculates the chance of increasing or decreasing the cool down
 *

 * @param {GameBonusData} bonusStats
 * @returns {*}  {IIncreaseDecrease}
 */
export function calculateFactorChancePct(bonusStats: GameBonusData): IIncreaseDecrease {
  // There are 3 stats necessary to calculate the bonus
  // 1. The Average of all Games Played -- and the asset's games played
  // 2. The Average of all Total Wallet Assets -- and the asset's total wallet assets
  // 3. The Average of all Daruma Ranks -- and the asset's daruma rank
  // The Bonuses uses a matrix to determine the bonus
  // ----
  // We first determine if the asset is above or below the median of each stat
  // Then we determine the bonus based on the matrix
  // ----
  // The once the chance percentage is determined, we roll a dice to see if the bonus is applied
  // ----
  // The bonus is applied by increasing or decreasing the cool down time

  // Get the median of each stat
  const {
    assetTotalGames,
    averageTotalGames,
    userTotalAssets,
    averageTotalAssets,
    assetRank,
    averageRank,
  } = bonusStats;

  const gameFactors = calculateIncAndDec(GAMES_MEDIAN_MAX, assetTotalGames, averageTotalGames);
  const walletFactors = calculateIncAndDec(WALLET_MEDIAN_MAX, userTotalAssets, averageTotalAssets);
  const rankFactors = calculateIncAndDec(RANK_MEDIAN_MAX, assetRank, averageRank);

  const totalFactorIncrease =
    gameFactors.increase +
    walletFactors.increase +
    rankFactors.increase +
    coolDownBonusFactors.bonusChances.increaseBaseChance;

  const totalFactorDecrease =
    gameFactors.decrease +
    walletFactors.decrease +
    rankFactors.decrease +
    coolDownBonusFactors.bonusChances.decreaseBaseChance;
  return { increase: totalFactorIncrease, decrease: totalFactorDecrease };
}

/**
 * This function calculates the time to increase or decrease the cool down
 *

 * @param {IIncreaseDecrease} factorPct
 * @param {number} channelCoolDown
 * @returns {*}  {IIncreaseDecrease}
 */
export function calculateTimePct(
  factorPct: IIncreaseDecrease,
  channelCoolDown: number,
): IIncreaseDecrease {
  const { increase: incPct, decrease: decPct } = factorPct;
  const { increaseMaxChance, decreaseMaxChance } = coolDownBonusFactors.bonusChances;
  const { increase: incMaxTimePct, decrease: decMaxTimePct } = coolDownBonusFactors.timeMaxPercents;
  // This takes the factor percentage and divides it by the max chance to get the percentage of the max chance
  // Then it multiplies that by the max time percentage to get the percentage of the max time
  // ----
  // example if the factor is 0.8 and the max change is 0.8 then the percentage is 100%
  // if the factor is 0.4 and the max change is 0.8 then the percentage is 50%
  const increase = (incPct / increaseMaxChance) * incMaxTimePct;
  const decrease = (decPct / decreaseMaxChance) * decMaxTimePct;

  // This takes the percentage of the max time and multiplies it by the channel cool down to get the time
  // ----
  // example if the percentage is 100% and the channel cool down is 10 minutes then the time is 10 minutes
  // if the percentage is 50% and the channel cool down is 10 minutes then the time is 5 minutes
  const increaseTime = increase * channelCoolDown;
  const decreaseTime = decrease * channelCoolDown;
  return { increase: increaseTime, decrease: decreaseTime };
}

/**
 * This function calculates the increase and decrease based on the median and maxes
 *

 * @param {IMedianMaxes} medianMaxes
 * @param {number} assetStat
 * @param {number} average
 * @returns {*}  {IIncreaseDecrease}
 */
export function calculateIncAndDec(
  medianMaxes: IMedianMaxes,
  assetStat: number,
  average: number,
): IIncreaseDecrease {
  if (average === 0) {
    return { increase: 0, decrease: 0 };
  }
  let increase = 0;
  let decrease = 0;
  const difference = Math.abs(average - (assetStat - 1));
  const { increase: incMax, decrease: decMax } =
    assetStat > average ? medianMaxes.aboveMedianMax : medianMaxes.belowMedianMax;
  increase = (incMax / average) * difference;
  decrease = (decMax / average) * difference;
  increase = Math.min(increase, incMax);
  decrease = Math.min(decrease, decMax);
  return { increase, decrease };
}

export const GAMES_MEDIAN_MAX: IMedianMaxes = {
  aboveMedianMax: {
    increase: 0.1,
    decrease: 0,
  },
  belowMedianMax: {
    increase: 0,
    decrease: 0.1,
  },
};
export const WALLET_MEDIAN_MAX: IMedianMaxes = {
  aboveMedianMax: {
    increase: 0.1,
    decrease: 0,
  },
  belowMedianMax: {
    increase: 0,
    decrease: 0.4,
  },
};
export const RANK_MEDIAN_MAX: IMedianMaxes = {
  aboveMedianMax: {
    increase: 0,
    decrease: 0.1,
  },
  belowMedianMax: {
    increase: 0.1,
    decrease: 0,
  },
};

export const coolDownBonusFactors = {
  timeMaxPercents: {
    decrease: 1, // 100%
    increase: 0.8, // 80%
  },
  bonusChances: {
    decreaseBaseChance: 0.2,
    increaseBaseChance: 0,
    decreaseMaxChance: 0.8,
    increaseMaxChance: 0.3,
  },
};
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

export interface IIncreaseDecrease {
  increase: number;
  decrease: number;
}
interface IMedianMaxes {
  aboveMedianMax: IIncreaseDecrease;
  belowMedianMax: IIncreaseDecrease;
}

export const getMinTime = (
  gameType: GameTypes,
  phase: RenderPhase,
  defaultDelay: number = 1000,
): number => {
  if (GameTypes.FourVsNpc === gameType && phase === GIF_RENDER_PHASE) {
    return defaultDelay;
  }
  return renderConfig[phase]?.durMin ?? 0;
};

export const getMaxTime = (
  gameType: GameTypes,
  phase: RenderPhase,
  defaultDelay: number = 1000,
): number => {
  if (GameTypes.FourVsNpc === gameType && phase === GIF_RENDER_PHASE) {
    return defaultDelay;
  }
  return renderConfig[phase]?.durMax ?? 0;
};
export const phaseDelay = async (
  gameType: GameTypes,
  phase: RenderPhase,
  executeWait: boolean = true,
  randomDelayFor: (minTime: number, maxTime: number) => Promise<void> = ObjectUtil.randomDelayFor,
): Promise<[number, number]> => {
  const minTime = getMinTime(gameType, phase);
  const maxTime = getMaxTime(gameType, phase);

  if (executeWait) {
    await randomDelayFor(minTime, maxTime);
  }

  return [minTime, maxTime];
};
