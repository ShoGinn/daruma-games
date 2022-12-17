import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.js';
import { DarumaTrainingChannel } from '../../entities/DtChannel.js';
import { GameTypes } from '../../enums/dtEnums.js';
import TIME_UNIT from '../../enums/TIME_UNIT.js';
import { Player } from '../classes/dtPlayer.js';
import { ObjectUtil } from '../Utils.js';

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 *
 * @export
 * @param {number} min
 * @param {number} max
 * @returns {*}  {number}
 */
export function randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
}

export function buildGameType(
    darumaTrainingChannel: DarumaTrainingChannel
): DarumaTrainingPlugin.ChannelSettings {
    // Default settings
    let defaults: DarumaTrainingPlugin.ChannelSettings = {
        minCapacity: 0,
        maxCapacity: 0,
        channelId: darumaTrainingChannel.channelId,
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
    let channelOverrides: Partial<DarumaTrainingPlugin.ChannelSettings> = {};
    if (darumaTrainingChannel.overRides) {
        channelOverrides = darumaTrainingChannel.overRides;
    }

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
            defaults.coolDown = ObjectUtil.convertToMilli(1, TIME_UNIT.hours);
            defaults.token.baseAmount = 10;
            defaults.token.zenMultiplier = 3.5;
            break;
    }
    return {
        ...defaults,
        ...channelOverrides,
    };
}
export function assetNoteDefaults(): DarumaTrainingPlugin.assetNote {
    let defaults: DarumaTrainingPlugin.assetNote = {
        coolDown: 0,
        dojoTraining: {
            wins: 0,
            losses: 0,
            zen: 0,
        },
        battleCry: '',
    };
    return defaults;
}

export function karmaShopDefaults(): DarumaTrainingPlugin.karmaShop {
    let defaults: DarumaTrainingPlugin.karmaShop = {
        totalPieces: 0,
        totalEnlightened: 0,
    };
    return defaults;
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
    let allAssetRanks = await db.getRepository(AlgoNFTAsset).assetRankingByWinsTotalGames();
    let currentRank = allAssetRanks.findIndex(
        (rankedAsset: AlgoNFTAsset) => rankedAsset.assetIndex === asset.assetIndex
    );
    return {
        currentRank: (currentRank + 1).toLocaleString(),
        totalAssets: allAssetRanks.length.toLocaleString(),
    };
}
export function coolDownsDescending(assets: AlgoNFTAsset[]): AlgoNFTAsset[] {
    // remove assets that are not in cool down
    let assetsInCoolDown = assets.filter(asset => {
        return (asset.assetNote?.coolDown || 0) > Date.now();
    });
    return assetsInCoolDown.sort((a, b) => {
        let bCooldown = b.assetNote?.coolDown || 0;
        let aCooldown = a.assetNote?.coolDown || 0;
        return bCooldown - aCooldown;
    });
}
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

export interface IdtPlayers {
    [key: string]: Player;
}

export interface IGameStats {
    wins: number;
    losses: number;
    zen: number;
}
