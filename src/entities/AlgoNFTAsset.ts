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
import { checkImageExists, hostedConvertedGifUrl } from '../utils/functions/dtImages.js';
import { assetNoteDefaults, IGameStats } from '../utils/functions/dtUtils.js';
import logger from '../utils/functions/LoggerFactory.js';
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

    @Property()
    altUrl?: boolean = false;

    @Property({ nullable: true })
    alias?: string;

    @ManyToOne(() => AlgoWallet, { nullable: true, ref: true })
    wallet?: Ref<AlgoWallet>;

    @Property({ type: 'json', nullable: true })
    arc69?: AlgorandPlugin.Arc69Payload;

    @Property({ type: 'json', nullable: true })
    note?: DarumaTrainingPlugin.assetNote;

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
        return await this.findOne({ id: id });
    }
    async getOwnerWalletFromAssetIndex(assetIndex: number): Promise<AlgoWallet> {
        const asset = await this.findById(assetIndex);
        const ownerWallet = asset.wallet?.load();
        return await ownerWallet;
    }
    async getAllPlayerAssets(): Promise<AlgoNFTAsset[]> {
        // return all assets with an assetIndex greater than 100
        return await this.find({ id: { $gt: 100 } });
    }
    /**
     * Check if the asset is a video and if there is a alternate url
     * Also update asset notes with defaults if it doesn't exist
     *
     * @returns {*}  {Promise<void>}
     * @memberof AlgoNFTAssetRepository
     */
    async checkAltImageURLAndAssetNotes(): Promise<void> {
        const assets = await this.getAllPlayerAssets();
        const modifiedAssets: AlgoNFTAsset[] = [];
        for (let idx = 0; idx < assets.length; idx++) {
            const asset = assets[idx];
            // Update asset notes with defaults if it doesn't exist
            asset.note = {
                ...assetNoteDefaults(),
                ...asset.note,
            };
            const arc69 = JSON.stringify(asset.arc69);
            if (asset.url?.endsWith('#v') || arc69.match(/video|animated/gi) !== null) {
                const hostedUrl = hostedConvertedGifUrl(asset.url);
                if (await checkImageExists(hostedUrl)) {
                    asset.altUrl = true;
                } else {
                    logger.info(`Image URL does not exist: ${hostedUrl}`);
                }
                modifiedAssets.push(asset);
            }
        }
        await this.persistAndFlush(modifiedAssets);
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
        creatorAssets: AlgorandPlugin.AssetResult[]
    ): Promise<void> {
        const newAssets: AlgoNFTAsset[] = [];
        const existingAssets = await this.getAllPlayerAssets();
        // Filter out assets that already exist
        const filteredAssets = creatorAssets.filter(
            asset => !existingAssets.find(existingAsset => existingAsset.id === asset.index)
        );
        for (let idx = 0; idx < filteredAssets.length; idx++) {
            const nonExistingAsset = filteredAssets[idx];
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
    async assetEndGameUpdate(
        asset: AlgoNFTAsset,
        cooldown: number,
        dojoTraining: IGameStats
    ): Promise<void> {
        if (!asset.note) {
            asset.note = assetNoteDefaults();
        }
        // Cooldown number in ms is added to the current time
        asset.note.coolDown = cooldown + Date.now();
        // Increment the Dojo Training wins/losses/zen
        asset.note.dojoTraining.wins += dojoTraining.wins;
        asset.note.dojoTraining.losses += dojoTraining.losses;
        asset.note.dojoTraining.zen += dojoTraining.zen;
        await this.persistAndFlush(asset);
    }
    async assetRankingByWinsTotalGames(): Promise<AlgoNFTAsset[]> {
        const timeout = 10 * 60; // 10 minutes
        const customCache = container.resolve(CustomCache);
        let sortedAssets: AlgoNFTAsset[] = customCache.get(dtCacheKeys.RANKEDASSETS);
        let totalGames: number = customCache.get(dtCacheKeys.TOTALGAMES);
        if (!sortedAssets) {
            let filteredAssets = await this.getAllPlayerAssets();
            // pop assets with 0 wins and losses
            filteredAssets = filteredAssets.filter(
                asset =>
                    asset.note?.dojoTraining?.wins !== 0 || asset.note?.dojoTraining?.losses !== 0
            );
            // get total number of wins and losses for all assets
            const totalWins = filteredAssets.reduce((acc, asset) => {
                if (asset.note) {
                    return acc + asset.note.dojoTraining?.wins ?? 0;
                }
                return acc;
            }, 0);
            const totalLosses = filteredAssets.reduce((acc, asset) => {
                if (asset.note) {
                    return acc + asset.note.dojoTraining?.losses ?? 0;
                }
                return acc;
            }, 0);
            totalGames = totalWins + totalLosses;
            sortedAssets = filteredAssets.sort((a, b) => {
                const aWins: number = a.note?.dojoTraining?.wins ?? 0;
                const aLosses: number = a.note?.dojoTraining?.losses ?? 0;

                const bWins: number = b.note?.dojoTraining?.wins ?? 0;
                const bLosses: number = b.note?.dojoTraining?.losses ?? 0;
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
        if (asset.note) {
            return asset.note.dojoTraining.wins + asset.note.dojoTraining.losses;
        }
        return 0;
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
                if (asset.note) {
                    return acc + asset.note.dojoTraining?.wins ?? 0;
                }
                return acc;
            }, 0);
            const totalLosses = filteredAssets.reduce((acc, asset) => {
                if (asset.note) {
                    return acc + asset.note.dojoTraining?.losses ?? 0;
                }
                return acc;
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
                averageTotalAssets: averageTotalAssets,
                userTotalAssets: userTotalAssets,
            };
            customCache.set(dtCacheKeys.BONUSSTATS, gameBonusData, 10 * 60);
        }
        // get the asset rank of the user
        gameBonusData.assetRank = sortedAssets.findIndex(asset => asset.id == userAsset.id) + 1;
        // get the asset total games
        gameBonusData.assetTotalGames = await this.assetTotalGames(userAsset);
        // get the asset wins
        gameBonusData.assetWins = userAsset.note?.dojoTraining?.wins ?? 0;

        gameBonusData.userTotalAssets = userTotalAssets;

        return gameBonusData;
    }
}
