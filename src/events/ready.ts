import { Events } from 'discord.js';
import { Client, Discord, Once } from 'discordx';
import { injectable } from 'tsyringe';

import { Data } from '../entities/Data.js';
import { botCustomEvents } from '../enums/dtEnums.js';
import { Database } from '../services/Database.js';
import { Scheduler } from '../services/Scheduler.js';
import { syncAllGuilds } from '../utils/functions/synchronizer.js';

@Discord()
@injectable()
export default class ReadyEvent {
    constructor(private db: Database, private scheduler: Scheduler) {}

    private activityIndex = 0;

    @Once({ event: Events.ClientReady })
    async readyHandler([client]: [Client]): Promise<void> {
        // make sure all guilds are cached
        await client.guilds.fetch();

        // synchronize applications commands with Discord
        await client.initApplicationCommands({
            global: {
                disable: {
                    delete: false,
                },
            },
            guild: {},
        });

        // synchronize applications command permissions with Discord
        /**
         * ************************************************************
         * Discord has deprecated permissions v1 api in favour permissions v2, await future updates
         * see https://github.com/discordjs/discord.js/pull/7857
         * ************************************************************
         */
        //await client.initApplicationPermissions(false)

        // update last startup time in the database
        await this.db.get(Data).set('lastStartup', Date.now());

        // start scheduled jobs
        this.scheduler.startAllJobs();

        // synchronize guilds between discord and the database
        await syncAllGuilds(client);

        // Custom event emitter to notify that the bot is ready
        client.emit(botCustomEvents.botLoaded, client);
    }
}
