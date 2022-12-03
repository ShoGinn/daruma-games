import {
  AlgoNFTAsset,
  DarumaTrainingChannel,
  DtEncounters,
  User,
} from '@entities'
import { Database, Logger } from '@services'
import { Player, renderBoard } from '@utils/classes'
import {
  asyncForEach,
  defaultGameRoundState,
  defaultGameWinInfo,
  doEmbed,
  GameStatus,
  GameTypes,
  IdtPlayers,
  InternalUserIDs,
  karmaPayoutCalculator,
  randomNumber,
  renderConfig,
  RenderPhases,
  resolveDependency,
  wait,
} from '@utils/functions'
import { BaseMessageOptions, Message, Snowflake, TextChannel } from 'discord.js'
import { injectable } from 'tsyringe'

/**
 * Main game class
 */
@injectable()
export class Game {
  private _status: GameStatus
  private players: IdtPlayers
  public embed: Message
  private gameRoundState: DarumaTrainingPlugin.GameRoundState
  public hasNpc: boolean
  private logger: Logger
  public waitingRoomChannel: TextChannel
  public gameWinInfo: DarumaTrainingPlugin.gameWinInfo
  public encounterId: number
  constructor(private _settings: DarumaTrainingPlugin.ChannelSettings) {
    this.players = {}
    this.gameRoundState = defaultGameRoundState
    this.gameWinInfo = defaultGameWinInfo
    resolveDependency(Logger)
      .then(logger => {
        this.logger = logger
      })
      .catch(e => {
        throw e
      })
  }
  public get settings(): DarumaTrainingPlugin.ChannelSettings {
    return this._settings
  }
  public set settings(value: DarumaTrainingPlugin.ChannelSettings) {
    this._settings = value
  }
  public get status(): GameStatus {
    return this._status
  }
  public set status(value: GameStatus) {
    this._status = value
  }
  public async updateEmbed(): Promise<void> {
    await this.editEmbed(await doEmbed(GameStatus.waitingRoom, this))
    if (
      !(
        this.playerCount < this.settings.maxCapacity &&
        this.status === GameStatus.waitingRoom
      )
    ) {
      await this.startChannelGame()
    }
  }
  public get playerArray(): Player[] {
    return Object.values(this.players)
  }
  public get playerCount(): number {
    return Object.keys(this.players).length
  }
  getPlayer<C extends Snowflake>(discordId: C): Player | undefined {
    return this.players[discordId] || undefined
  }

  addPlayer(player: Player): void {
    if (this.playerCount < 1) {
      this.setCurrentPlayer(player, 0)
    }
    this.players[player.userClass.id] = player
  }

  removePlayers(): void {
    this.players = {}
  }

  removePlayer<C extends Snowflake>(discordId: C): void {
    if (this.players[discordId]) {
      delete this.players[discordId]
    }
  }

  async editEmbed(options: BaseMessageOptions): Promise<void> {
    if (!this.embed) {
      throw new Error('No embed stored in game')
    }
    await this.embed.edit(options)
  }

  /*
   * NPC
   */

  async addNpc() {
    const db = await resolveDependency(Database)
    const userID =
      InternalUserIDs[
        this.settings.gameType as unknown as keyof typeof InternalUserIDs
      ]?.toString()
    if (userID) {
      const user = await db.get(User).findOneOrFail({ id: userID })
      const asset = await db
        .get(AlgoNFTAsset)
        .findOneOrFail({ assetIndex: Number(userID) })
      this.addPlayer(new Player(user, asset.name, asset, true))
      this.hasNpc = true
    }
  }

  /*
   * Settings
   */

  setCurrentPlayer(player: Player, playerIndex: number): void {
    this.gameRoundState.currentPlayer = player
    this.gameRoundState.playerIndex = playerIndex
  }

  incrementRollIndex(): void {
    if (this.status !== GameStatus.win) {
      // If the roll index is divisible by 3, increment the round index
      if ((this.gameRoundState.rollIndex + 1) % 3 === 0) {
        this.gameRoundState.roundIndex++
        this.gameRoundState.rollIndex = 0
      } else {
        this.gameRoundState.rollIndex++
      }

      // handle win if win
      if (
        this.gameRoundState.currentPlayer &&
        this.gameRoundState.roundIndex === this.gameWinInfo.gameWinRoundIndex &&
        this.gameRoundState.rollIndex === this.gameWinInfo.gameWinRollIndex
      ) {
        this.status = GameStatus.win
      }
    }
  }

