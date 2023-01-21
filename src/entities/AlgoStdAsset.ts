import {
    Cascade,
    Collection,
    Entity,
    EntityRepository,
    EntityRepositoryType,
    ManyToMany,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';

import { AlgoStdToken } from './AlgoStdToken.js';
import { AlgoWallet } from './AlgoWallet.js';
import { CustomBaseEntity } from './BaseEntity.js';

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoStdAssetRepository })
export class AlgoStdAsset extends CustomBaseEntity {
    [EntityRepositoryType]?: AlgoStdAssetRepository;

    @PrimaryKey({ autoincrement: false })
    id: number;

    @Property()
    name!: string;

    @Property()
    unitName!: string;

    @Property()
    url!: string;

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    @Property()
    decimals: number = 0;

    @ManyToMany(() => AlgoWallet, wallet => wallet.asa, {
        owner: true,
    })
    wallet = new Collection<AlgoWallet>(this);

    @ManyToMany(() => AlgoStdToken, tokens => tokens.asa, {
        owner: true,
        cascade: [Cascade.REMOVE],
    })
    tokens = new Collection<AlgoStdToken>(this);

    constructor(assetIndex: number, name: string, unitName: string, url: string) {
        super();
        this.id = assetIndex;
        this.name = name;
        this.unitName = unitName;
        this.url = url;
    }
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class AlgoStdAssetRepository extends EntityRepository<AlgoStdAsset> {
    /**
     *Adds a new ASA to the database
     *
     * @param {AssetLookupResult} stdAsset
     * @returns {*}  {Promise<void>}
     * @memberof AlgoAssetASARepository
     */
    async addAlgoStdAsset(stdAsset: AlgorandPlugin.AssetLookupResult): Promise<void> {
        if (await this.doesAssetExist(stdAsset.asset.index)) {
            return;
        }
        const algoStdAsset = new AlgoStdAsset(
            stdAsset.asset.index,
            stdAsset.asset.params.name ?? ' ',
            stdAsset.asset.params['unit-name'] ?? ' ',
            stdAsset.asset.params.url ?? ' '
        );
        if (stdAsset.asset.params.decimals > 0) {
            const stdAssetDecimals = stdAsset.asset.params.decimals;
            algoStdAsset.decimals =
                typeof stdAssetDecimals === 'bigint'
                    ? parseInt(stdAssetDecimals.toString())
                    : stdAssetDecimals;
        }
        await this.persistAndFlush(algoStdAsset);
    }
    async deleteStdAsset(assetIndex: number): Promise<void> {
        const asset = await this.findOneOrFail({ id: assetIndex }, { populate: true });
        await this.removeAndFlush(asset);
    }

    async doesAssetExist(assetIndex: number): Promise<boolean> {
        const asset = await this.findOne({ id: assetIndex });
        return !!asset;
    }
    async getAllStdAssets(): Promise<Array<AlgoStdAsset>> {
        return await this.findAll();
    }
    async getStdAssetByUnitName(unitName: string): Promise<AlgoStdAsset> {
        return await this.findOneOrFail({ unitName });
    }
}
