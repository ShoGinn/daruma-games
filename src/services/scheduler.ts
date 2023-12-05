import { ActivityOptions, ActivityType } from 'discord.js';

import { Client, Guard } from 'discordx';

import { inject, injectable, singleton } from 'tsyringe';

import { karmaAutoClaimAmounts } from '../core/constants.js';
import { RunEvery } from '../decorators/run-every.js';
import { Schedule } from '../decorators/schedule.js';
import MethodExecutorTimeUnit from '../enums/method-executor-time-unit.js';
import { GameAssetsNeeded } from '../guards/game-assets-needed.js';
import { RandomUtils } from '../utils/classes/random-utils.js';
import logger from '../utils/functions/logger-factory.js';

import { AlgoNFTAssetService } from './algo-nft-assets.js';
import { GameAssets } from './game-assets.js';
import { InternalUserService } from './internal-user.js';
import { RewardsService } from './rewards.js';

@singleton()
@injectable()
export class SchedulerService {
  constructor(
    @inject(AlgoNFTAssetService) private algoNFTAssetService: AlgoNFTAssetService,
    @inject(InternalUserService) private internalUserService: InternalUserService,
    @inject(GameAssets) private gameAssets: GameAssets,
    @inject(RewardsService) private rewardsService: RewardsService,
  ) {}
  public init(): void {
    logger.info('Initializing SchedulerService');
  }

  // public async resetEncounters(): Promise<void> {
  //   const encounters = await this.dtEncountersService.getAll();
  //   logger.info(`Resetting the Encounters`);
  //   const results = processEncounters(encounters);
  //   logger.info(`Saving Encounters`);
  //   await this.algoNFTAssetService.setDojoStatsForManyAssets(results);
  //   logger.info(`Encounters Saved`);
  // }
  /**
   * Runs creator asset sync.
   *
   * @returns {Promise<void>}
   */
  @Schedule('0 0 * * *')
  public async runCreatorAssetSync(): Promise<void> {
    await this.internalUserService.creatorAssetSync();
  }
  /**
   * Runs user asset sync.
   *
   * @returns {Promise<void>}
   */
  @RunEvery(6, MethodExecutorTimeUnit.hours)
  public async runUserAssetSync(): Promise<void> {
    await this.algoNFTAssetService.updateOwnerWalletsOnCreatorAssets();
  }
  // Scheduled the first day of the month at 1am
  @Schedule('0 1 1 * *')
  @Guard(GameAssetsNeeded)
  async monthlyClaim(): Promise<void> {
    logger.info('Monthly Claim Started');
    const walletsWithUnclaimedAssets = await this.rewardsService.fetchWalletsWithUnclaimedAssets(
      karmaAutoClaimAmounts.monthly,
      this.gameAssets.karmaAsset,
    );
    await this.rewardsService.batchTransActionProcessor(
      walletsWithUnclaimedAssets,
      this.gameAssets.karmaAsset,
    );
    logger.info('Monthly Claim Finished');
  }
  // Scheduled at 2am every day
  @Schedule('0 2 * * *')
  @Guard(GameAssetsNeeded)
  async dailyClaim(): Promise<void> {
    logger.info('Daily Claim Started');
    const walletsWithUnclaimedAssets = await this.rewardsService.fetchWalletsWithUnclaimedAssets(
      karmaAutoClaimAmounts.daily,
      this.gameAssets.karmaAsset,
    );

    await this.rewardsService.batchTransActionProcessor(
      walletsWithUnclaimedAssets,
      this.gameAssets.karmaAsset,
    );
    logger.info('Daily Claim Finished');
  }
  // Scheduled at 3am every day
  @Schedule('0 3 * * *')
  @Guard(GameAssetsNeeded)
  async checkGameAssetAmounts(client: Client): Promise<void> {
    await this.gameAssets.checkAlgoNetworkBalances(client);
  }

  @Schedule('*/30 * * * * *') // each 30 seconds)
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
