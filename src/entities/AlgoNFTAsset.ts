import {
    Entity,
    EntityRepository,
    EntityRepositoryType,
    ManyToOne,
    PrimaryKey,
    Property,
    ref,
} from '@mikro-orm/core';
import type { Ref } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { AlgoWallet } from './AlgoWallet.js';
import { CustomBaseEntity } from './BaseEntity.js';
import { dtCacheKeys } from '../enums/dtEnums.js';
import { CustomCache } from '../services/CustomCache.js';
// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoNFTAssetRepository })
export class AlgoNFTAsset extends CustomBaseEntity {
    [EntityRepositoryType]?: AlgoNFTAssetRepository;

    @PrimaryKey({ autoincrement: false })
    id!: number;

    @ManyToOne(() => AlgoWallet, { ref: true })
    creator: Ref<AlgoWallet>;

    @Property()
    name: string;

    @Property()
    unitName: string;

    @Property()
    url: string;

    @Property({ nullable: true })
    alias?: string;

    @Property({ nullable: true })
    battleCry?: string;

    @ManyToOne(() => AlgoWallet, { nullable: true, ref: true })
    wallet?: Ref<AlgoWallet>;

    @Property({ type: 'json', nullable: true })
    arc69?: AlgorandPlugin.Arc69Payload;

    @Property({ nullable: true })
    dojoCoolDown: Date = new Date();

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    @Property()
    dojoWins: number = 0;

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    @Property()
    dojoLosses: number = 0;

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    @Property()
    dojoZen: number = 0;

