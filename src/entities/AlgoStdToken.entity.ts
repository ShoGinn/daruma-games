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

import { AlgoStdAsset } from './AlgoStdAsset.entity.js';
import { AlgoWallet } from './AlgoWallet.entity.js';
import { CustomBaseEntity } from './BaseEntity.entity.js';
// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoStdTokenRepository })
export class AlgoStdToken extends CustomBaseEntity {
    [EntityRepositoryType]?: AlgoStdTokenRepository;

    @PrimaryKey()
    id!: number;

    @ManyToOne(() => AlgoWallet, { nullable: true, ref: true })
    wallet!: Ref<AlgoWallet>;

    @ManyToMany(() => AlgoStdAsset, asset => asset.tokens)
    asa = new Collection<AlgoStdAsset>(this);

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
            const singleUnit = BigInt(`1${'0'.repeat(decimals)}`);
            const wholeUnits = num / singleUnit;

            return parseInt(wholeUnits.toString());
        }
        // Check if wallet has asset
        const walletHasAsset = wallet.asa
            .getItems()
            .find(walletAsset => walletAsset.id === asset.id);
        const walletHasToken = await this.getOwnerTokenWallet(wallet, asset.id);
        let newToken: AlgoStdToken;
        // If the asset has decimals, convert the tokens to a number
        if (asset.decimals > 0 && typeof tokens === 'bigint') {
            tokens = convertBigNumToNumber(tokens, asset.decimals);
        }
        if (typeof tokens === 'number') {
            if (walletHasAsset && walletHasToken) {
                walletHasToken.tokens = tokens;
                walletHasToken.optedIn = optedIn;
                await this.persistAndFlush(walletHasToken);
            } else if (walletHasAsset && !walletHasToken) {
                newToken = new AlgoStdToken(tokens, optedIn);
                newToken.asa.add(asset);
                wallet.tokens.add(newToken);
                await this.persistAndFlush(wallet);
                await this.persistAndFlush(newToken);
            } else if (!walletHasAsset && walletHasToken) {
                wallet.asa.add(asset);
                walletHasToken.tokens = tokens;
                walletHasToken.optedIn = optedIn;
                await this.persistAndFlush(wallet);
                await this.persistAndFlush(walletHasToken);
            } else {
                newToken = new AlgoStdToken(tokens, optedIn);
                newToken.asa.add(asset);
                wallet.tokens.add(newToken);
                wallet.asa.add(asset);
                await this.persistAndFlush(wallet);
                await this.persistAndFlush(newToken);
            }
        } else {
            throw new Error('Tokens must be a number');
        }
    }
    async getOwnerTokenWallet(wallet: AlgoWallet, asaID: number): Promise<AlgoStdToken | null> {
        return await this.findOne({
            wallet,
            asa: { id: asaID },
        });
    }
    async checkIfWalletHasAssetWithUnclaimedTokens(
        wallet: AlgoWallet,
        assetIndex: number
    ): Promise<AlgoStdToken | null> {
        return await this.findOne({
            wallet,
            asa: { id: assetIndex },
            unclaimedTokens: { $gt: 0 },
            optedIn: true,
        });
    }
    async checkIfWalletWithAssetIsOptedIn(wallet: AlgoWallet, asaId: number): Promise<boolean> {
        const walletHasAsset = await this.getOwnerTokenWallet(wallet, asaId);
        if (walletHasAsset) {
            return walletHasAsset.optedIn;
        }
        return false;
    }
    async removeUnclaimedTokens(
        wallet: AlgoWallet,
        assetIndex: number,
        tokensToRemove: number
    ): Promise<void> {
        const walletHasAsset = await this.checkIfWalletHasAssetWithUnclaimedTokens(
            wallet,
            assetIndex
        );
        if (walletHasAsset) {
            walletHasAsset.unclaimedTokens -= tokensToRemove;
            await this.persistAndFlush(walletHasAsset);
        }
    }
    async addUnclaimedTokens(
        wallet: AlgoWallet,
        assetIndex: number,
        tokens: number
    ): Promise<number> {
        const walletHasAsset = await this.getOwnerTokenWallet(wallet, assetIndex);
        if (walletHasAsset) {
            walletHasAsset.unclaimedTokens += tokens;
            await this.persistAndFlush(walletHasAsset);
            return walletHasAsset.unclaimedTokens;
        }
        return 0;
    }
    async removeNullOwnerTokens(): Promise<void> {
        const nullOwnerTokens = await this.find({
            wallet: null,
        });
        await this.removeAndFlush(nullOwnerTokens);
    }
}
