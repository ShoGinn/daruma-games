import { container } from 'tsyringe';

import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.js';
import { DarumaTrainingChannel } from '../../entities/DtChannel.js';
import { Alignment, GameTypes } from '../../enums/dtEnums.js';
import TIME_UNIT from '../../enums/TIME_UNIT.js';
import { Database } from '../../services/Database.js';
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

/**
 * Takes a set length and inserts a string into said length
 * can position the string at start, middle or end
 * @export
 * @param {number} space
 * @param {Alignment} [alignment=Alignment.centered]
 * @param {string} [content='']
 * @param {boolean} emoji
 * @param {string} [delimiter]
 * @param {number} [shift=0]
 * @returns {*}  {string}
 */
export function createCell(
    space: number,
    alignment: Alignment = Alignment.centered,
    content: string = '',
    emoji: boolean,
    delimiter?: string,
    shift: number = 0
): string {
    let indexToPrintContent: number;
    // create initial space
    const whitespace = createWhitespace(space, delimiter);

    switch (alignment) {
        case Alignment.left:
            indexToPrintContent = 0;
            break;
        case Alignment.right:
            indexToPrintContent = space - content.length;
            break;
        case Alignment.centered: {
            const len = emoji ? 3 : content.length;
            const median = Math.floor(space / 2);
            indexToPrintContent = median - Math.floor(len / 2);
            break;
        }
        default:
            indexToPrintContent = 0;
    }

    return replaceAt(indexToPrintContent + shift, content, whitespace);
}

/**
 * Takes a string and replaces a character at a given index
 *
 * @param {number} index
 * @param {string} [replacement='']
 * @param {string} string
 * @returns {*}  {string}
 */
function replaceAt(index: number, replacement: string = '', string: string): string {
    return string.substring(0, index) + replacement + string.substring(index + replacement.length);
}

/**
 * Takes a number and returns a string of whitespace
 *
 * @export
 * @param {number} spaces
 * @param {string} [delimiter=' ']
 * @returns {*}  {string}
 */
export function createWhitespace(spaces: number, delimiter: string = ' '): string {
    let whitespace = '';
    for (let i = 0; i < spaces; i++) {
        whitespace += delimiter;
    }
    return whitespace;
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
    const db = container.resolve(Database);
    let allAssetRanks = await db.get(AlgoNFTAsset).assetRankingByWinsTotalGames();
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
