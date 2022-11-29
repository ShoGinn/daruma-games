import {
  AlgoNFTAsset,
  DarumaTrainingChannel,
  DtEncounters,
  User,
} from '@entities'
import { Database, Logger } from '@services'
import { Player, renderBoard } from '@utils/classes'
import {
  assetsRankings,
  asyncForEach,
  defaultGameRoundState,
  doEmbed,
  GameStatus,
  IdtPlayers,
  InternalUserIDs,
  karmaPayout,
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
  private winningRoundIndex: number | undefined
  private winningRollIndex: number | undefined
  public embed: Message | undefined
  private gameRoundState: DarumaTrainingPlugin.GameRoundState
  public hasNpc: boolean | undefined
  private logger: Logger
  public waitingRoomChannel: TextChannel
  public payout: number
  public zen: boolean = false
  public assetRankings: AlgoNFTAsset[]
  constructor(private _settings: DarumaTrainingPlugin.ChannelSettings) {
    this.players = {}
    this.gameRoundState = defaultGameRoundState
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
    await this.editEmbed(doEmbed(GameStatus.waitingRoom, this))
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
    // update games winning index
    const { gameWinRollIndex, gameWinRoundIndex } = player.roundsData

    this.compareAndSetWinningIndexes(gameWinRollIndex, gameWinRoundIndex)
  }

  removePlayers(): void {
    this.players = {}
  }

  removePlayer<C extends Snowflake>(discordId: C): void {
    if (this.players[discordId]) {
      delete this.players[discordId]
    }
  }

  /*
   * Active
   */

  /**
   * Compare joining users win indexes and assign then to game if lowest
   * Also assign winning discord Id to game
   * @param rollIndex
   * @param roundIndex
   * @param player
   */
  compareAndSetWinningIndexes(rollIndex: number, roundIndex: number): void {
    // if no winning indexes set yet
    if (
      this.winningRollIndex === undefined ||
      this.winningRoundIndex === undefined
    ) {
      this.winningRollIndex = rollIndex
      this.winningRoundIndex = roundIndex
      // if the incoming round index is lower than the current round index, change it
    } else if (this.winningRoundIndex && roundIndex < this.winningRoundIndex) {
      this.winningRollIndex = rollIndex
      this.winningRoundIndex = roundIndex
      // if the round index is the same, but the roll index is lower, change it
    } else if (
      this.winningRollIndex &&
      roundIndex === this.winningRoundIndex &&
      rollIndex < this.winningRollIndex
    ) {
      this.winningRollIndex = rollIndex
      this.winningRoundIndex = roundIndex
    }
  }

  /*
   * Update
   */

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
        this.gameRoundState.roundIndex === this.winningRoundIndex &&
        this.gameRoundState.rollIndex === this.winningRollIndex
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
    this.storeWinningPlayers()
    if (this.winningRoundIndex) {
      const karmaWinningRound = this.winningRoundIndex + 1
      this.payout = karmaPayout(karmaWinningRound, this.settings, this.zen)
    }

    await asyncForEach(this.playerArray, async (player: Player) => {
      await player.doEndOfGameMutation(this)
    })
    await db.get(DtEncounters).createEncounter(this)
    await this.updateRankings()
  }
  async updateRankings(): Promise<void> {
    const db = await resolveDependency(Database)
    this.assetRankings = await db.get(AlgoNFTAsset).winningAssetRankings()
    assetsRankings(this)
  }
  /**
   * Compares the stored round and roll index to each players winning round and roll index
   * Stores winning players in an array
   */
  storeWinningPlayers(): void {
    if (
      this.winningRollIndex === undefined ||
      this.winningRoundIndex === undefined
    ) {
      return
    }
    let zenCount = 0
    this.playerArray.forEach((player: Player) => {
      const winningRollIndex = player.roundsData.gameWinRollIndex
      const winningRoundIndex = player.roundsData.gameWinRoundIndex

      if (
        winningRollIndex === this.winningRollIndex &&
        winningRoundIndex === this.winningRoundIndex
      ) {
        player.isWinner = true
        zenCount++
      }
    })
    this.zen = zenCount > 1
  }

  renderThisBoard(renderPhase: RenderPhases): string {
    const board = renderBoard(
      this.gameRoundState.rollIndex,
      this.gameRoundState.roundIndex,
      this.gameRoundState.playerIndex,
      this.playerArray,
      renderPhase
      // isLastRender
    )
    return board
  }

  resetGame(): void {
    this.embed = undefined
    this.removePlayers()
    this.gameRoundState = { ...defaultGameRoundState }
    this.winningRoundIndex = undefined
    this.winningRollIndex = undefined
  }
  async startChannelGame(): Promise<void> {
    await this.saveEncounter()
    await this.embed?.delete()
    const activeGameEmbed = await this.waitingRoomChannel.send(
      doEmbed(GameStatus.activeGame, this)
    )
    this.settings.messageId = undefined
    await this.gameHandler().then(() => this.execWin())
    await activeGameEmbed.edit(doEmbed(GameStatus.finished, this))
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
      ?.send(doEmbed(GameStatus.waitingRoom, this))
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
            await wait(
              randomNumber(
                renderConfig[phase].durMin,
                renderConfig[phase].durMax
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
          doEmbed<Player>(GameStatus.win, this, player)
        )
      }
    })
  }
}
