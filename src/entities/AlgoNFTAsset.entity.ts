import type { Arc69Payload, AssetResult } from '../model/types/algorand.js';
import type { FakeAsset, gameBonusData, IGameStats } from '../model/types/darumaTraining.js';
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

import { AlgoWallet } from './AlgoWallet.entity.js';
import { CustomBaseEntity } from './BaseEntity.entity.js';
import { dtCacheKeys } from '../enums/dtEnums.js';
import { CustomCache } from '../services/CustomCache.js';
import { getAverageDarumaOwned } from '../utils/functions/dtUtils.js';
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
    arc69?: Arc69Payload;

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
     * Get the Owner Wallet from the asset index
     *
     * @param {number} assetIndex
     * @returns {*}  {Promise<AlgoWallet>}
     * @memberof AlgoNFTAssetRepository
     */
    async getOwnerWalletFromAssetIndex(assetIndex: number): Promise<AlgoWallet> {
        const asset = await this.findOneOrFail({ id: assetIndex }, { populate: ['wallet'] });
        const ownerWallet = await asset.wallet?.load();
        if (!ownerWallet) {
            throw new Error('Owner wallet not found');
        }
        return ownerWallet;
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
        creatorAssets: Array<AssetResult>
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
    async createNPCAsset(fakeCreator: AlgoWallet, fakeAsset: FakeAsset): Promise<void> {
        // Check if the asset already exists and update it if it does
        const existingAsset = await this.findOne({
            id: fakeAsset.assetIndex,
        });
        if (existingAsset) {
            Object.assign(existingAsset, {
                name: fakeAsset.name,
                unitName: fakeAsset.unitName,
                url: fakeAsset.url,
                creator: ref(fakeCreator),
            });
            await this.persistAndFlush(existingAsset);
        } else {
            const newAsset = new AlgoNFTAsset(
                fakeAsset.assetIndex,
                fakeCreator,
                fakeAsset.name,
                fakeAsset.unitName,
                fakeAsset.url
            );
            await this.persistAndFlush(newAsset);
        }
    }

    /**
     * Update the asset's cooldown and dojo training stats
     *
     * @param {AlgoNFTAsset} asset
     * @param {number} cooldown
     * @param {IGameStats} dojoTraining
     * @returns {*}  {Promise<void>}
     * @memberof AlgoNFTAssetRepository
     */
    async assetEndGameUpdate(
        asset: AlgoNFTAsset,
        cooldown: number,
        dojoTraining: IGameStats
    ): Promise<void> {
        // Cooldown number in ms is added to the current time
        asset.dojoCoolDown = new Date(cooldown + Date.now());
        // Increment the Dojo Training wins/losses/zen
        asset.dojoWins += dojoTraining.wins;
        asset.dojoLosses += dojoTraining.losses;
        asset.dojoZen += dojoTraining.zen;
        await this.persistAndFlush(asset);
    }

    /**
     * Zero out the asset's cooldown
     *
     * @param {AlgoNFTAsset} asset
     * @returns {*}  {Promise<void>}
     * @memberof AlgoNFTAssetRepository
     */
    async zeroOutAssetCooldown(asset: AlgoNFTAsset): Promise<void> {
        asset.dojoCoolDown = new Date(0);
        await this.persistAndFlush(asset);
    }

    /**
     * Sort the assets by their wins and losses
     * and return them sorted
     *
     * @returns {*}  {Promise<Array<AlgoNFTAsset>>}
     * @memberof AlgoNFTAssetRepository
     */
    async assetRankingByWinsTotalGames(): Promise<Array<AlgoNFTAsset>> {
        const timeout = 600; // 10 minutes
        const customCache = container.resolve(CustomCache);
        const sortedAssets: Array<AlgoNFTAsset> | undefined = customCache.get('rankedAssets');
        if (sortedAssets) {
            return sortedAssets;
        }

        const filteredAssets = (await this.getAllPlayerAssets()).filter(
            asset => asset.dojoWins !== 0 || asset.dojoLosses !== 0
        );
        const totalWins = filteredAssets.reduce((acc, asset) => acc + asset.dojoWins, 0);
        const totalLosses = filteredAssets.reduce((acc, asset) => acc + asset.dojoLosses, 0);
        const totalGamesNew = totalWins + totalLosses;
        const sortedAssetsNew = filteredAssets.sort((a, b) => {
            const aWins: number = a.dojoWins;
            const aLosses: number = a.dojoLosses;

            const bWins: number = b.dojoWins;
            const bLosses: number = b.dojoLosses;

            if (aWins > bWins) return -1;
            if (aWins < bWins) return 1;

            return bWins / (bWins + bLosses) - aWins / (aWins + aLosses);
        });
        customCache.set(dtCacheKeys.TOTAL_GAMES, totalGamesNew, timeout);
        customCache.set('rankedAssets', sortedAssetsNew, timeout);

        return sortedAssetsNew;
    }

    /**
     *
     *
     * @param {AlgoNFTAsset} asset
     * @returns {*}  {Promise<number>}
     * @memberof AlgoNFTAssetRepository
     */
    assetTotalGames(asset: AlgoNFTAsset): number {
        return asset.dojoWins + asset.dojoLosses;
    }

    async getBonusData(userAsset: AlgoNFTAsset, userTotalAssets: number): Promise<gameBonusData> {
        const customCache = container.resolve(CustomCache);
        let gameBonusData = customCache.get('bonusStats') as gameBonusData;
        const rankedAssetsSorted = await this.assetRankingByWinsTotalGames();

        if (!gameBonusData) {
            const allPlayerAssets = await this.getAllPlayerAssets();
            // Get the average total games played
            const totalWins = allPlayerAssets.reduce((acc, asset) => {
                return acc + asset.dojoWins;
            }, 0);
            const totalLosses = allPlayerAssets.reduce((acc, asset) => {
                return acc + asset.dojoLosses;
            }, 0);
            const totalGames = totalWins + totalLosses;
            let averageTotalGames = totalGames / allPlayerAssets.length;
            // Get the average wins
            let averageWins = totalWins / allPlayerAssets.length;
            // get asset rankings
            const sumOfRanks = rankedAssetsSorted.reduce((acc, asset, index) => acc + index + 1, 0);
            const averageRank = Math.round(sumOfRanks / rankedAssetsSorted.length) || 1;

            // Round the numbers to 0 decimal places
            averageTotalGames = Math.round(averageTotalGames);
            averageWins = Math.round(averageWins);
            const averageTotalAssets = await getAverageDarumaOwned();
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
            customCache.set('bonusStats', gameBonusData, 600);
        }
        // get the asset rank of the user
        gameBonusData.assetRank =
            rankedAssetsSorted.findIndex(asset => asset.id == userAsset.id) + 1;
        // get the asset total games
        gameBonusData.assetTotalGames = this.assetTotalGames(userAsset);
        // get the asset wins
        gameBonusData.assetWins = userAsset.dojoWins;

        gameBonusData.userTotalAssets = userTotalAssets;

        return gameBonusData;
    }
}
