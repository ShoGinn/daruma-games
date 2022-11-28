import { ButtonComponent, Discord, Guard, On } from '@decorators'
import { DarumaTrainingChannel } from '@entities'
import { Maintenance } from '@guards'
import { Database, Logger } from '@services'
import { Game } from '@utils/classes'
import {
  asyncForEach,
  botCustomEvents,
  buildGameType,
  gatherEmojis,
  IdtGames,
  registerPlayer,
  resolveUser,
  selectPlayableAssets,
  waitingRoomInteractionIds,
  withdrawPlayer,
} from '@utils/functions'
import { ButtonInteraction, TextChannel } from 'discord.js'
import { Client } from 'discordx'
import { delay, inject, injectable, singleton } from 'tsyringe'

@Discord()
@injectable()
@singleton()
export class DarumaTrainingManager {
  constructor(
    @inject(delay(() => Client)) private client: Client,
    @inject(delay(() => Database)) private db: Database,
    @inject(delay(() => Logger)) private logger: Logger
  ) {}

  private _games: IdtGames = {}

  @On(botCustomEvents.startWaitingRooms)
  async startWaitingRooms(_client: Client): Promise<void> {
    gatherEmojis(this.client)
    const gameChannels = await this.db
      .get(DarumaTrainingChannel)
      .getAllChannels()
    await asyncForEach(
      gameChannels,
      async (channelSettings: DarumaTrainingChannel) => {
        const gameSettings = buildGameType(channelSettings)
        const game = new Game(gameSettings)
        await this.start(game)
        this._games[gameSettings.channelId] = game
      }
    )
  }
  /**
   * Start game waiting room
   * @param channel {TextChannel}
   */
  async start(game: Game): Promise<void> {
    game.waitingRoomChannel = this.client.channels.cache.get(
      game.settings.channelId
    ) as TextChannel

    await this.logger.log(
      `Joining the Channel ${game.settings.channelId} of type ${game.settings.gameType}.`
    )
    await game.sendWaitingRoomEmbed()
  }

  /**
   * Clicking the button will select the player's asset
   *
   * @param {ButtonInteraction} interaction
   * @memberof DarumaTrainingManager
   */
  @Guard(Maintenance)
  @ButtonComponent({ id: waitingRoomInteractionIds.selectPlayer })
  async selectPlayer(interaction: ButtonInteraction) {
    const discordUser = resolveUser(interaction)?.id ?? ' '
    await selectPlayableAssets(interaction, discordUser, this._games)
  }

  /**
   * Clicking the button will select the player's asset
   *
   * @param {ButtonInteraction} interaction
   * @memberof DarumaTrainingManager
   */
  @Guard(Maintenance)
  @ButtonComponent({ id: /((daruma-select_)[^\s]*)\b/gm })
  async selectAsset(interaction: ButtonInteraction) {
    await registerPlayer(interaction, this._games)
  }
  /**
   * Clicking the button will withdraw the player's asset from the game
   *
   * @param {ButtonInteraction} interaction
   * @memberof DarumaTrainingManager
   */
  @Guard(Maintenance)
  @ButtonComponent({ id: waitingRoomInteractionIds.withdrawPlayer })
  async withdrawPlayer(interaction: ButtonInteraction) {
    await withdrawPlayer(interaction, this._games)
  }

  /**
   * Clicking the button will start the game
   *
   * @param {ButtonInteraction} interaction
   * @memberof DarumaTrainingManager
   */
  @Guard(Maintenance)
  @ButtonComponent({ id: waitingRoomInteractionIds.startGame })
  async startGame(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true })
    //const discordUser = resolveUser(interaction)?.id ?? ' '
    //const user = await this.db.get(User).getUserById(discordUser)
    await interaction.followUp(
      `You Pressed ${interaction.customId}\n This feature is not yet implemented.`
    )
  }
}
