import type { AssetLookupResult } from '../model/types/algorand.js';
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

import { AlgoStdToken } from './AlgoStdToken.entity.js';
import { AlgoWallet } from './AlgoWallet.entity.js';
import { CustomBaseEntity } from './BaseEntity.entity.js';

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
    async addAlgoStdAsset(stdAsset: AssetLookupResult): Promise<boolean> {
        if (await this.doesAssetExist(stdAsset.asset.index)) {
            return false;
        }

        await this.checkForAssetWithSameUnitName(stdAsset);

        const algoStdAsset = this.createAlgoStdAssetFromLookupResult(stdAsset);
        await this.setDecimalsForAlgoStdAsset(stdAsset, algoStdAsset);
        await this.persistAndFlush(algoStdAsset);

        return true;
    }

    private async checkForAssetWithSameUnitName(stdAsset: AssetLookupResult): Promise<void> {
        const assetWithSameUnitName = await this.findOne({
            unitName: stdAsset.asset.params['unit-name'],
        });
        if (assetWithSameUnitName) {
            throw new Error('An asset with the same unit name already exists');
        }
    }

    private createAlgoStdAssetFromLookupResult(stdAsset: AssetLookupResult): AlgoStdAsset {
        return new AlgoStdAsset(
            stdAsset.asset.index,
            stdAsset.asset.params.name ?? ' ',
            stdAsset.asset.params['unit-name'] ?? ' ',
            stdAsset.asset.params.url ?? ' '
        );
    }

    private async setDecimalsForAlgoStdAsset(
        stdAsset: AssetLookupResult,
        algoStdAsset: AlgoStdAsset
    ): Promise<void> {
        if (stdAsset.asset.params.decimals === 0) {
            return;
        }

        if (stdAsset.asset.params.decimals > 0 && stdAsset.asset.params.decimals <= 19) {
            algoStdAsset.decimals = stdAsset.asset.params.decimals;
        } else {
            throw new Error('Invalid decimals value for asset must be between 0 and 19');
        }
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
    async getStdAssetByAssetIndex(assetIndex: number): Promise<AlgoStdAsset> {
        return await this.findOneOrFail({ id: assetIndex });
    }
    async getStdAssetByUnitName(unitName: string): Promise<AlgoStdAsset> {
        return await this.findOneOrFail({ unitName });
    }
}
