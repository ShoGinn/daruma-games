import { Player } from '../utils/classes/dt-player.js';

export enum InternalUserIDs {
    creator = 1,
    botCreator = 2,
    reserved = 5,
}
export const internalUsernames = {
    [InternalUserIDs.creator]: 'Creator',
    [InternalUserIDs.botCreator]: 'Bot Creator',
    [InternalUserIDs.reserved]: 'Reserved',
};
export interface IGameNPC {
    name: string;
    gameType: GameTypes;
    assetIndex: number;
}
export interface IGameBoardRender {
    players?: Array<Player>;
    roundState: {
        rollIndex: number;
        roundIndex: number;
        playerIndex: number;
        phase: RenderPhase;
    };
}
export interface IGameTurnState {
    isTurn: boolean;
    hasBeenTurn: boolean;
    notTurnYet: boolean;
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

export const GIF_RENDER_PHASE = 'gif';
export const EMOJI_RENDER_PHASE = 'emoji';
export const renderPhasesArray: RenderPhase[] = [GIF_RENDER_PHASE, EMOJI_RENDER_PHASE];
export type RenderPhase = typeof GIF_RENDER_PHASE | typeof EMOJI_RENDER_PHASE;

export enum WaitingRoomInteractionIds {
    withdrawPlayer = 'withdraw-player',
    registerPlayer = 'register-player',
    quickJoin = 'quick-join',
}
export const defaultDelayTimes: { [key: string]: number } = {
    minTime: 1000,
    maxTime: 1000,
};
export const renderConfig: Record<RenderPhase, { durMin: number; durMax: number }> = {
    gif: {
        durMin: 1000,
        durMax: 3500,
    },
    emoji: {
        durMin: 500,
        durMax: 500,
    },
};

export enum OptimizedImages {
    SHOP = 'karma_shop',
    ARTIFACT = 'artifact',
    ENLIGHTENMENT = 'enlightenment',
}

export enum DarumaTrainingCacheKeys {
    TOTAL_GAMES = 'totalGames',
    TOP_NFT_HOLDERS = 'topNftHolders',
}
export const gameNPCs: IGameNPC[] = [
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
