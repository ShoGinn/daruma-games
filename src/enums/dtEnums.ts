type EnumKeys<Enum> = Exclude<keyof Enum, number>;

/**
 * Returns the enum as an object
 *
 * @export
 * @template Enum
 * @param {Enum} e
 * @returns {*}  {{ [K in Exclude<keyof Enum, number>]: Enum[K]; }}
 */
export function enumObject<Enum extends Record<string, number | string>>(
    e: Enum
): { [K in Exclude<keyof Enum, number>]: Enum[K] } {
    const copy = { ...e } as {
        [K in EnumKeys<Enum>]: Enum[K];
    };
    Object.values(e).forEach(value => typeof value === 'number' && delete copy[value]);
    return copy;
}

/**
 * Returns an array of the enum keys
 *
 * @export
 * @template Enum
 * @param {Enum} e
 * @returns {*}  {Exclude<keyof Enum, number>[]}
 */
export function enumKeys<Enum extends Record<string, number | string>>(
    e: Enum
): Exclude<keyof Enum, number>[] {
    return Object.keys(enumObject(e)) as EnumKeys<Enum>[];
}

/**
 * This function is used to get the values of an enum.
 *
 * @export
 * @template Enum
 * @param {Enum} e
 * @returns {*}  {Enum[Exclude<keyof Enum, number>][]}
 */
export function enumValues<Enum extends Record<string, number | string>>(
    e: Enum
): Enum[Exclude<keyof Enum, number>][] {
    return [...new Set(Object.values(enumObject(e)))] as Enum[EnumKeys<Enum>][];
}

export enum InternalUserIDs {
    creator = 1,
    botCreator = 2,
    OneVsNpc = 3,
    FourVsNpc = 4,
}

export enum GameStatus {
    waitingRoom = 'waitingRoom',
    activeGame = 'activeGame',
    win = 'win',
    finished = 'finished',
    maintenance = 'maintenance',
}

export enum GameTypes {
    OneVsNpc = 'OneVsNpc',
    OneVsOne = 'OneVsOne',
    FourVsNpc = 'FourVsNpc',
}
export enum BotNames {
    OneVsNpc = 'Karasu',
    FourVsNpc = 'Taoshin',
}
export enum GameTypesNames {
    OneVsNpc = `One vs Karasu`,
    OneVsOne = 'Player vs Player',
    FourVsNpc = `Four vs Taoshin`,
}

export enum RenderPhases {
    GIF = 'GIF',
    EMOJI = 'EMOJI',
}
export enum waitingRoomInteractionIds {
    selectPlayer = 'select-player',
    startGame = 'start-game',
    withdrawPlayer = 'withdraw-player',
    registerPlayer = 'register-player',
}

export const renderConfig: {
    [key: string]: { durMin: number; durMax: number };
} = {
    [RenderPhases.GIF]: {
        durMin: 1000,
        durMax: 3500,
    },
    [RenderPhases.EMOJI]: {
        durMin: 500,
        durMax: 500,
    },
};

export enum txnTypes {
    CLAIM = 'claim',
    TIP = 'tip',
    PENDING = 'pending',
    FAILED = 'failed',
    ARTIFACT = 'artifact',
}
export enum optimizedImages {
    SHOP = 'karma_shop',
    ARTIFACT = 'artifact',
    ENLIGHTENMENT = 'enlightenment',
}

export enum dtCacheKeys {
    RANKEDASSETS = 'rankedAssets',
    TOTALGAMES = 'totalGames',
    TOPPLAYERS = 'topPlayers',
    TOPRANK = 'topRank',
    BONUSSTATS = 'bonusStats',
}
