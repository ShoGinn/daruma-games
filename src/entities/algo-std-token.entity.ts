import { EntityRepository } from '@mikro-orm/better-sqlite';
import {
  Collection,
  Entity,
  EntityRepositoryType,
  ManyToMany,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import type { Ref } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { AlgoStdAsset } from './algo-std-asset.entity.js';
import { AlgoWallet } from './algo-wallet.entity.js';
import { CustomBaseEntity } from './base.entity.js';
import { Algorand } from '../services/algorand.js';
import { ObjectUtil } from '../utils/utils.js';
// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoStdTokenRepository })
export class AlgoStdToken extends CustomBaseEntity {
  [EntityRepositoryType]?: AlgoStdTokenRepository;

  @PrimaryKey()
  id!: number;

  @ManyToOne(() => AlgoWallet, {
    nullable: true,
    ref: true,
    onDelete: 'cascade',
  })
  wallet!: Ref<AlgoWallet>;

  @ManyToMany(() => AlgoStdAsset, (asset) => asset.tokens)
  asa = new Collection<AlgoStdAsset>(this);

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  @Property()
  tokens: number = 0;

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  @Property()
  unclaimedTokens: number = 0;

  @Property()
  optedIn: boolean;

  constructor(tokens: number, optedIn: boolean) {
    super();
    this.tokens = tokens;
    this.optedIn = optedIn;
  }
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class AlgoStdTokenRepository extends EntityRepository<AlgoStdToken> {
  /**
   * Get the token opted in and tokens
   *
   * @param {AlgoWallet} wallet
   * @param {AlgoStdAsset} asset
   * @returns {*}
   * @memberof AlgoStdTokenRepository
   */
  async getTokenFromAlgoNetwork(
    wallet: AlgoWallet,
    asset: AlgoStdAsset,
  ): Promise<{ optedIn: boolean; tokens: number | bigint }> {
    const algorand = container.resolve(Algorand);
    return await algorand.getTokenOptInStatus(wallet.address, asset.id);
  }
  /**
   * Add AlgoStdToken to wallet
   *
   * @param {AlgoWallet} wallet
   * @param {AlgoStdAsset} asset
   * @returns {*}  {Promise<void>}
   * @memberof AlgoStdTokenRepository
   */
  async addAlgoStdToken(
    wallet: AlgoWallet,
    asset: AlgoStdAsset,
  ): Promise<{ optedIn: boolean; tokens: number }> {
    const em = this.getEntityManager();
    const liveToken = await this.getTokenFromAlgoNetwork(wallet, asset);
    const tokens = ObjectUtil.convertBigIntToNumber(liveToken.tokens, asset.decimals);
    const { optedIn } = liveToken;

    // Check if wallet has asset
    const walletHasAsset = await this.doesWalletHaveAsset(wallet, asset.id);
    const walletWithAsset = await this.getStdAssetByWallet(wallet, asset.id);
    let newToken: AlgoStdToken;
    if (typeof tokens === 'number') {
      if (walletHasAsset && walletWithAsset) {
        walletWithAsset.tokens = tokens;
        walletWithAsset.optedIn = optedIn;
        await em.persistAndFlush(walletWithAsset);
      } else if (walletHasAsset && !walletWithAsset) {
        newToken = new AlgoStdToken(tokens, optedIn);
        newToken.asa.add(asset);
        wallet.tokens.add(newToken);
        await em.persistAndFlush(wallet);
        await em.persistAndFlush(newToken);
      } else {
        newToken = new AlgoStdToken(tokens, optedIn);
        newToken.asa.add(asset);
        wallet.tokens.add(newToken);
        wallet.asa.add(asset);
        await em.persistAndFlush(wallet);
        await em.persistAndFlush(newToken);
      }
    }
    return { optedIn, tokens };
  }
  async doesWalletHaveAsset(wallet: AlgoWallet, assetIndex: number): Promise<boolean> {
    await wallet.asa.init();
    return !!wallet.asa.getItems().some((walletAsset) => walletAsset.id === assetIndex);
  }

  async getStdAssetByWallet(wallet: AlgoWallet, assetIndex: number): Promise<AlgoStdToken | null> {
    await wallet.asa.init();
    return await this.findOne({
      wallet,
      asa: { id: assetIndex },
    });
  }
  async isWalletWithAssetOptedIn(wallet: AlgoWallet, assetIndex: number): Promise<boolean> {
    await wallet.asa.init();
    return (
      (await this.findOne({
        wallet,
        asa: { id: assetIndex },
        optedIn: true,
      })) !== null || false
    );
  }
  async getAllAssetsByWalletWithUnclaimedTokens(wallet: AlgoWallet): Promise<AlgoStdToken[]> {
    return await this.find({ wallet, unclaimedTokens: { $gt: 0 } });
  }
  async getWalletWithUnclaimedTokens(
    wallet: AlgoWallet,
    assetIndex: number,
  ): Promise<AlgoStdToken | null> {
    await wallet.asa.init();
    return await this.findOne({
      wallet,
      asa: { id: assetIndex },
      unclaimedTokens: { $gt: 0 },
      optedIn: true,
    });
  }
  async removeUnclaimedTokens(
    wallet: AlgoWallet,
    assetIndex: number,
    tokensToRemove: number,
  ): Promise<void> {
    const em = this.getEntityManager();
    const walletHasAsset = await this.getWalletWithUnclaimedTokens(wallet, assetIndex);
    if (walletHasAsset) {
      walletHasAsset.unclaimedTokens -= tokensToRemove;
      await em.persistAndFlush(walletHasAsset);
    }
  }
  async addUnclaimedTokens(
    wallet: AlgoWallet,
    assetIndex: number,
    tokens: number,
  ): Promise<number> {
    const em = this.getEntityManager();

    const walletHasAsset = await this.getStdAssetByWallet(wallet, assetIndex);
    if (walletHasAsset) {
      walletHasAsset.unclaimedTokens += tokens;
      await em.persistAndFlush(walletHasAsset);
      return walletHasAsset.unclaimedTokens;
    }
    throw new Error(`Wallet does not have asset: ${assetIndex}`);
  }
}
