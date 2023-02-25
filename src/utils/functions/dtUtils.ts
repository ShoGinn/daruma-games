import { MikroORM } from '@mikro-orm/core';
import { GuildMember } from 'discord.js';
import { container } from 'tsyringe';

import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.entity.js';
import { AlgoWallet } from '../../entities/AlgoWallet.entity.js';
import { DarumaTrainingChannel } from '../../entities/DtChannel.entity.js';
import { GameTypes } from '../../enums/dtEnums.js';
import {
    ChannelSettings,
    channelTokenSettings,
    gameBonusData,
    GameRoundState,
    gameWinInfo,
} from '../../model/types/darumaTraining.js';

export function buildGameType(darumaTrainingChannel: DarumaTrainingChannel): ChannelSettings {
    // Default settings
    const cooldownInMilli = 21600000; // 6 hours in milliseconds
    const defaults: ChannelSettings = {
        minCapacity: 0,
        maxCapacity: 0,
        channelId: darumaTrainingChannel.id,
        messageId: darumaTrainingChannel.messageId,
        gameType: darumaTrainingChannel.gameType,
        coolDown: cooldownInMilli,
        token: {
            baseAmount: 5,
            roundModifier: 5,
            zenMultiplier: 1.5,
            zenRoundModifier: 0.5,
        },
    };
    switch (darumaTrainingChannel.gameType) {
        case GameTypes.OneVsNpc:
            defaults.minCapacity = 2;
            defaults.maxCapacity = 2;
            defaults.token.zenMultiplier = 1;
            break;
        case GameTypes.OneVsOne:
            defaults.token.baseAmount = 20;
            defaults.minCapacity = 2;
            defaults.maxCapacity = 2;
            break;
        case GameTypes.FourVsNpc:
            defaults.minCapacity = 5;
            defaults.maxCapacity = 5;
            defaults.coolDown = 5400000; // 1.5 hours in milliseconds;
            defaults.token.baseAmount = 30;
            defaults.token.zenMultiplier = 3.5;
            break;
    }
    return Object.assign({}, defaults);
}

/**
 * This is the game payout rules for the game
 * It takes the game winning round (not index)
 * as well as the game channel settings to produce a payout
 *
 * @export
 * @param {number} winningRound
 * @param {channelTokenSettings} tokenSettings
 * @param {boolean} zen
 * @returns {*}  {number}
 */
export function karmaPayoutCalculator(
    winningRound: number,
    tokenSettings: channelTokenSettings,
    zen: boolean
): number {
    const { baseAmount, roundModifier, zenMultiplier, zenRoundModifier } = tokenSettings;
    const roundMultiplier = Math.max(0, winningRound - 5);
    const zenPayout =
        (baseAmount + roundModifier * roundMultiplier) *
        (zenRoundModifier * roundMultiplier + zenMultiplier);
    return Math.floor(zen ? zenPayout : baseAmount + roundModifier * roundMultiplier);
}

/**
 * This function gets the current rank of an asset
 *
 * @export
 * @param {AlgoNFTAsset} asset
 * @returns {*}  {Promise<{ currentRank: string; totalAssets: string }>}
 */
