declare namespace DarumaTrainingPlugin {
    interface RollData {
        roll: number | undefined;
        damage: number | undefined;
        totalScore: number;
    }
    interface RoundData {
        roundNumber: number;
        totalDamageSoFar: number;
        rolls: Array<RollData>;
    }
    interface PlayerRoundsData {
        rounds: RoundData[];
        gameWinRoundIndex: number;
        gameWinRollIndex: number;
    }
    interface Emojis {
        [key: number | string]: string;
    }

    type EmbedOptions = import('../../utils/classes/dtPlayer.js').Player;

    interface gameWinInfo {
        gameWinRoundIndex: number;
        gameWinRollIndex: number;
        zen: boolean;
        payout: number;
    }
    type IdtGames = Record<string, import('../classes/dtGame.js').Game>;

    interface ChannelSettings {
        minCapacity: number;
        maxCapacity: number;
        channelId: string;
        gameType: import('../../utils/functions/dtUtils.js').GameTypes;
        coolDown: number;
        token: channelTokenSettings;
        messageId?: string;
    }
    interface channelTokenSettings {
        baseAmount: number;
        roundModifier: number;
        zenMultiplier: number;
        zenRoundModifier: number;
    }
    interface GameRoundState {
        rollIndex: number;
        roundIndex: number;
        playerIndex: number;
        currentPlayer?: import('../../utils/classes/dtPlayer.js').Player;
    }
    interface FakeAsset {
        assetIndex: number;
        name: string;
        unitName: string;
        url: string;
    }
    interface assetNote {
        coolDown: number;
        dojoTraining: import('../../utils/functions/dtUtils.js').IGameStats;
        battleCry: string;
    }
    interface userArtifacts {
        totalPieces: number;
    }
}
