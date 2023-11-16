import { ActivityOptions, ActivityType, Events } from 'discord.js';

import { Client, Discord, DIService, Once } from 'discordx';

import { inject, injectable } from 'tsyringe';

import { DarumaTrainingManager } from '../commands/daruma-training.js';
import { getConfig } from '../config/config.js';
import { AppStateRepository } from '../database/app-state/app-state.repo.js';
import { Schedule } from '../decorators/schedule.js';
import { AssetSyncChecker } from '../services/asset-sync-checker.js';
import { GameEmojis } from '../utils/functions/dt-emojis.js';
import logger from '../utils/functions/logger-factory.js';
import { getWebhooks } from '../utils/functions/web-hooks.js';
import { RandomUtils } from '../utils/utils.js';

@Discord()
@injectable()
export default class ReadyEvent {
  constructor(
    @inject(AppStateRepository) private appStateRepository: AppStateRepository,
    @inject(AssetSyncChecker) private assetSync: AssetSyncChecker,
    @inject(DarumaTrainingManager) private darumaTrainingManager: DarumaTrainingManager,
  ) {}

  public initAppCommands(client: Client): Promise<void> {
    if (getConfig().get('nodeEnv') === 'production') {
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
        ?.guilds.cache.size} guilds!`,
    );

    // Custom event emitter to notify that the bot is ready
    await Promise.all([
      this.assetSync.checkIfAllAssetsAreSynced(),
      this.darumaTrainingManager.startWaitingRooms(),
      GameEmojis.gatherEmojis(client),
    ]);
    // update last startup time in the database
    await this.appStateRepository.writeData('lastStartup', new Date());
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
        (activity) => activity.type !== undefined && activity.name !== undefined,
      );
      if (validActivities.length === 0) {
        return { name: 'Algodaruma.com', type: ActivityType.Custom };
      }
      return RandomUtils.random.pick(validActivities);
    };

    const updateActivity = (): void => {
      const activity = getRandomActivity();
      client?.user?.setActivity(activity);
    };

    updateActivity(); // Set initial activity
  }
}
