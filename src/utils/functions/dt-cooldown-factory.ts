import { container } from 'tsyringe';

import { IAlgoNFTAsset } from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import { StatsService } from '../../services/stats.js';
import { DiscordId } from '../../types/core.js';
import { GameBonusData } from '../../types/daruma-training.js';
import { randomUtils } from '../classes/random-utils.js';

import {
  coolDownBonusFactors,
  GAMES_MEDIAN_MAX,
  IIncreaseDecrease,
  IMedianMaxes,
  RANK_MEDIAN_MAX,
  WALLET_MEDIAN_MAX,
} from './dt-cooldown-factory.constants.js';

/**
 * This function returns the cool down time for a user
 * based upon the number of daruma they own
 * and the number of daruma the average user owns
 *
 * @param {IAlgoNFTAsset} asset
 * @param {string} discordUserId
 * @param {number} channelCoolDown
 * @param {() => { increaseRoll: number; decreaseRoll: number }} [coolDownRollsFunction=coolDownRolls]
 * @param {(asset: AlgoNFTAsset, discordUserId: DiscordId) => Promise<IIncreaseDecrease>} [factorChancePctFunction=factorChancePct]
 * @returns {*}  {Promise<number>}
 */
export async function rollForCoolDown(
  asset: IAlgoNFTAsset,
  discordUserId: DiscordId,
  channelCoolDown: number,
  coolDownRollsFunction: () => { increaseRoll: number; decreaseRoll: number } = coolDownRolls,
  factorChancePctFunction: (
    asset: IAlgoNFTAsset,
    discordUserId: DiscordId,
  ) => Promise<IIncreaseDecrease> = factorChancePct,
): Promise<number> {
  // Get the chance of increasing or decreasing the cool down
  const { increase: increasePct, decrease: decreasePct } = await factorChancePctFunction(
    asset,
    discordUserId,
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

/**
 * This function calculates the chance of increasing or decreasing the cool down
 *
 * @param {IAlgoNFTAsset} asset
 * @param {string} discordUserId
 * @returns {*}  {Promise<IIncreaseDecrease>}
 */
export async function factorChancePct(
  asset: IAlgoNFTAsset,
  discordUserId: DiscordId,
): Promise<IIncreaseDecrease> {
  const statsService = container.resolve(StatsService);

  const userTotalAssets = await statsService.getTotalAssetsByUser(discordUserId);
  const bonusStats = await statsService.getBonusData(asset, userTotalAssets);
  return calculateFactorChancePct(bonusStats);
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
export function coolDownRolls(
  randomBoolFunction: () => boolean = randomUtils.random.bool.bind(randomUtils.random),
): { increaseRoll: number; decreaseRoll: number } {
  const increaseRoll = randomBoolFunction() ? 1 : 0;
  const decreaseRoll = randomBoolFunction() ? 1 : 0;
  return { increaseRoll, decreaseRoll };
}