  /*
   * OPERATIONS
   */
  async saveEncounter(): Promise<void> {
    const db = await resolveDependency(Database)

    await asyncForEach(this.playerArray, async (player: Player) => {
      await player.userAndAssetEndGameUpdate(
        this.gameWinInfo,
        this.settings.coolDown
      )
    })
    this.encounterId = await db.get(DtEncounters).createEncounter(this)
  }
  /**
   * Compares the stored round and roll index to each players winning round and roll index
   * Stores winning players in an array
   */
  findZenAndWinners(): void {
    // Find the playerArray with both the lowest round and roll index
    this.playerArray.forEach((player: Player) => {
      const winningRollIndex = player.roundsData.gameWinRollIndex
      const winningRoundIndex = player.roundsData.gameWinRoundIndex

      if (winningRoundIndex < this.gameWinInfo.gameWinRoundIndex) {
        this.gameWinInfo.gameWinRoundIndex = winningRoundIndex
        this.gameWinInfo.gameWinRollIndex = winningRollIndex
      } else if (
        winningRoundIndex === this.gameWinInfo.gameWinRoundIndex &&
        winningRollIndex < this.gameWinInfo.gameWinRollIndex
      ) {
        this.gameWinInfo.gameWinRollIndex = winningRollIndex
      }
    })
    // Find the number of players with zen
    let zenCount = 0
    this.playerArray.forEach((player: Player) => {
      const winningRollIndex = player.roundsData.gameWinRollIndex
      const winningRoundIndex = player.roundsData.gameWinRoundIndex
      if (
        winningRollIndex === this.gameWinInfo.gameWinRollIndex &&
        winningRoundIndex === this.gameWinInfo.gameWinRoundIndex
      ) {
        player.isWinner = true
        zenCount++
      }
    })
    this.gameWinInfo.zen = zenCount > 1
    // Calculate the payout
    let karmaWinningRound = this.gameWinInfo.gameWinRoundIndex + 1
    this.gameWinInfo.payout = karmaPayoutCalculator(
      karmaWinningRound,
      this.settings.token,
      this.gameWinInfo.zen
    )
  }

  renderThisBoard(renderPhase: RenderPhases): string {
    const board = renderBoard(
      this.gameRoundState.rollIndex,
      this.gameRoundState.roundIndex,
      this.gameRoundState.playerIndex,
      this.playerArray,
      renderPhase
    )
    return board
  }
  resetGame(): void {
    this.removePlayers()
    this.gameRoundState = { ...defaultGameRoundState }
    this.gameWinInfo = { ...defaultGameWinInfo }
  }
  async startChannelGame(): Promise<void> {
    this.findZenAndWinners()
    await this.saveEncounter()
    await this.embed?.delete()
    const activeGameEmbed = await this.waitingRoomChannel.send(
      await doEmbed(GameStatus.activeGame, this)
    )
    this.settings.messageId = undefined
    await this.gameHandler().then(() => this.execWin())
    await activeGameEmbed.edit(await doEmbed(GameStatus.finished, this))
    await wait(5 * 1000).then(() => this.sendWaitingRoomEmbed())
  }

  async sendWaitingRoomEmbed(): Promise<void> {
    this.resetGame()
    await this.waitingRoomChannel.messages
      .fetch(this.settings.messageId as string)
      .catch(e => {
        this.logger.console(
          `Error when trying to fetch the message for ${this.settings.gameType} -- ${this.settings.channelId} -- Creating new message`
        )
        this.logger.console(e)
      })

    try {
      if (this.settings.messageId) {
        let waitingRoomChannel = await this.waitingRoomChannel.messages.fetch(
          this.settings.messageId
        )
        if (waitingRoomChannel) await waitingRoomChannel.delete()
      }
    } catch (e: any) {
      this.logger.console(
        `Error when trying to delete the waiting room. ${this.settings.gameType} -- ${this.settings.channelId}`
      )
      this.logger.console(e)
    }

    await this.addNpc()
    const db = await resolveDependency(Database)

    this.embed = await this.waitingRoomChannel
      ?.send(await doEmbed(GameStatus.waitingRoom, this))
      .then(msg => {
        this.settings.messageId = msg.id
        void db
          .get(DarumaTrainingChannel)
          .updateMessageId(this._settings.channelId, msg.id)
        return msg
      })
  }

  async gameHandler(): Promise<void> {
    let channelMessage: Message

    if (process.env.SKIP_BATTLE) {
      this.logger.console(
        'You are Skipping battles! Hope this is not Production',
        'warn'
      )
      await this.waitingRoomChannel.send(
        'Skipping The Battle.. because well tests'
      )
      await wait(1000).then(() => (this.status = GameStatus.finished))
    }
    await wait(1500)

    while (this.status !== GameStatus.finished) {
      const playerArr = this.playerArray

      // for each player render new board
      await asyncForEach(
        playerArr,
        async (player: Player, playerIndex: number) => {
          this.setCurrentPlayer(player, playerIndex)
          // for each render phase, pass enum to board
          for (const phase in RenderPhases) {
            const board = this.renderThisBoard(phase as RenderPhases)

            // if it's the first roll
            if (!channelMessage) {
              channelMessage = await this.waitingRoomChannel.send(board)
            } else {
              await channelMessage.edit(board)
            }
            const maxModifier =
              this.settings.gameType === GameTypes.FourVsNpc ? 2500 : 0
            await wait(
              randomNumber(
                renderConfig[phase].durMin,
                renderConfig[phase].durMax - maxModifier
              )
            )
          }
        }
      )
      if (this.status !== GameStatus.activeGame) {
        break
      }
      // proceed to next roll
      this.incrementRollIndex()
    }
  }
  /**
   * Send a winning embed for each winning player
   * @param game {Game}
   * @param channel {TextChannel}
   */
  async execWin(): Promise<void> {
    await asyncForEach(this.playerArray, async (player: Player) => {
      if (player.isWinner) {
        await this.waitingRoomChannel.send(
          await doEmbed<Player>(GameStatus.win, this, player)
        )
      }
    })
  }
}
