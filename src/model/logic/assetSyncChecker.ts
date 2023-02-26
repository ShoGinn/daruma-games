import { MikroORM } from '@mikro-orm/core';
import { container, injectable, singleton } from 'tsyringe';

import { AlgoWallet } from '../../entities/AlgoWallet.entity.js';
import { Data } from '../../entities/Data.entity.js';
import { Algorand } from '../../services/Algorand.js';
import logger from '../../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../../utils/Utils.js';
import { PostConstruct } from '../framework/decorators/PostConstruct.js';

@singleton()
@injectable()
export class AssetSyncChecker {
    private algorand!: Algorand;
    constructor(private orm: MikroORM) {}
    @PostConstruct
    private init(): void {
        this.algorand = container.resolve(Algorand);
    }
    public checkIfAllAssetsAreSynced(): void {
        Promise.all([this.isCreatorAssetsSynced(), this.isUserAssetsSynced(), this.createNPCs()]);
    }

    public async isUserAssetsSynced(): Promise<void> {
        const lastSync = await this.getAssetSync('user');
        if (lastSync) {
            await this.algorand.userAssetSync();
        }
    }
    public async isCreatorAssetsSynced(): Promise<void> {
        const lastSync = await this.getAssetSync('creator');
        if (lastSync) {
            await this.algorand.creatorAssetSync();
        }
    }

    public async getAssetSync(type: 'creator' | 'user'): Promise<boolean> {
        const em = this.orm.em.fork();
        const key = type === 'creator' ? 'creatorAssetSync' : 'userAssetSync';
        const lastSync = await em.getRepository(Data).get(key);
        return ObjectUtil.moreThanTwentyFourHoursAgo(lastSync);
    }
    public async updateAssetSync(type: 'creator' | 'user'): Promise<void> {
        const em = this.orm.em.fork();
        const key = type === 'creator' ? 'creatorAssetSync' : 'userAssetSync';

        await em.getRepository(Data).set(key, Date.now());
    }

    public async createNPCs(): Promise<void> {
        const em = this.orm.em.fork();

        if (await em.getRepository(AlgoWallet).createNPCsIfNotExists())
            logger.info('Created NPC wallets');
    }
}
