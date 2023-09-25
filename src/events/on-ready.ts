import { MikroORM } from '@mikro-orm/core';
import { ActivityOptions, ActivityType, Events } from 'discord.js';
import { Client, Discord, DIService, Once } from 'discordx';
import { container, injectable } from 'tsyringe';

import { DarumaTrainingManager } from '../commands/daruma-training.js';
import { Data } from '../entities/data.entity.js';
import { Schedule } from '../model/framework/decorators/schedule.js';
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
            `Logged in as ${client?.user?.tag ?? 'unk'}! (${client?.user?.id ?? 'unk'}) on ${client
                ?.guilds.cache.size} guilds!`
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
    @Schedule('*/30 * * * * *') // each 30 seconds
    changeActivity(client: Client): void {
        const activities: ActivityOptions[] = [
            { name: 'in the Dojo', type: ActivityType.Competing },
            { name: 'Chatting with the Shady Vendor', type: ActivityType.Custom },
            { name: 'Raising the Floor Price', type: ActivityType.Custom },
            { name: 'Helping ShoGinn code', type: ActivityType.Custom },
            { name: 'Flexing my Wallet', type: ActivityType.Custom },
            { name: 'Managing the guild', type: ActivityType.Custom },
            { name: 'Checking out Algodaruma.com', type: ActivityType.Custom },
        ];

        const getRandomActivity = (): ActivityOptions | undefined => {
            const validActivities = activities.filter(
                activity => activity.type !== undefined && activity.name !== undefined
            );
            if (validActivities.length === 0) {
                return { name: 'Algodaruma.com', type: ActivityType.Custom };
            }
            const randomIndex = Math.floor(Math.random() * validActivities.length);
            return validActivities[randomIndex];
        };

        const updateActivity = (): void => {
            const activity = getRandomActivity();
            client?.user?.setActivity(activity);
        };

        updateActivity(); // Set initial activity
    }
}
