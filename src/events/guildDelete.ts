import { Discord, On } from '@decorators'
import { syncGuild } from '@utils/functions'
import { Events } from 'discord.js'
import { ArgsOf, Client } from 'discordx'

@Discord()
export default class GuildDeleteEvent {
  @On(Events.GuildDelete)
  async guildDeleteHandler(
    [oldGuild]: ArgsOf<Events.GuildDelete>,
    client: Client
  ) {
    await syncGuild(oldGuild.id, client)
  }
}
