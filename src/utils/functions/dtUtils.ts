import { AlgoNFTAsset, DarumaTrainingChannel } from '@entities'
import { Database } from '@services'
import { Game, Player } from '@utils/classes'
import { Alignment, GameTypes, resolveDependency } from '@utils/functions'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 *
 * @export
 * @param {number} min
 * @param {number} max
 * @returns {*}  {number}
 */
export function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min)
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
  content = '',
  emoji: boolean,
  delimiter?: string,
  shift = 0
): string {
  let indexToPrintContent
  // create initial space
  const whitespace = createWhitespace(space, delimiter)

  switch (alignment) {
    case Alignment.left:
      indexToPrintContent = 0
      break
    case Alignment.right:
      indexToPrintContent = space - content.length
      break
    case Alignment.centered: {
      const len = emoji ? 3 : content.length
      const median = Math.floor(space / 2)
      indexToPrintContent = median - Math.floor(len / 2)
      break
    }
    default:
      indexToPrintContent = 0
  }

  return replaceAt(indexToPrintContent + shift, content, whitespace)
}

/**
 * Takes a string and replaces a character at a given index
 *
 * @param {number} index
 * @param {string} [replacement='']
 * @param {string} string
 * @returns {*}  {string}
 */
function replaceAt(index: number, replacement = '', string: string): string {
  return (
    string.substring(0, index) +
    replacement +
    string.substring(index + replacement.length)
  )
}

/**
 * Takes a number and returns a string of whitespace
 *
 * @export
 * @param {number} spaces
 * @param {string} [delimiter=' ']
 * @returns {*}  {string}
 */
export function createWhitespace(spaces: number, delimiter = ' '): string {
  let whitespace = ''
  for (let i = 0; i < spaces; i++) {
    whitespace += delimiter
  }
  return whitespace
}

/**
 * Provides a async for loop
 *
 * @export
 * @param {Array<any>} array
 * @param {Function} callback
 * @returns {*}  {Promise<void>}
 */
export async function asyncForEach(
  array: Array<any>,
  // eslint-disable-next-line @typescript-eslint/ban-types
  callback: Function
): Promise<void> {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

/**
 * Waits for a given amount of time
 *
 * @export
 * @param {number} duration
 * @returns {*}  {Promise<void>}
 */
export async function wait(duration: number): Promise<void> {
  await new Promise(res => {
    setTimeout(res, duration)
  })
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
    coolDown: hourToMS(6),
    token: {
      baseAmount: 20,
      roundModifier: 5,
      zenMultiplier: 1.5,
      zenRoundModifier: 0.5,
    },
  }
  let channelOverrides: Partial<DarumaTrainingPlugin.ChannelSettings> = {}
  if (darumaTrainingChannel.overRides) {
    channelOverrides = darumaTrainingChannel.overRides
  }

  switch (darumaTrainingChannel.gameType) {
    case GameTypes.OneVsNpc:
      defaults.minCapacity = 2
      defaults.maxCapacity = 2
      break
    case GameTypes.OneVsOne:
      defaults.minCapacity = 2
      defaults.maxCapacity = 2
      break
    case GameTypes.FourVsNpc:
      defaults.minCapacity = 5
      defaults.maxCapacity = 5
      defaults.coolDown = hourToMS(1)
      defaults.token.baseAmount = 10
      defaults.token.zenMultiplier = 3.5
      break
  }
  return {
    ...defaults,
    ...channelOverrides,
  }
}
export function assetNoteDefaults() {
  let defaults: DarumaTrainingPlugin.assetNote = {
    coolDown: 0,
    dojoTraining: {
      wins: 0,
      losses: 0,
      zen: 0,
    },
    battleCry: '',
  }
  return defaults
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
  const baseAmount = tokenSettings.baseAmount
  const roundModifier = tokenSettings.roundModifier
  const zenMultiplier2 = tokenSettings.zenMultiplier
  const zenRoundModifier = tokenSettings.zenRoundModifier

  const roundMultiplier = Math.max(1, winningRound - 4) - 1
  const zenMultiplier = zenRoundModifier * roundMultiplier + zenMultiplier2
  const roundPayout = roundMultiplier * roundModifier + baseAmount
  const zenPayout = roundPayout * zenMultiplier
  if (zen) {
    return zenPayout
  }
  return roundPayout
}

export function hourToMS(hours: number) {
  dayjs.extend(duration)
  return dayjs.duration(hours, 'hour').asMilliseconds()
}

export function msToHour(ms: number) {
  dayjs.extend(duration)
  return dayjs.duration(ms, 'ms').asHours()
}

export function timeFromNow(ms: number) {
  dayjs.extend(relativeTime)
  return dayjs(ms).fromNow()
}
export async function assetCurrentRankFromDB(asset: AlgoNFTAsset) {
  const db = await resolveDependency(Database)
  let allAssetRanks = await db.get(AlgoNFTAsset).assetRankingsByWins()
  let currentRank = allAssetRanks.findIndex(
    (rankedAsset: AlgoNFTAsset) => rankedAsset.assetIndex === asset.assetIndex
  )
  return currentRank + 1
}
export function assetsRankings(game: Game) {
  game.playerArray.forEach(player => {
    let currentRank = game.assetRankings.findIndex(
      (rankedAsset: AlgoNFTAsset) =>
        rankedAsset.assetIndex === player.asset.assetIndex
    )
    return (player.assetRank = currentRank + 1)
  })
}
export function coolDownsDescending(assets: AlgoNFTAsset[]) {
  // remove assets that are not in cool down
  let assetsInCoolDown = assets.filter(asset => {
    return (asset.assetNote?.coolDown || 0) > Date.now()
  })
  return assetsInCoolDown.sort((a, b) => {
    let bCooldown = b.assetNote?.coolDown || 0
    let aCooldown = a.assetNote?.coolDown || 0
    return bCooldown - aCooldown
  })
}
export const defaultGameRoundState: DarumaTrainingPlugin.GameRoundState = {
  roundIndex: 0,
  rollIndex: 0,
  playerIndex: 0,
  currentPlayer: undefined,
}

export const defaultGameWinInfo: DarumaTrainingPlugin.gameWinInfo = {
  gameWinRollIndex: 1000,
  gameWinRoundIndex: 1000,
  payout: 0,
  zen: false,
}

export interface IdtGames {
  [key: string]: Game
}
export interface IdtPlayers {
  [key: string]: Player
}

export interface IdtAssetRounds {
  [key: string]: DarumaTrainingPlugin.PlayerRoundsData
}
export interface IGameStats {
  wins: number
  losses: number
  zen: number
}
