import { MikroORM } from '@mikro-orm/core';
import { GuildMember } from 'discord.js';
import { container } from 'tsyringe';

import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.js';
import { AlgoWallet } from '../../entities/AlgoWallet.js';
import { DarumaTrainingChannel } from '../../entities/DtChannel.js';
import { GameTypes } from '../../enums/dtEnums.js';
import TIME_UNIT from '../../enums/TIME_UNIT.js';
import { ObjectUtil } from '../Utils.js';

export function buildGameType(
    darumaTrainingChannel: DarumaTrainingChannel
): DarumaTrainingPlugin.ChannelSettings {
    // Default settings
    const defaults: DarumaTrainingPlugin.ChannelSettings = {
        minCapacity: 0,
        maxCapacity: 0,
        channelId: darumaTrainingChannel.id,
        messageId: darumaTrainingChannel.messageId,
        gameType: darumaTrainingChannel.gameType,
        coolDown: ObjectUtil.convertToMilli(6, TIME_UNIT.hours),
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
            defaults.coolDown = ObjectUtil.convertToMilli(1.5, TIME_UNIT.hours);
            defaults.token.baseAmount = 30;
            defaults.token.zenMultiplier = 3.5;
            break;
    }
    return {
        ...defaults,
    };
}

/**
 * This is the game payout rules for the game
 * It takes the game winning round (not index)
 * as well as the game channel settings to produce a payout
 *
 * @export
 * @param {number} winningRound
 * @param {DarumaTrainingPlugin.channelTokenSettings} tokenSettings
 * @param {boolean} zen
 * @returns {*}  {number}
 */
export function karmaPayoutCalculator(
    winningRound: number,
    tokenSettings: DarumaTrainingPlugin.channelTokenSettings,
    zen: boolean
): number {
    // Get multiplier of rounds over round 5
    const baseAmount = tokenSettings.baseAmount;
    const roundModifier = tokenSettings.roundModifier;
    const zenMultiplier2 = tokenSettings.zenMultiplier;
    const zenRoundModifier = tokenSettings.zenRoundModifier;

    const roundMultiplier = Math.max(1, winningRound - 4) - 1;
    const zenMultiplier = zenRoundModifier * roundMultiplier + zenMultiplier2;
    // Ensure payout is never a float
    const roundPayout = roundMultiplier * roundModifier + baseAmount;
    const zenPayout = roundPayout * zenMultiplier;
    const payout = zen ? zenPayout : roundPayout;
    return Math.floor(payout);
}

