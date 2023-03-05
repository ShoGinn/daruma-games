import { MikroORM } from '@mikro-orm/core';
import { injectable, singleton } from 'tsyringe';

import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.entity.js';
import { AlgoWallet } from '../../entities/AlgoWallet.entity.js';
import { User } from '../../entities/User.entity.js';
import METHOD_EXECUTOR_TIME_UNIT from '../../enums/METHOD_EXECUTOR_TIME_UNIT.js';
import logger from '../../utils/functions/LoggerFactory.js';
import { RunEvery } from '../framework/decorators/RunEvery.js';
import { Schedule } from '../framework/decorators/Schedule.js';

@singleton()
@injectable()
export class AssetSyncChecker {
    constructor(private orm: MikroORM) {}

    public checkIfAllAssetsAreSynced(): void {
        Promise.all([this.checkSync(), this.createNPCs()]);
    }

    @RunEvery(6, METHOD_EXECUTOR_TIME_UNIT.hours)
    public async runUserAssetSync(): Promise<void> {
        const em = this.orm.em.fork();
        await em.getRepository(User).userAssetSync();
    }
    @Schedule('0 0 * * *')
    public async runCreatorAssetSync(): Promise<void> {
        const em = this.orm.em.fork();
        await em.getRepository(AlgoNFTAsset).creatorAssetSync();
    }

    public async checkSync(): Promise<void> {
        if (await this.getWalletSyncOldest()) {
            await this.runUserAssetSync();
        }
        if (await this.getAssetSyncOldest()) {
            await this.runCreatorAssetSync();
        }
    }
    public async getAssetSyncOldest(): Promise<boolean> {
        const em = this.orm.em.fork();
        return await em.getRepository(AlgoNFTAsset).anyAssetsUpdatedMoreThan24HoursAgo();
    }
    public async getWalletSyncOldest(): Promise<boolean> {
        const em = this.orm.em.fork();
        return await em.getRepository(AlgoWallet).anyWalletsUpdatedMoreThan24HoursAgo();
    }
    public async createNPCs(): Promise<void> {
        const em = this.orm.em.fork();

        if (await em.getRepository(AlgoWallet).createNPCsIfNotExists())
            logger.info('Created NPC wallets');
    }
}