export async function assetCurrentRank(
    asset: AlgoNFTAsset
): Promise<{ currentRank: string; totalAssets: string }> {
    const db = container.resolve(MikroORM).em.fork();
    const allAssetRanks = await db.getRepository(AlgoNFTAsset).assetRankingByWinsTotalGames();
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
 * @export
 * @param {GuildMember} user
 * @returns {*}  {Promise<Array<AlgoNFTAsset>>}
 */
export async function coolDownsDescending(user: GuildMember): Promise<Array<AlgoNFTAsset>> {
    const db = container.resolve(MikroORM).em.fork();
    const playableAssets = await db.getRepository(AlgoWallet).getPlayableAssets(user.id);

    // remove assets that are not in cool down
    const assetsInCoolDown = playableAssets.filter(asset => {
        return asset.dojoCoolDown > new Date();
    });
    return assetsInCoolDown.sort((a, b) => b.dojoCoolDown.getTime() - a.dojoCoolDown.getTime());
}

/**
 * This function gets the average number of daruma owned by all users
 *
 * @export
 * @returns {*}  {Promise<number>}
 */
export async function getAverageDarumaOwned(): Promise<number> {
    const db = container.resolve(MikroORM).em.fork();
    const allUsersAndAssets = await db.getRepository(AlgoWallet).topNFTHolders();
    const arrayOfTotalNFTs = Array.from(allUsersAndAssets.values()).filter(
        v => typeof v === 'number'
    );
    const totalNFTs = arrayOfTotalNFTs.reduce((a, b) => a + b, 0);
    return arrayOfTotalNFTs.length > 0 ? Math.round(totalNFTs / arrayOfTotalNFTs.length) : 0;
}

/**
 * This function calculates the chance of increasing or decreasing the cool down
 *
 * @export
 * @param {AlgoNFTAsset} asset
 * @param {string} discordUser
 * @param {number} channelCoolDown
 * @returns {*}  {Promise<number>}
 */
export async function rollForCoolDown(
    asset: AlgoNFTAsset,
    discordUser: string,
    channelCoolDown: number
): Promise<number> {
    // Get the chance of increasing or decreasing the cool down
    const { increase: increasePct, decrease: decreasePct } = await factorChancePct(
        asset,
        discordUser
    );
    // Get the time to increase or decrease the cool down
    const { increase: increaseTime, decrease: decreaseTime } = calculateTimePct(
        { increase: increasePct, decrease: decreasePct },
        channelCoolDown
    );

    // roll 2 dice
    const increaseRoll = Math.random();
    const decreaseRoll = Math.random();
    // Check each roll against the chance to increase or decrease
    // If the roll is less than the chance, then increase or decrease the cool down
    let coolDown = channelCoolDown;

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
 * @param {AlgoNFTAsset} asset
 * @param {string} discordUser
 * @returns {*}  {Promise<IIncreaseDecrease>}
 */
async function factorChancePct(
    asset: AlgoNFTAsset,
    discordUser: string
): Promise<IIncreaseDecrease> {
    const db = container.resolve(MikroORM).em.fork();
    const algoNftAssets = db.getRepository(AlgoNFTAsset);
    const userTotalAssets = await db
        .getRepository(AlgoWallet)
        .getTotalAssetsByDiscordUser(discordUser);
    const bonusStats = await algoNftAssets.getBonusData(asset, userTotalAssets);
    return calculateFactorChancePct(bonusStats);
}

/**
 * This function calculates the chance of increasing or decreasing the cool down
 *
 * @export
 * @param {gameBonusData} bonusStats
 * @returns {*}  {IIncreaseDecrease}
 */
export function calculateFactorChancePct(bonusStats: gameBonusData): IIncreaseDecrease {
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
    const walletFactors = calculateIncAndDec(
        WALLET_MEDIAN_MAX,
        userTotalAssets,
        averageTotalAssets
    );
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
 * @export
 * @param {IIncreaseDecrease} factorPct
 * @param {number} channelCoolDown
 * @returns {*}  {IIncreaseDecrease}
 */
export function calculateTimePct(
    factorPct: IIncreaseDecrease,
    channelCoolDown: number
): IIncreaseDecrease {
    const { increase: incPct, decrease: decPct } = factorPct;
    const { increaseMaxChance, decreaseMaxChance } = coolDownBonusFactors.bonusChances;
    const { increase: incMaxTimePct, decrease: decMaxTimePct } =
        coolDownBonusFactors.timeMaxPercents;
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
 * @export
 * @param {IMedianMaxes} medianMaxes
 * @param {number} assetStat
 * @param {number} average
 * @returns {*}  {IIncreaseDecrease}
 */
export function calculateIncAndDec(
    medianMaxes: IMedianMaxes,
    assetStat: number,
    average: number
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

export const defaultGameWinInfo: gameWinInfo = {
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