export async function assetCurrentRank(
    asset: AlgoNFTAsset
): Promise<{ currentRank: string; totalAssets: string }> {
    const db = container.resolve(MikroORM).em.fork();
    const allAssetRanks = await db.getRepository(AlgoNFTAsset).assetRankingByWinsTotalGames();
    const currentRank = allAssetRanks.findIndex(
        (rankedAsset: AlgoNFTAsset) => rankedAsset.id === asset.id
    );
    return {
        currentRank: (currentRank + 1).toLocaleString(),
        totalAssets: allAssetRanks.length.toLocaleString(),
    };
}
export async function coolDownsDescending(user: GuildMember): Promise<AlgoNFTAsset[]> {
    const db = container.resolve(MikroORM).em.fork();
    const playableAssets = await db.getRepository(AlgoWallet).getPlayableAssets(user.id);

    // remove assets that are not in cool down
    const assetsInCoolDown = playableAssets.filter(asset => {
        return asset.dojoCoolDown > new Date();
    });
    return assetsInCoolDown.sort((a, b) => {
        const bCooldown = b.dojoCoolDown.getTime();
        const aCooldown = a.dojoCoolDown.getTime();
        return bCooldown - aCooldown;
    });
}
export async function getAverageDarumaOwned(): Promise<number> {
    const db = container.resolve(MikroORM).em.fork();
    const allUsersAndAssets = await db.getRepository(AlgoWallet).topNFTHolders();
    const arrayOfTotalNFTs = Array.from(allUsersAndAssets.values());
    const totalNFTs = arrayOfTotalNFTs.reduce((a, b) => a + b, 0);
    return Math.round(totalNFTs / arrayOfTotalNFTs.length);
}
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
    // roll 2 dice
    const increaseRoll = Math.random();
    const decreaseRoll = Math.random();
    // Get the time to increase or decrease the cool down
    const { increase: increaseTime, decrease: decreaseTime } = calculateTimePct(
        { increase: increasePct, decrease: decreasePct },
        channelCoolDown
    );
    // Check each roll against the chance to increase or decrease
    // If the roll is less than the chance, then increase or decrease the cool down
    let coolDown = channelCoolDown;
    if (increaseRoll < increasePct) {
        coolDown += increaseTime;
    }
    if (decreaseRoll < decreasePct) {
        coolDown -= decreaseTime;
    }
    return coolDown;
}
async function factorChancePct(
    asset: AlgoNFTAsset,
    discordUser: string
): Promise<IIncreaseDecrease> {
    const db = container.resolve(MikroORM).em.fork();
    const algoNftAssets = db.getRepository(AlgoNFTAsset);
    const userTotalAssets = await db
        .getRepository(AlgoWallet)
        .getTotalAssetsByDiscordUser(discordUser);
    const averageNFTs = await getAverageDarumaOwned();
    const bonusStats = await algoNftAssets.getBonusData(asset, averageNFTs, userTotalAssets);
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
    const { increase: gameFactorIncrease, decrease: gameFactorDecrease } = calculateIncAndDec(
        gamesMedianMax,
        bonusStats.assetTotalGames,
        bonusStats.averageTotalGames
    );
    const { increase: walletFactorIncrease, decrease: walletFactorDecrease } = calculateIncAndDec(
        totalWalletAssetsMedianMax,
        bonusStats.userTotalAssets,
        bonusStats.averageTotalAssets
    );
    const { increase: rankFactorIncrease, decrease: rankFactorDecrease } = calculateIncAndDec(
        darumaRankMedianMax,
        bonusStats.assetRank,
        bonusStats.averageRank
    );
    const totalFactorIncrease =
        gameFactorIncrease +
        walletFactorIncrease +
        rankFactorIncrease +
        coolDownBonusFactors.bonusChances.increaseBaseChance;
    const totalFactorDecrease =
        gameFactorDecrease +
        walletFactorDecrease +
        rankFactorDecrease +
        coolDownBonusFactors.bonusChances.decreaseBaseChance;
    return { increase: totalFactorIncrease, decrease: totalFactorDecrease };
}
function calculateTimePct(
    factorPct: IIncreaseDecrease,
    channelCoolDown: number
): IIncreaseDecrease {
    // get percentage based upon max increase and decrease
    const increase = factorPct.increase / coolDownBonusFactors.bonusChances.increaseMaxChance;
    const decrease = factorPct.decrease / coolDownBonusFactors.bonusChances.decreaseMaxChance;
    // get the time based upon the percentage
    const maxIncreaseTime =
        channelCoolDown + channelCoolDown * coolDownBonusFactors.timeMaxPercents.increase;
    const maxDecreaseTime = channelCoolDown * coolDownBonusFactors.timeMaxPercents.decrease;

    const increaseTime = increase * (maxIncreaseTime - channelCoolDown);

    const decreaseTime = decrease * (maxDecreaseTime - channelCoolDown + channelCoolDown);
    return { increase: increaseTime, decrease: decreaseTime };
}
function calculateIncAndDec(
    medianMaxes: IMedianMaxes,
    assetStat: number,
    average: number
): IIncreaseDecrease {
    let increase = 0;
    let decrease = 0;
    let aboveMedian = false;
    // Get absolute difference between asset stat and average
    const difference = Math.abs(average - (assetStat - 1));
    if (assetStat > average) {
        // Above Median
        aboveMedian = true;
        increase = medianMaxes.aboveMedianMax.increase / average;
        decrease = medianMaxes.aboveMedianMax.decrease / average;
    } else {
        // Below Median
        increase = medianMaxes.belowMedianMax.increase / average;
        decrease = medianMaxes.belowMedianMax.decrease / average;
    }
    let increasePercent = increase * difference;
    let decreasePercent = decrease * difference;
    // check if the increase or decrease is greater than the max allowed
    if (aboveMedian) {
        if (increasePercent > medianMaxes.aboveMedianMax.increase) {
            increasePercent = medianMaxes.aboveMedianMax.increase;
        }
        if (decreasePercent > medianMaxes.aboveMedianMax.decrease) {
            decreasePercent = medianMaxes.aboveMedianMax.decrease;
        }
    } else {
        if (increasePercent > medianMaxes.belowMedianMax.increase) {
            increasePercent = medianMaxes.belowMedianMax.increase;
        }
        if (decreasePercent > medianMaxes.belowMedianMax.decrease) {
            decreasePercent = medianMaxes.belowMedianMax.decrease;
        }
    }
    increase = increasePercent;
    decrease = decreasePercent;
    return { increase, decrease };
}

