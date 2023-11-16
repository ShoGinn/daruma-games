/* istanbul ignore file: We run tests on the individual functions but this is used to schedule in a class  */
import { inject, injectable, singleton } from 'tsyringe';

import { AppStateRepository } from '../database/app-state/app-state.repo.js';
import { RunEvery } from '../decorators/run-every.js';
import { Schedule } from '../decorators/schedule.js';
import MethodExecutorTimeUnit from '../enums/method-executor-time-unit.js';

import { AlgoNFTAssetService } from './algo-nft-assets.js';
import { InternalUserService } from './internal-user.js';

/**
 * This class checks the synchronization of assets and wallets, and creates NPC wallets if needed.
 */
@singleton()
@injectable()
export class AssetSyncChecker {
  constructor(
    @inject(AppStateRepository) private appStateRepository: AppStateRepository,
    @inject(AlgoNFTAssetService) private algoNFTAssetService: AlgoNFTAssetService,
    @inject(InternalUserService) private internalUserService: InternalUserService,
  ) {}
  /**
   * Checks if all assets are synced.
   *
   * @returns {void}
   */
  public async checkIfAllAssetsAreSynced(): Promise<void> {
    await this.checkSync();
  }
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
