declare namespace DarumaTrainingPlugin {
  interface RollData {
    roll: number | undefined
    damage: number | undefined
    totalScore: number
  }
  interface RoundData {
    roundNumber: number
    totalDamageSoFar: number
    rolls: Array<RollData>
  }
  interface PlayerRoundsData {
    rounds: RoundData[]
    gameWinRoundIndex: number
    gameWinRollIndex: number
  }
  interface Emojis {
    [key: number | string]: string
  }

  type EmbedOptions = import('@utils/classes').Player

  interface ChannelSettings {
    minCapacity: number
    maxCapacity: number
    channelId: string
    gameType: import('@utils/functions').GameTypes
    coolDown: number
    token: {
      baseAmount: number
      roundModifier: number
      zenMultiplier: number
      zenRoundModifier: number
    }
    messageId?: string
  }
  interface GameRoundState {
    rollIndex: number
    roundIndex: number
    playerIndex: number
    currentPlayer?: import('@utils/classes').Player
  }
  interface FakeAsset {
    assetIndex: number
    name: string
    unitName: string
    url: string
  }
  interface assetNote {
    coolDown?: number
    dojoTraining?: import('@utils/functions').IGameStats
  }
}