// export async function migrateUserKarmaToStdTokenKarma(discordId: string): Promise<void> {
//     const db = container.resolve(MikroORM).em.fork();
//     const userDb = db.getRepository(User);
//     const algoWallet = db.getRepository(AlgoWallet);
//     const stdTokensDb = db.getRepository(AlgoStdToken);
//     const stdAsset = db.getRepository(AlgoStdAsset);
//     const karmaAsset = await stdAsset.getStdAssetByUnitName('KRMA');
//     const user = await userDb.getUserById(discordId);
//     if (user.karma > 0) {
//         const wallet = await algoWallet.getWalletWithGreatestTokens(discordId, 'KRMA');
//         // set the wallet's tokens to the user's karma
//         const beforeKarma = await stdTokensDb.checkIfWalletHasAssetWithUnclaimedTokens(
//             wallet,
//             karmaAsset.assetIndex
//         );
//         const tokens = await stdTokensDb.addUnclaimedTokens(
//             wallet,
//             karmaAsset.assetIndex,
//             user.karma
//         );
//         if (user.karma === tokens && !beforeKarma?.unclaimedTokens) {
//             // set the user's karma to 0
//             user.karma = 0;
//             await db.flush();
//             console.log(`Migrated ${tokens} KRMA tokens from user to wallet`);
//         } else {
//             console.log(
//                 'Failed to migrate KRMA tokens from user to wallet',
//                 'wallet address: ',
//                 wallet?.walletAddress
//             );
//             const allWallets = await algoWallet.getAllWalletsByDiscordId(discordId);
//             let walletAsset: AlgoStdToken;
//             if (allWallets.length === 1) {
//                 console.log(
//                     'User has only one wallet!',
//                     'wallet address: ',
//                     allWallets[0].walletAddress
//                 );
//                 walletAsset = await stdTokensDb.checkIfWalletHasStdAsset(
//                     allWallets[0],
//                     karmaAsset.assetIndex
//                 );
//                 console.log('loading wallet asset');
//             } else {
//                 console.log('User has more than one wallet!');
//             }

//             if (walletAsset?.unclaimedTokens >= 0) {
//                 console.log('adding tokens to wallet: ', user.karma);
//                 walletAsset.unclaimedTokens = user.karma;
//                 user.karma = 0;
//                 await db.flush();
//             } else {
//                 console.log('walletAsset is undefined');
//             }
//         }
//     }
// }
export const gamesMedianMax: IMedianMaxes = {
    aboveMedianMax: {
        increase: 0.1,
        decrease: 0,
    },
    belowMedianMax: {
        increase: 0,
        decrease: 0.1,
    },
};
export const totalWalletAssetsMedianMax: IMedianMaxes = {
    aboveMedianMax: {
        increase: 0.1,
        decrease: 0,
    },
    belowMedianMax: {
        increase: 0,
        decrease: 0.4,
    },
};
export const darumaRankMedianMax: IMedianMaxes = {
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
export const defaultGameRoundState: DarumaTrainingPlugin.GameRoundState = {
    roundIndex: 0,
    rollIndex: 0,
    playerIndex: 0,
    currentPlayer: undefined,
};

export const defaultGameWinInfo: DarumaTrainingPlugin.gameWinInfo = {
    gameWinRollIndex: 1000,
    gameWinRoundIndex: 1000,
    payout: 0,
    zen: false,
};

interface IIncreaseDecrease {
    increase: number;
    decrease: number;
}
interface IMedianMaxes {
    aboveMedianMax: IIncreaseDecrease;
    belowMedianMax: IIncreaseDecrease;
}
