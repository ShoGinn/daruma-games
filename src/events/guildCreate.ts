import { Discord, On } from '@decorators'
import { syncGuild } from '@utils/functions'
import { Events } from 'discord.js'
import { ArgsOf, Client } from 'discordx'

@Discord()
export default class GuildCreateEvent {
  @On(Events.GuildCreate)
  async guildCreateHandler(
    [newGuild]: ArgsOf<Events.GuildCreate>,
    client: Client
  ) {
    await syncGuild(newGuild.id, client)
  }
}
