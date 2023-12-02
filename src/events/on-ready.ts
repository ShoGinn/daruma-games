import { Events } from 'discord.js';

import { Client, Discord, DIService, Once } from 'discordx';

import { inject, injectable } from 'tsyringe';

import { getConfig } from '../config/config.js';
import { AppStateRepository } from '../database/app-state/app-state.repo.js';
import { DarumaTrainingManager } from '../manager/daruma-training.js';
import { InternalUserService } from '../services/internal-user.js';
import { SchedulerService } from '../services/scheduler.js';
import { GameEmojis } from '../utils/functions/dt-emojis.js';
import logger from '../utils/functions/logger-factory.js';
import { initializeWebhooks } from '../utils/functions/web-hooks.js';

@Discord()
@injectable()
export default class ReadyEvent {
  constructor(
    @inject(AppStateRepository) private appStateRepository: AppStateRepository,
    @inject(DarumaTrainingManager) private darumaTrainingManager: DarumaTrainingManager,
    @inject(InternalUserService) private internalUserService: InternalUserService,
    @inject(SchedulerService) private schedulerService: SchedulerService,
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

    this.initializeServices(client);

    logger.info(
      `Logged in as ${client?.user?.tag ?? 'unk'}! (${client?.user?.id ?? 'unk'}) on ${client
        ?.guilds.cache.size} guilds!`,
    );

    await Promise.all([
      this.checkSync(),
      this.darumaTrainingManager.startWaitingRooms(),
      GameEmojis.gatherEmojis(client),
    ]);
    // update last startup time in the database
    await this.appStateRepository.writeData('lastStartup', new Date());
  }
  private initializeServices(client: Client): void {
    this.schedulerService.init();
    initializeWebhooks(client);
  }
  private initDi(): void {
    DIService.allServices;
  }
  /**
   * Checks the synchronization of assets and wallets, and creates NPC wallets if needed.
   *
   * @returns {Promise<void>}
   */
  public async checkSync(): Promise<void> {
    const lastStartup = await this.appStateRepository.readData('lastStartup');
    // Run creatorAssetSync if the last startup was more than 24 hours ago
    if (lastStartup.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      await this.internalUserService.creatorAssetSync();
    }
  }
}
