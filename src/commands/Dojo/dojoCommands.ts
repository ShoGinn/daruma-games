import { Discord, Slash, SlashGroup, SlashOption } from '@decorators'
import { Category, EnumChoice, PermissionGuard } from '@discordx/utilities'
import { DarumaTrainingChannel } from '@entities'
import { Guard } from '@guards'
import { Database } from '@services'
import {
  botCustomEvents,
  GameTypes,
  onlyDigits,
  resolveDependency,
} from '@utils/functions'
import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js'
import { Client, SlashChoice } from 'discordx'
import { injectable } from 'tsyringe'

@Discord()
@injectable()
@Category('Admin')
@SlashGroup({ description: 'Dojo Commands', name: 'dojo' })
export default class DojoCommand {
  constructor(private db: Database) {}

  @Guard(PermissionGuard(['Administrator']))
  @Slash({
    name: 'join',
    description: 'Have the bot join a dojo channel!',
  })
  @Guard()
  @SlashGroup('dojo')
  async join(
    @SlashOption({
      description: 'Channel to join',
      name: 'channel',
      required: true,
      type: ApplicationCommandOptionType.Channel,
    })
    channelName: string,
    @SlashChoice(...EnumChoice(GameTypes))
    @SlashOption({
      description: 'Game type',
      name: 'game_type',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    channelType: GameTypes,
    interaction: CommandInteraction
  ) {
    let client = await resolveDependency(Client)
    // Remove all but digits from channel name
    const channelId = onlyDigits(channelName.toString())
    await this.db.get(DarumaTrainingChannel).addChannel(channelId, channelType)
    client.emit(botCustomEvents.startWaitingRooms, client)
    await interaction.followUp(
      `Joined ${channelName}, with the default settings!`
    )
  }
}
