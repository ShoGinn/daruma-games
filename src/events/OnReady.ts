import { MikroORM } from '@mikro-orm/core';
import { Events } from 'discord.js';
import { Client, Discord, DIService, Once } from 'discordx';
import { container, injectable } from 'tsyringe';

import { DarumaTrainingManager } from '../commands/DarumaTraining.js';
import { Data } from '../entities/Data.entity.js';
import { Property } from '../model/framework/decorators/Property.js';
import { AssetSyncChecker } from '../model/logic/assetSyncChecker.js';
import { gatherEmojis } from '../utils/functions/dtEmojis.js';
import logger from '../utils/functions/LoggerFactory.js';
import { syncAllGuilds } from '../utils/functions/synchronizer.js';
import { getWebhooks } from '../utils/functions/WebHooks.js';

@Discord()
@injectable()
export default class ReadyEvent {
    constructor(private orm: MikroORM) {}

    @Property('NODE_ENV')
    private readonly environment: NodeJS.ProcessEnv['NODE_ENV'];

    public initAppCommands(client: Client): Promise<void> {
        if (this.environment === 'production') {
            return client.initGlobalApplicationCommands();
        }
        return client.initApplicationCommands();
    }

    @Once({ event: Events.ClientReady })
    async readyHandler([client]: [Client]): Promise<void> {
        this.initDi();
        await this.initAppCommands(client);
        // make sure all guilds are cached
        await client.guilds.fetch();
        getWebhooks(client);
        logger.info(
            `Logged in as ${client?.user?.tag}! (${client?.user?.id}) on ${client?.guilds.cache.size} guilds!`
        );

        // update last startup time in the database
        const em = this.orm.em.fork();
        await em.getRepository(Data).set('lastStartup', Date.now());

        // synchronize guilds between discord and the database
        await syncAllGuilds(client);

        // Custom event emitter to notify that the bot is ready
        const waitingRoom = container.resolve(DarumaTrainingManager);
        const assetSync = container.resolve(AssetSyncChecker);
        await Promise.all([
            assetSync.check(),
            waitingRoom.startWaitingRooms(),
            gatherEmojis(client),
        ]);
    }
    private initDi(): void {
        DIService.allServices;
    }
}
