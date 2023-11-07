import { EntityRepository } from '@mikro-orm/better-sqlite';
import {
  Cascade,
  Collection,
  Entity,
  EntityRepositoryType,
  ManyToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';

import type { AssetLookupResult } from '../model/types/algorand.js';

import { AlgoStdToken } from './algo-std-token.entity.js';
import { AlgoWallet } from './algo-wallet.entity.js';
import { CustomBaseEntity } from './base.entity.js';

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

  @ManyToMany(() => AlgoWallet, (wallet) => wallet.asa, {
    owner: true,
  })
  wallet = new Collection<AlgoWallet>(this);

  @ManyToMany(() => AlgoStdToken, (tokens) => tokens.asa, {
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
    const em = this.getEntityManager();

    await this.checkForAssetWithSameUnitName(stdAsset);

    const algoStdAsset = this.createAlgoStdAssetFromLookupResult(stdAsset);
    this.setDecimalsForAlgoStdAsset(stdAsset, algoStdAsset);
    await em.persistAndFlush(algoStdAsset);

    return true;
  }

  private async checkForAssetWithSameUnitName(stdAsset: AssetLookupResult): Promise<void> {
    const stdAssetUnitName = stdAsset.asset.params['unit-name'];
    if (!stdAssetUnitName) {
      return;
    }
    const assetWithSameUnitName = await this.findOne({
      unitName: stdAssetUnitName,
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
      stdAsset.asset.params.url ?? ' ',
    );
  }

  private setDecimalsForAlgoStdAsset(
    stdAsset: AssetLookupResult,
    algoStdAsset: AlgoStdAsset,
  ): void {
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
    const em = this.getEntityManager();

    const asset = await this.findOneOrFail({ id: assetIndex }, { populate: true });
    await em.removeAndFlush(asset);
  }

  async doesAssetExist(assetIndex: number): Promise<boolean> {
    const asset = await this.findOne({ id: assetIndex });
    return !!asset;
  }
  async getAllStdAssets(): Promise<AlgoStdAsset[]> {
    return await this.findAll();
  }
  async getStdAssetByAssetIndex(assetIndex: number): Promise<AlgoStdAsset> {
    return await this.findOneOrFail({ id: assetIndex });
  }
  async getStdAssetByUnitName(unitName: string): Promise<AlgoStdAsset> {
    return await this.findOneOrFail({ unitName });
  }
}
