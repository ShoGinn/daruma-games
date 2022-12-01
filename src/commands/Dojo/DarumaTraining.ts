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
  paginatedDarumaEmbed,
  registerPlayer,
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

  public allGames: IdtGames = {}

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
        this.allGames[gameSettings.channelId] = game
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
    await paginatedDarumaEmbed(interaction, this.allGames)
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
    await registerPlayer(interaction, this.allGames)
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
    await withdrawPlayer(interaction, this.allGames)
  }
}
