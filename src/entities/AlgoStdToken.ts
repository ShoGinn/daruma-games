import { AlgoStdAsset, AlgoWallet } from '@entities'
import {
  Collection,
  Entity,
  EntityRepositoryType,
  ManyToMany,
  ManyToOne,
  PrimaryKey,
  Property,
  Ref,
} from '@mikro-orm/core'
import { EntityRepository } from '@mikro-orm/sqlite'
import { convertBigNumToNumber } from '@utils/functions'

import { CustomBaseEntity } from './BaseEntity'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoStdTokenRepository })
export class AlgoStdToken extends CustomBaseEntity {
  [EntityRepositoryType]?: AlgoStdTokenRepository

  @PrimaryKey()
  id: number

  @ManyToOne(() => AlgoWallet, { nullable: true, ref: true })
  ownerWallet: Ref<AlgoWallet>

  @ManyToMany(() => AlgoStdAsset, asset => asset.ownerTokens)
  algoStdTokenType = new Collection<AlgoStdAsset>(this)

  @Property({ nullable: true })
  tokens?: number
  constructor(tokens: number) {
    super()
    this.tokens = tokens
  }
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class AlgoStdTokenRepository extends EntityRepository<AlgoStdToken> {
  async addAlgoStdToken(
    wallet: AlgoWallet,
    asset: AlgoStdAsset,
    tokens: number | bigint
  ) {
    const walletHasAsset = await this.checkIfWalletHasAsset(
      wallet,
      asset.assetIndex
    )
    // If the asset has decimals, convert the tokens to a number
    if (asset.decimals > 0 && typeof tokens === 'bigint') {
      tokens = convertBigNumToNumber(tokens, asset.decimals)
    }
    if (typeof tokens === 'number') {
      if (walletHasAsset) {
        walletHasAsset.tokens = tokens
        await this.persistAndFlush(walletHasAsset)
      } else {
        const algoStdToken = new AlgoStdToken(tokens)
        algoStdToken.algoStdTokenType.add(asset)
        wallet.algoStdTokens.add(algoStdToken)
        await this.persistAndFlush(algoStdToken)
      }
    } else {
      throw new Error('Tokens must be a number')
    }
  }
  async checkIfWalletHasAsset(
    wallet: AlgoWallet,
    assetIndex: number
  ): Promise<AlgoStdToken | null> {
    const walletHasAsset = await this.findOne({
      ownerWallet: wallet,
      algoStdTokenType: { assetIndex: assetIndex },
    })
    return walletHasAsset
  }
}
