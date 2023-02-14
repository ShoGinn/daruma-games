import { MikroORM } from '@mikro-orm/core';
import { container, singleton } from 'tsyringe';

import { AlgoWallet } from '../../entities/AlgoWallet.entity.js';
import { Data } from '../../entities/Data.entity.js';
import { Algorand } from '../../services/Algorand.js';
import logger from '../../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../../utils/Utils.js';
import { PostConstruct } from '../framework/decorators/PostConstruct.js';

@singleton()
export class AssetSyncChecker {
    private algorand!: Algorand;
    @PostConstruct
    private async init(): Promise<void> {
        this.algorand = container.resolve(Algorand);
    }
    public check(): void {
        Promise.all([this.isCreatorAssetsSynced(), this.isUserAssetsSynced(), this.createNPCs()]);
    }
    public async isUserAssetsSynced(): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();
        const userAssetSyncData = await em.getRepository(Data).get('userAssetSync');
        const lastSync = ObjectUtil.moreThanTwentyFourHoursAgo(userAssetSyncData);
        if (lastSync) {
            await this.algorand.userAssetSync();
        }
    }
    public async isCreatorAssetsSynced(): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();

        const creatorAssetSyncData = await em.getRepository(Data).get('creatorAssetSync');
        const lastSync = ObjectUtil.moreThanTwentyFourHoursAgo(creatorAssetSyncData);
        if (lastSync) {
            await this.algorand.creatorAssetSync();
        }
    }
    public async updateCreatorAssetSync(): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();

        await em.getRepository(Data).set('creatorAssetSync', Date.now());
    }
    public async updateUserAssetSync(): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();

        await em.getRepository(Data).set('userAssetSync', Date.now());
    }
    public async createNPCs(): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();

        if (await em.getRepository(AlgoWallet).createNPCsIfNotExists())
            logger.info('Created NPC wallets');
    }
}
