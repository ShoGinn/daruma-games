/* istanbul ignore file: We run tests on the individual functions but this is used to schedule in a class  */
import { MikroORM } from '@mikro-orm/core';
import { injectable, singleton } from 'tsyringe';

import { AlgoNFTAsset } from '../../entities/algo-nft-asset.entity.js';
import { AlgoWallet } from '../../entities/algo-wallet.entity.js';
import { User } from '../../entities/user.entity.js';
import METHOD_EXECUTOR_TIME_UNIT from '../../enums/method-executor-time-unit.js';
import { RunEvery } from '../framework/decorators/run-every.js';
import { Schedule } from '../framework/decorators/schedule.js';

/**
 * This class checks the synchronization of assets and wallets, and creates NPC wallets if needed.
 */
@singleton()
@injectable()
export class AssetSyncChecker {
    /**
     * Initializes a new instance of the AssetSyncChecker class.
     *
     * @class
     * @param {MikroORM} orm - The MikroORM instance to use.
     */
    constructor(private orm: MikroORM) {}
    /**
     * Checks if all assets are synced.
     *
     * @returns {void}
     */
    public checkIfAllAssetsAreSynced(): void {
        Promise.all([this.checkSync(), this.createNPCs()]);
    }
    /**
     * Runs user asset sync.
     *
     * @returns {Promise<void>}
     */
    @RunEvery(6, METHOD_EXECUTOR_TIME_UNIT.hours)
    public async runUserAssetSync(): Promise<void> {
        const em = this.orm.em.fork();
        await em.getRepository(User).userAssetSync();
    }
    /**
     * Runs creator asset sync.
     *
     * @returns {Promise<void>}
     */
    @Schedule('0 0 * * *')
    public async runCreatorAssetSync(): Promise<void> {
        const em = this.orm.em.fork();
        await em.getRepository(AlgoNFTAsset).creatorAssetSync();
    }
    /**
     * Checks the synchronization of assets and wallets, and creates NPC wallets if needed.
     *
     * @returns {Promise<void>}
     */
    public async checkSync(): Promise<void> {
        const needsUserAssetSync = await this.getWalletSyncOldest();
        const needsCreatorAssetSync = await this.getAssetSyncOldest();

        if (needsUserAssetSync) {
            await this.runUserAssetSync();
        }

        if (needsCreatorAssetSync) {
            await this.runCreatorAssetSync();
        }
    }
    /**
     * Gets the oldest synchronization date of the assets.
     *
     * @returns {Promise<boolean>}
     */
    public async getAssetSyncOldest(): Promise<boolean> {
        const em = this.orm.em.fork();
        return await em.getRepository(AlgoNFTAsset).anyAssetsUpdatedMoreThan24HoursAgo();
    }
    /**
     * Gets the oldest synchronization date of the wallets.
     *
     * @returns {Promise<boolean>}
     */
    public async getWalletSyncOldest(): Promise<boolean> {
        const em = this.orm.em.fork();
        return await em.getRepository(AlgoWallet).anyWalletsUpdatedMoreThan24HoursAgo();
    }
    /**
     * Creates NPC wallets if they don't already exist.
     *
     * @returns {Promise<void>}
     */
    public async createNPCs(): Promise<void> {
        const em = this.orm.em.fork();
        await em.getRepository(AlgoWallet).createNPCsIfNotExists();
    }
}
