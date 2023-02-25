export enum InternalUserIDs {
    creator = 1,
    botCreator = 2,
    reserved = 5,
}
export interface IGameNPC {
    name: string;
    gameType: GameTypes;
    assetIndex: number;
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
    withdrawPlayer = 'withdraw-player',
    registerPlayer = 'register-player',
    quickJoin = 'quick-join',
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
        durMax: 501,
    },
};

export enum optimizedImages {
    SHOP = 'karma_shop',
    ARTIFACT = 'artifact',
    ENLIGHTENMENT = 'enlightenment',
}

export enum dtCacheKeys {
    TOTAL_GAMES = 'totalGames',
    TOP_NFT_HOLDERS = 'topNftHolders',
}
export const GameNPCs: IGameNPC[] = [
    {
        name: 'Karasu',
        gameType: GameTypes.OneVsNpc,
        assetIndex: 1,
    },
    {
        name: 'Taoshin',
        gameType: GameTypes.FourVsNpc,
        assetIndex: 2,
    },
];
