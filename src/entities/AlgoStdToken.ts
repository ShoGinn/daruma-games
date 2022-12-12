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
import { EntityRepository } from '@mikro-orm/mysql';

import { AlgoStdAsset } from './AlgoStdAsset.js';
import { AlgoWallet } from './AlgoWallet.js';
import { CustomBaseEntity } from './BaseEntity.js';
// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoStdTokenRepository })
export class AlgoStdToken extends CustomBaseEntity {
    [EntityRepositoryType]?: AlgoStdTokenRepository;

    @PrimaryKey()
    id: number;

    @ManyToOne(() => AlgoWallet, { nullable: true, ref: true })
    ownerWallet: Ref<AlgoWallet>;

    @ManyToMany(() => AlgoStdAsset, asset => asset.ownerTokens)
    algoStdTokenType = new Collection<AlgoStdAsset>(this);

    @Property({ nullable: true })
    tokens?: number;
    constructor(tokens: number) {
        super();
        this.tokens = tokens;
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
    ): Promise<void> {
        function convertBigNumToNumber(num: bigint, decimals: number): number {
            const singleUnit = BigInt('1' + '0'.repeat(decimals));
            const wholeUnits = num / singleUnit;

            return parseInt(wholeUnits.toString());
        }

        const walletHasAsset = await this.checkIfWalletHasAsset(wallet, asset.assetIndex);
        // If the asset has decimals, convert the tokens to a number
        if (asset.decimals > 0 && typeof tokens === 'bigint') {
            tokens = convertBigNumToNumber(tokens, asset.decimals);
        }
        if (typeof tokens === 'number') {
            if (walletHasAsset) {
                walletHasAsset.tokens = tokens;
                await this.persistAndFlush(walletHasAsset);
            } else {
                const algoStdToken = new AlgoStdToken(tokens);
                algoStdToken.algoStdTokenType.add(asset);
                wallet.algoStdTokens.add(algoStdToken);
                await this.persistAndFlush(algoStdToken);
            }
        } else {
            throw new Error('Tokens must be a number');
        }
    }
    async checkIfWalletHasAsset(
        wallet: AlgoWallet,
        assetIndex: number
    ): Promise<AlgoStdToken | null> {
        const walletHasAsset = await this.findOne({
            ownerWallet: wallet,
            algoStdTokenType: { assetIndex: assetIndex },
        });
        return walletHasAsset;
    }
}
