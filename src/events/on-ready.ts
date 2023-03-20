import { MikroORM } from '@mikro-orm/core';
import { Events } from 'discord.js';
import { Client, Discord, DIService, Once } from 'discordx';
import { container, injectable } from 'tsyringe';

import { DarumaTrainingManager } from '../commands/daruma-training.js';
import { Data } from '../entities/data.entity.js';
import { SystemProperty } from '../model/framework/decorators/system-property.js';
import { AssetSyncChecker } from '../model/logic/asset-sync-checker.js';
import { gatherEmojis } from '../utils/functions/dt-emojis.js';
import logger from '../utils/functions/logger-factory.js';
import { syncAllGuilds } from '../utils/functions/synchronizer.js';
import { getWebhooks } from '../utils/functions/web-hooks.js';

@Discord()
@injectable()
export default class ReadyEvent {
    constructor(private orm: MikroORM) {}

    @SystemProperty('NODE_ENV')
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
            `Logged in as ${client?.user?.tag ?? 'unk'}! (${client?.user?.id ?? 'unk'}) on ${
                client?.guilds.cache.size
            } guilds!`
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
            assetSync.checkIfAllAssetsAreSynced(),
            waitingRoom.startWaitingRooms(),
            gatherEmojis(client),
        ]);
    }
    private initDi(): void {
        DIService.allServices;
    }
}