    constructor(
        assetIndex: number,
        creatorWallet: AlgoWallet,
        name: string,
        unitName: string,
        url: string
    ) {
        super();
        this.id = assetIndex;
        this.name = name;
        this.unitName = unitName;
        this.url = url;
        this.creator = ref(creatorWallet);
    }
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class AlgoNFTAssetRepository extends EntityRepository<AlgoNFTAsset> {
    /**
     *Find by the asset's id
     *
     * @param {number} id
     * @returns {*}  {(Promise<AlgoAsset | null>)}
     * @memberof AlgoAssetRepository
     */
    async findById(id: number): Promise<AlgoNFTAsset | null> {
        return await this.findOne({ id });
    }
    async getOwnerWalletFromAssetIndex(assetIndex: number): Promise<AlgoWallet> {
        const asset = await this.findById(assetIndex);
        const ownerWallet = asset.wallet?.load();
        return await ownerWallet;
    }
    async getAllPlayerAssets(): Promise<Array<AlgoNFTAsset>> {
        // return all assets with an assetIndex greater than 100
        return await this.find({ id: { $gt: 100 } });
    }
    /**
     * Add Asset to the database
     *
     * @param {AlgoWallet} creatorWallet
     * @param {AssetResult[]} creatorAssets
     * @returns {*}  {Promise<void>}
     * @memberof AlgoNFTAssetRepository
     */
    async addAssetsLookup(
        creatorWallet: AlgoWallet,
        creatorAssets: Array<AlgorandPlugin.AssetResult>
    ): Promise<void> {
        const newAssets: Array<AlgoNFTAsset> = [];
        const existingAssets = await this.getAllPlayerAssets();
        // Filter out assets that already exist
        const filteredAssets = creatorAssets.filter(
            asset => !existingAssets.find(existingAsset => existingAsset.id === asset.index)
        );
        for (const nonExistingAsset of filteredAssets) {
            const assetId = nonExistingAsset?.index;
            const { url, name, 'unit-name': unitName } = nonExistingAsset.params;
            const newAsset = new AlgoNFTAsset(
                assetId,
                creatorWallet,
                name ?? ' ',
                unitName ?? ' ',
                url ?? ' '
            );
            newAssets.push(newAsset);
        }
        await this.persistAndFlush(newAssets);
    }
    async createNPCAsset(
        fakeCreator: AlgoWallet,
        fakeAsset: DarumaTrainingPlugin.FakeAsset
    ): Promise<void> {
        // Check if the asset already exists and update it if it does
        const existingAsset = await this.findOne({
            id: fakeAsset.assetIndex,
        });
        if (existingAsset) {
            existingAsset.name = fakeAsset.name;
            existingAsset.unitName = fakeAsset.unitName;
            existingAsset.url = fakeAsset.url;
            existingAsset.creator = ref(fakeCreator);
            await this.persistAndFlush(existingAsset);
            return;
        }
        const newAsset = new AlgoNFTAsset(
            fakeAsset.assetIndex,
            fakeCreator,
            fakeAsset.name,
            fakeAsset.unitName,
            fakeAsset.url
        );
        await this.persistAndFlush(newAsset);
    }
    async assetEndGameUpdate(
        asset: AlgoNFTAsset,
        cooldown: number,
        dojoTraining: DarumaTrainingPlugin.IGameStats
    ): Promise<void> {
        // Cooldown number in ms is added to the current time
        asset.dojoCoolDown = new Date(cooldown + Date.now());
        // Increment the Dojo Training wins/losses/zen
        asset.dojoWins += dojoTraining.wins;
        asset.dojoLosses += dojoTraining.losses;
        asset.dojoZen += dojoTraining.zen;
        await this.persistAndFlush(asset);
    }
    async zeroOutAssetCooldown(asset: AlgoNFTAsset): Promise<void> {
        asset.dojoCoolDown = new Date(0);
        await this.persistAndFlush(asset);
    }
    async assetRankingByWinsTotalGames(): Promise<Array<AlgoNFTAsset>> {
        const timeout = 10 * 60; // 10 minutes
        const customCache = container.resolve(CustomCache);
        let sortedAssets: Array<AlgoNFTAsset> = customCache.get(dtCacheKeys.RANKEDASSETS);
        let totalGames: number = customCache.get(dtCacheKeys.TOTALGAMES);
        if (!sortedAssets) {
            let filteredAssets = await this.getAllPlayerAssets();
            // pop assets with 0 wins and losses
            filteredAssets = filteredAssets.filter(
                asset => asset.dojoWins !== 0 || asset.dojoLosses !== 0
            );
            // get total number of wins and losses for all assets
            const totalWins = filteredAssets.reduce((acc, asset) => {
                return acc + asset.dojoWins ?? 0;
            }, 0);
            const totalLosses = filteredAssets.reduce((acc, asset) => {
                return acc + asset.dojoLosses ?? 0;
            }, 0);
            totalGames = totalWins + totalLosses;
            sortedAssets = filteredAssets.sort((a, b) => {
                const aWins: number = a.dojoWins ?? 0;
                const aLosses: number = a.dojoLosses ?? 0;

                const bWins: number = b.dojoWins ?? 0;
                const bLosses: number = b.dojoLosses ?? 0;
                if (aWins + aLosses == 0) return 1;
                if (bWins + bLosses == 0) return -1;
                return bWins / totalGames - aWins / totalGames;
            });
            customCache.set(dtCacheKeys.TOTALGAMES, totalGames, timeout);
            customCache.set(dtCacheKeys.RANKEDASSETS, sortedAssets, timeout);
        }
        return sortedAssets;
    }
    async assetTotalGames(asset: AlgoNFTAsset): Promise<number> {
        return asset.dojoWins + asset.dojoLosses;
    }
    async getBonusData(
        userAsset: AlgoNFTAsset,
        averageTotalAssets: number,
        userTotalAssets: number
    ): Promise<DarumaTrainingPlugin.gameBonusData> {
        const customCache = container.resolve(CustomCache);
        let gameBonusData: DarumaTrainingPlugin.gameBonusData = customCache.get(
            dtCacheKeys.BONUSSTATS
        );
        const sortedAssets = await this.assetRankingByWinsTotalGames();

        if (!gameBonusData) {
            const filteredAssets = await this.getAllPlayerAssets();
            // Get the average total games played
            const totalWins = filteredAssets.reduce((acc, asset) => {
                return acc + asset.dojoWins ?? 0;
            }, 0);
            const totalLosses = filteredAssets.reduce((acc, asset) => {
                return acc + asset.dojoLosses ?? 0;
            }, 0);
            const totalGames = totalWins + totalLosses;
            let averageTotalGames = totalGames / filteredAssets.length;
            // Get the average wins
            let averageWins = totalWins / filteredAssets.length;
            // get asset rankings
            let averageRank = sortedAssets.length / 2;

            // Round the numbers to 0 decimal places
            averageTotalGames = Math.round(averageTotalGames);
            averageWins = Math.round(averageWins);
            averageRank = Math.round(averageRank);
            // get each unique owner wallet and average out their total assets

            gameBonusData = {
                averageTotalGames,
                assetTotalGames: 0, // will be set later
                averageWins,
                assetWins: 0, // will be set later
                averageRank,
                assetRank: 0, // will be set later
                averageTotalAssets,
                userTotalAssets,
            };
            customCache.set(dtCacheKeys.BONUSSTATS, gameBonusData, 10 * 60);
        }
        // get the asset rank of the user
        gameBonusData.assetRank = sortedAssets.findIndex(asset => asset.id == userAsset.id) + 1;
        // get the asset total games
        gameBonusData.assetTotalGames = await this.assetTotalGames(userAsset);
        // get the asset wins
        gameBonusData.assetWins = userAsset.dojoWins ?? 0;

        gameBonusData.userTotalAssets = userTotalAssets;

        return gameBonusData;
    }
}
