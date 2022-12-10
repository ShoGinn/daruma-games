import {
    Cascade,
    Collection,
    Entity,
    EntityRepositoryType,
    ManyToMany,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';
import { EntityRepository } from '@mikro-orm/mysql';

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
    assetIndex: number;

    @Property()
    name!: string;

    @Property()
    unitName!: string;

    @Property()
    url!: string;

    @Property()
    decimals = 0;

    @Property({ nullable: true })
    tokenMnemonic: string | undefined;

    @ManyToMany(() => AlgoWallet, wallet => wallet.algoStdAsset, {
        owner: true,
    })
    ownerWallet = new Collection<AlgoWallet>(this);

    @ManyToMany(() => AlgoStdToken, tokens => tokens.algoStdTokenType, {
        owner: true,
        cascade: [Cascade.REMOVE],
    })
    ownerTokens = new Collection<AlgoStdToken>(this);

    constructor(assetIndex: number, name: string, unitName: string, url: string) {
        super();
        this.assetIndex = assetIndex;
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
            if (typeof stdAssetDecimals === 'bigint') {
                algoStdAsset.decimals = parseInt(stdAssetDecimals.toString());
            } else {
                algoStdAsset.decimals = stdAssetDecimals;
            }
        }
        await this.persistAndFlush(algoStdAsset);
    }
    async deleteStdAsset(assetIndex: number): Promise<void> {
        const asset = await this.findOneOrFail({ assetIndex }, { populate: true });
        await this.removeAndFlush(asset);
    }

    async doesAssetExist(assetIndex: number): Promise<boolean> {
        const asset = await this.findOne({ assetIndex });
        return !!asset;
    }
    async getAllStdAssets(): Promise<AlgoStdAsset[]> {
        return await this.findAll();
    }
    async getStdAssetByUnitName(unitName: string): Promise<AlgoStdAsset> {
        return await this.findOneOrFail({ unitName });
    }
}
