import {
    Entity,
    EntityRepositoryType,
    ManyToOne,
    PrimaryKey,
    Property,
    ref,
} from '@mikro-orm/core';
import type { Ref } from '@mikro-orm/core';
import { EntityRepository } from '@mikro-orm/mysql';
import { container } from 'tsyringe';

import { Ranking } from '../services/Ranking.js';
import { checkImageExists, hostedConvertedGifUrl } from '../utils/functions/dtImages.js';
import { assetNoteDefaults, IGameStats } from '../utils/functions/dtUtils.js';
import logger from '../utils/functions/LoggerFactory.js';
import { AlgoWallet } from './AlgoWallet.js';
import { CustomBaseEntity } from './BaseEntity.js';
// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoNFTAssetRepository })
export class AlgoNFTAsset extends CustomBaseEntity {
    [EntityRepositoryType]?: AlgoNFTAssetRepository;

    @PrimaryKey({ autoincrement: false })
    assetIndex!: number;

    @ManyToOne(() => AlgoWallet, { ref: true })
    creatorWalletAddress: Ref<AlgoWallet>;

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
    ownerWallet?: Ref<AlgoWallet>;

    @Property({ type: 'json', nullable: true })
    arc69Meta?: AlgorandPlugin.Arc69Payload;

    @Property({ type: 'json', nullable: true })
    assetNote?: DarumaTrainingPlugin.assetNote;

    constructor(
        assetIndex: number,
        creatorWallet: AlgoWallet,
        name: string,
        unitName: string,
        url: string
    ) {
        super();
        this.assetIndex = assetIndex;
        this.name = name;
        this.unitName = unitName;
        this.url = url;
        this.creatorWalletAddress = ref(creatorWallet);
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
        return await this.findOne({ assetIndex: id });
    }
    async getAllPlayerAssets(): Promise<AlgoNFTAsset[]> {
        // return all assets with an assetIndex greater than 100
        return await this.find({ assetIndex: { $gt: 100 } });
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
            asset.assetNote = {
                ...assetNoteDefaults(),
                ...asset.assetNote,
            };
            const arc69 = JSON.stringify(asset.arc69Meta);
            if (asset.url?.endsWith('#v') || arc69.match(/video|animated/gi) !== null) {
                const hostedUrl = hostedConvertedGifUrl(asset.url);
                if (await checkImageExists(hostedUrl)) {
                    asset.altUrl = true;
                } else {
                    logger.info('Image URL does not exist', hostedUrl);
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
        let newAssets: AlgoNFTAsset[] = [];
        const existingAssets = await this.getAllPlayerAssets();
        // Filter out assets that already exist
        const filteredAssets = creatorAssets.filter(
            asset => !existingAssets.find(existingAsset => existingAsset.assetIndex === asset.index)
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
            assetIndex: fakeAsset.assetIndex,
        });
        if (existingAsset) {
            existingAsset.name = fakeAsset.name;
            existingAsset.unitName = fakeAsset.unitName;
            existingAsset.url = fakeAsset.url;
            existingAsset.creatorWalletAddress = ref(fakeCreator);
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
        if (!asset.assetNote) {
            asset.assetNote = assetNoteDefaults();
        }
        // Cooldown number in ms is added to the current time
        asset.assetNote.coolDown = cooldown + Date.now();
        // Increment the Dojo Training wins/losses/zen
        asset.assetNote.dojoTraining.wins += dojoTraining.wins;
        asset.assetNote.dojoTraining.losses += dojoTraining.losses;
        asset.assetNote.dojoTraining.zen += dojoTraining.zen;
        await this.persistAndFlush(asset);
    }
    async assetRankingsByWinLossRatio(): Promise<AlgoNFTAsset[]> {
        const timeout = 10 * 60 * 1000; // 10 minutes

        let ranking = container.resolve(Ranking);
        let filteredAssets = ranking.get('rankedAssets');
        let totalGames = ranking.get('totalGames');
        if (filteredAssets.length === 0) {
            filteredAssets = await this.getAllPlayerAssets();
            // get total number of wins and losses for all assets
            const totalWins = filteredAssets.reduce((acc, asset) => {
                if (asset.assetNote) {
                    return acc + asset.assetNote.dojoTraining?.wins ?? 0;
                }
                return acc;
            }, 0);
            const totalLosses = filteredAssets.reduce((acc, asset) => {
                if (asset.assetNote) {
                    return acc + asset.assetNote.dojoTraining?.losses ?? 0;
                }
                return acc;
            }, 0);
            totalGames = totalWins + totalLosses;
            ranking.set('totalGames', totalGames);
            const sortedAssets = filteredAssets.sort((a, b) => {
                let aWins: number = a.assetNote?.dojoTraining?.wins ?? 0;
                let aLosses: number = a.assetNote?.dojoTraining?.losses ?? 0;

                let bWins: number = b.assetNote?.dojoTraining?.wins ?? 0;
                let bLosses: number = b.assetNote?.dojoTraining?.losses ?? 0;
                if (aWins + aLosses == 0) return 1;
                if (bWins + bLosses == 0) return -1;
                return bWins / totalGames - aWins / totalGames;
            });
            ranking.set('rankedAssets', filteredAssets);
            setTimeout(() => {
                ranking.set('rankedAssets', []);
            }, timeout);

            return sortedAssets;
        }

        return filteredAssets;
    }
}
