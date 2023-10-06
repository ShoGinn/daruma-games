import { Events } from 'discord.js';
import { Client, Discord, On } from 'discordx';
import type { ArgsOf } from 'discordx';

import { syncGuild } from '../utils/functions/synchronizer.js';

@Discord()
export default class GuildDeleteEvent {
  @On({ event: Events.GuildDelete })
  async guildDeleteHandler([oldGuild]: ArgsOf<Events.GuildDelete>, client: Client): Promise<void> {
    await syncGuild(oldGuild.id, client);
  }
}
