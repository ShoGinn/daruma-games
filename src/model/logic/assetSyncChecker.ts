import dayjs from 'dayjs';
import { container, singleton } from 'tsyringe';

import { AlgoWallet, AlgoWalletRepository } from '../../entities/AlgoWallet.js';
import { Data, DataRepository } from '../../entities/Data.js';
import { Algorand } from '../../services/Algorand.js';
import { Database } from '../../services/Database.js';
import { PostConstruct } from '../framework/decorators/PostConstruct.js';

@singleton()
export class AssetSyncChecker {
    private db: Database;
    private algorand: Algorand;
    private dataRepository: DataRepository;
    private algoWallet: AlgoWalletRepository;
    constructor() {
        this.db = container.resolve(Database);
    }
    @PostConstruct
    private async init(): Promise<void> {
        this.algorand = container.resolve(Algorand);
        this.dataRepository = this.db.get(Data);
        this.algoWallet = this.db.get(AlgoWallet);
    }
    public check(): void {
        Promise.all([this.isCreatorAssetsSynced(), this.isUserAssetsSynced(), this.createNPCs()]);
    }
    public async isUserAssetsSynced(): Promise<void> {
        const userAssetSyncData = await this.dataRepository.get('userAssetSync');
        const lastSync = this.moreThanTwentyFourHoursAgo(userAssetSyncData);
        if (lastSync) {
            await this.algorand.userAssetSync();
        }
    }
    public async isCreatorAssetsSynced(): Promise<void> {
        const creatorAssetSyncData = await this.dataRepository.get('creatorAssetSync');
        const lastSync = this.moreThanTwentyFourHoursAgo(creatorAssetSyncData);
        if (lastSync) {
            await this.algorand.creatorAssetSync();
        }
    }
    public async updateCreatorAssetSync(): Promise<void> {
        await this.dataRepository.set('creatorAssetSync', Date.now());
    }
    public async updateUserAssetSync(): Promise<void> {
        await this.dataRepository.set('userAssetSync', Date.now());
    }
    public async createNPCs(): Promise<void> {
        await this.algoWallet.createBotNPCs();
    }
    private moreThanTwentyFourHoursAgo(date: number): boolean {
        return dayjs().diff(dayjs(date), 'hour') >= 24;
    }
}
