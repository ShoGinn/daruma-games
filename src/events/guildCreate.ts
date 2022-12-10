import { Events } from 'discord.js';
import { ArgsOf, Client, Discord, On } from 'discordx';

import { syncGuild } from '../utils/functions/synchronizer.js';

@Discord()
export default class GuildCreateEvent {
    @On({ event: Events.GuildCreate })
    async guildCreateHandler(
        [newGuild]: ArgsOf<Events.GuildCreate>,
        client: Client
    ): Promise<void> {
        await syncGuild(newGuild.id, client);
    }
}
