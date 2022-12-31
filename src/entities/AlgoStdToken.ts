import {
    Collection,
    Entity,
    EntityRepository,
    EntityRepositoryType,
    ManyToMany,
    ManyToOne,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';
import type { Ref } from '@mikro-orm/core';

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

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    @Property({ nullable: true })
    unclaimedTokens: number = 0;

    @Property({ nullable: true })
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
    async addAlgoStdToken(
        wallet: AlgoWallet,
        asset: AlgoStdAsset,
        tokens: number | bigint,
        optedIn: boolean
    ): Promise<void> {
        function convertBigNumToNumber(num: bigint, decimals: number): number {
            const singleUnit = BigInt('1' + '0'.repeat(decimals));
            const wholeUnits = num / singleUnit;

            return parseInt(wholeUnits.toString());
        }

        const walletHasAsset = await this.checkIfWalletHasStdAsset(wallet, asset.assetIndex);
        // If the asset has decimals, convert the tokens to a number
        if (asset.decimals > 0 && typeof tokens === 'bigint') {
            tokens = convertBigNumToNumber(tokens, asset.decimals);
        }
        if (typeof tokens === 'number') {
            if (walletHasAsset) {
                walletHasAsset.tokens = tokens;
                walletHasAsset.optedIn = optedIn;
                await this.persistAndFlush(walletHasAsset);
            } else {
                const algoStdToken = new AlgoStdToken(tokens, optedIn);
                algoStdToken.algoStdTokenType.add(asset);
                wallet.algoStdTokens.add(algoStdToken);
                await this.persistAndFlush(algoStdToken);
            }
        } else {
            throw new Error('Tokens must be a number');
        }
    }
    async checkIfWalletHasStdAsset(
        wallet: AlgoWallet,
        assetIndex: number
    ): Promise<AlgoStdToken | null> {
        const walletHasAsset = await this.findOne({
            ownerWallet: wallet,
            algoStdTokenType: { assetIndex: assetIndex },
        });
        return walletHasAsset;
    }
    async checkIfWalletHasAssetWithUnclaimedTokens(
        wallet: AlgoWallet,
        assetIndex: number
    ): Promise<AlgoStdToken | null> {
        const walletHasAsset = await this.findOne({
            ownerWallet: wallet,
            algoStdTokenType: { assetIndex: assetIndex },
            unclaimedTokens: { $gt: 0 },
            optedIn: true,
        });
        return walletHasAsset;
    }
    async checkIfWalletWithAssetIsOptedIn(
        wallet: AlgoWallet,
        assetIndex: number
    ): Promise<boolean> {
        const walletHasAsset = await this.checkIfWalletHasStdAsset(wallet, assetIndex);
        if (walletHasAsset) {
            return walletHasAsset.optedIn;
        }
        return false;
    }
    async zeroOutUnclaimedTokens(wallet: AlgoWallet, assetIndex: number): Promise<void> {
        const walletHasAsset = await this.checkIfWalletHasAssetWithUnclaimedTokens(
            wallet,
            assetIndex
        );
        if (walletHasAsset) {
            walletHasAsset.unclaimedTokens = 0;
            await this.persistAndFlush(walletHasAsset);
        }
    }
    async addUnclaimedTokens(
        wallet: AlgoWallet,
        assetIndex: number,
        tokens: number
    ): Promise<number> {
        const walletHasAsset = await this.checkIfWalletHasStdAsset(wallet, assetIndex);
        if (walletHasAsset) {
            walletHasAsset.unclaimedTokens += tokens;
            await this.persistAndFlush(walletHasAsset);
            return walletHasAsset.unclaimedTokens;
        }
        return 0;
    }
    async removeNullOwnerTokens(): Promise<void> {
        const nullOwnerTokens = await this.find({
            ownerWallet: null,
        });
        await this.removeAndFlush(nullOwnerTokens);
    }
}
