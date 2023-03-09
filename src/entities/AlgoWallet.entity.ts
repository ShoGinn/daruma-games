import type { AssetHolding } from '../model/types/algorand.js';
import type { FakeAsset } from '../model/types/darumaTraining.js';
import {
    Cascade,
    Collection,
    Entity,
    EntityRepository,
    EntityRepositoryType,
    Loaded,
    ManyToMany,
    ManyToOne,
    MikroORM,
    OneToMany,
    PrimaryKey,
    ref,
} from '@mikro-orm/core';
import type { Ref } from '@mikro-orm/core';
import { inlineCode } from 'discord.js';
import { container } from 'tsyringe';

import { AlgoNFTAsset } from './AlgoNFTAsset.entity.js';
import { AlgoStdAsset } from './AlgoStdAsset.entity.js';
import { AlgoStdToken } from './AlgoStdToken.entity.js';
import { CustomBaseEntity } from './BaseEntity.entity.js';
import { User } from './User.entity.js';
import { dtCacheKeys, GameNPCs, InternalUserIDs } from '../enums/dtEnums.js';
import { Algorand } from '../services/Algorand.js';
import { CustomCache } from '../services/CustomCache.js';
import { gameStatusHostedUrl, getAssetUrl } from '../utils/functions/dtImages.js';
import logger from '../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../utils/Utils.js';

// ========
// = Interfaces =
// ========
export interface AlgoStdAssetAdded {
    id: number;
    name: string;
    optedIn: boolean;
    tokens: bigint | number;
}
export interface AllWalletAssetsAdded {
    assetsUpdated: { assetsAdded: number; assetsRemoved: number; walletAssets: number } | undefined;
    asaAssetsString: string;
}

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoWalletRepository })
export class AlgoWallet extends CustomBaseEntity {
    [EntityRepositoryType]?: AlgoWalletRepository;

    @PrimaryKey({ autoincrement: false })
    address: string;

    @ManyToOne(() => User, { ref: true })
    owner: Ref<User>;

    @OneToMany(() => AlgoNFTAsset, asset => asset.wallet, {
        cascade: [Cascade.PERSIST],
        nullable: true,
    })
    nft = new Collection<AlgoNFTAsset>(this);

    @ManyToMany(() => AlgoStdAsset, asa => asa.wallet, {
        cascade: [Cascade.REMOVE],
    })
    asa = new Collection<AlgoStdAsset>(this);

    @OneToMany(() => AlgoStdToken, token => token.wallet, {
        orphanRemoval: true,
    })
    tokens = new Collection<AlgoStdToken>(this);

    constructor(walletAddress: string, owner: User) {
        super();
        this.address = walletAddress;
        this.owner = ref(owner);
    }
}

type WalletTokens = Promise<{
    optedInWallets: Array<AlgoWallet>;
    unclaimedTokens: number;
    walletWithMostTokens: AlgoWallet;
}>;

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class AlgoWalletRepository extends EntityRepository<AlgoWallet> {
    /**
     * Get all wallets that have not been updated in the last 24 hours
     *
     * @returns {*}  {Promise<Array<AlgoWallet>>}
     * @memberof AlgoWalletRepository
     */
    async anyWalletsUpdatedMoreThan24HoursAgo(): Promise<boolean> {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const wallets = await this.find(
            { updatedAt: { $lt: twentyFourHoursAgo } },
            { populate: ['owner'] }
        );
        // Filter out the bots
        const internalUserIds = Object.values(InternalUserIDs).map(String);
        const filteredWallets = wallets.filter(
            wallet => !internalUserIds.includes(wallet.owner.id)
        );
        return filteredWallets.length > 0;
    }
    /**
     * Get a user from the User table
     *
     * @param {string} discordId
     * @returns {*}  {Promise<User>}
     * @memberof AlgoWalletRepository
     */
    async getUser(discordId: string): Promise<User> {
        const em = container.resolve(MikroORM).em.fork();
        return await em.getRepository(User).findOneOrFail({ id: discordId });
    }
    /**
     * Get a wallet that has the NFTs loaded
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<Loaded<AlgoWallet, 'nft'>>}
     * @memberof AlgoWalletRepository
     */
    async getWalletsWithNFTsLoaded(walletAddress: string): Promise<Loaded<AlgoWallet, 'nft'>> {
        return await this.findOneOrFail({ address: walletAddress }, { populate: ['nft'] });
    }
    /**
     * Get all Wallets by the discord id
     *
     * @param {string} discordId
     * @returns {*}  {Promise<AlgoWallet[]>}
     * @memberof AlgoWalletRepository
     */
    async getAllWalletsByDiscordId(discordId: string): Promise<Array<AlgoWallet>> {
        const user = await this.getUser(discordId);
        return await this.find({ owner: user });
    }
    /**
     * Get all Wallets and Assets by the discord id
     *
     * @param {string} discordId
     * @returns {*}  {Promise<Array<AlgoWallet>>}
     * @memberof AlgoWalletRepository
     */
    async getAllWalletsAndAssetsByDiscordId(discordId: string): Promise<Array<AlgoWallet>> {
        const user = await this.getUser(discordId);
        return await this.find({ owner: user }, { populate: ['nft'] });
    }

    /**
     * Clear all assets cooldowns for all users
     *
     * @returns {*}  {Promise<void>}
     * @memberof AlgoWalletRepository
     */
    async clearAssetCoolDownsForAllUsers(): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();
        const users = await em.getRepository(User).getAllUsers();
        for (const user of users) {
            await this.clearAssetCoolDownsForUser(user.id);
        }
    }

    /**
     * Clear all assets cooldowns for a user
     *
     * @param {string} discordId
     * @returns {*}  {Promise<void>}
     * @memberof AlgoWalletRepository
     */
    async clearAssetCoolDownsForUser(discordId: string): Promise<void> {
        const wallets = await this.getAllWalletsAndAssetsByDiscordId(discordId);
        for (const wallet of wallets) {
            for (const asset of wallet.nft) {
                asset.dojoCoolDown = new Date(0);
            }
        }
        await this.persistAndFlush(wallets);
    }
    /**
     *  Clear a random assets cooldown for a user
     *
     * @param {string} discordId
     * @param {number} numberOfAssets
     * @returns {*}  {Promise<Array<AlgoNFTAsset>>}
     * @memberof AlgoWalletRepository
     */
    async randomAssetCoolDownReset(
        discordId: string,
        numberOfAssets: number
    ): Promise<Array<AlgoNFTAsset>> {
        const wallets = await this.getAllWalletsAndAssetsByDiscordId(discordId);
        const em = container.resolve(MikroORM).em.fork();
        const algoNFT = em.getRepository(AlgoNFTAsset);
        let assetsToReset: Array<AlgoNFTAsset> = [];
        let allAssets: Array<AlgoNFTAsset> = [];
        // add all assets from all wallets into array
        for (const wallet of wallets) {
            allAssets = [...allAssets, ...wallet.nft.getItems()];
        }
        // Shuffle the array and then pick numberOfAssets from the shuffled array
        allAssets = ObjectUtil.shuffle(allAssets);
        assetsToReset = allAssets.slice(0, numberOfAssets);

        // Reset the cooldowns
        for (const asset of assetsToReset) {
            await algoNFT.zeroOutAssetCooldown(asset);
        }
        await this.persistAndFlush(wallets);
        // return the assets that were reset
        return assetsToReset;
    }
    /**
     * Get all the creator wallets
     *
     * @returns {*}  {Promise<AlgoWallet[]>}
     * @memberof AlgoWalletRepository
     */
    async getCreatorWallets(): Promise<Array<AlgoWallet>> {
        const creatorID = InternalUserIDs.creator.toString();
        return await this.find({ owner: { id: creatorID } });
    }

    /**
     * Add a wallet with creator as owner
     *
     * @param {string} walletAddress
     * @returns {*}  {(Promise<AlgoWallet | null>)}
     * @memberof AlgoWalletRepository
     */
    async addCreatorWallet(walletAddress: string): Promise<AlgoWallet | null> {
        const em = container.resolve(MikroORM).em.fork();
        const algoNFTRepo = em.getRepository(AlgoNFTAsset);
        const creatorID = InternalUserIDs.creator.toString();

        let user = await em.getRepository(User).findOne({ id: creatorID });
        if (!user) {
            const newUser = new User(creatorID);
            await em.getRepository(User).persistAndFlush(newUser);
            user = newUser;
        }

        if (await this.findOne({ address: walletAddress })) {
            return null;
        }

        const wallet = new AlgoWallet(walletAddress, user);
        await this.persistAndFlush(wallet);
        await algoNFTRepo.creatorAssetSync();
        return wallet;
    }
    /**
     * Remove a wallet with creator as owner
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<void>}
     * @memberof AlgoWalletRepository
     */
    async removeCreatorWallet(walletAddress: string): Promise<void> {
        // Remove Assets that are owned by the wallet and delete the wallet
        const em = container.resolve(MikroORM).em.fork();
        const wallet = await this.findOneOrFail({ address: walletAddress });
        const assets = await em.getRepository(AlgoNFTAsset).find({
            creator: wallet,
        });
        for (const asset of assets) {
            await em.getRepository(AlgoNFTAsset).removeAndFlush(asset);
        }
        await this.removeAndFlush(wallet);
    }

    /**
     * Get the total number of assets of a wallet
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<number>}
     * @memberof AlgoWalletRepository
     */
    async getTotalWalletAssets(walletAddress: string): Promise<number> {
        const walletEntity = await this.getWalletsWithNFTsLoaded(walletAddress);
        return walletEntity.nft.count();
    }
    /**
     * Get the ASA assets of a wallet
     *
     * @param {string} walletAddress
     * @param {number} stdAssetId
     * @returns {*}  {(Promise<AlgoStdAsset | null>)}
     * @memberof AlgoWalletRepository
     */
    async getWalletStdAsset(
        walletAddress: string,
        stdAssetId: number
    ): Promise<AlgoStdAsset | null> {
        const walletEntity = await this.findOneOrFail(
            { address: walletAddress },
            { populate: ['asa'] }
        );
        return walletEntity.asa.getItems().find(asset => asset.id === stdAssetId) ?? null;
    }
    /**
     * Get the total number of assets of a user
     *
     * @param {string} discordId
     * @returns {*}  {Promise<number>}
     * @memberof AlgoWalletRepository
     */
    async getTotalAssetsByDiscordUser(discordId: string): Promise<number> {
        const user = await this.getUser(discordId);
        const wallets = await this.find({ owner: user });
        let totalAssets = 0;
        for (const wallet of wallets) {
            const walletEntity = await this.getWalletsWithNFTsLoaded(wallet.address);
            totalAssets += walletEntity.nft.count();
        }
        return totalAssets;
    }
    /**
     * Get the last updated date of a wallet
     *
     * @param {string} discordId
     * @returns {*}  {Promise<Date>}
     * @memberof AlgoWalletRepository
     */
    async lastUpdatedDate(discordId: string): Promise<Date> {
        const user = await this.getUser(discordId);
        const wallets = await this.find({ owner: user });
        // Get the last updated date of the wallet
        let lastUpdatedDate: Date = new Date(0);
        for (const wallet of wallets) {
            if (wallet.updatedAt > lastUpdatedDate) {
                lastUpdatedDate = wallet.updatedAt;
            }
        }
        return lastUpdatedDate;
    }

    /**
     * Get a Random Image from the wallet
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<string>}
     * @memberof AlgoWalletRepository
     */
    async getRandomImageUrl(walletAddress: string): Promise<string> {
        const walletEntity = await this.getWalletsWithNFTsLoaded(walletAddress);
        const assets = walletEntity.nft.getItems();
        const randomAsset = ObjectUtil.getRandomElement(ObjectUtil.shuffle(assets));
        return await getAssetUrl(randomAsset);
    }

    /**
     * Add the enabled standard assets to the wallet
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<string>}
     * @memberof AlgoWalletRepository
     */
    async addAllAlgoStdAssetFromDB(walletAddress: string): Promise<Array<AlgoStdAssetAdded>> {
        const em = container.resolve(MikroORM).em.fork();

        // Get all the ASA's registered to the bot
        const algoStdAssets = await em.getRepository(AlgoStdAsset).getAllStdAssets();
        const wallet = await this.findOneOrFail({ address: walletAddress });
        const stdToken = em.getRepository(AlgoStdToken);
        const assetsAdded: Array<AlgoStdAssetAdded> = [];
        await Promise.all(
            algoStdAssets.map(async asset => {
                // Add the asset to the wallet
                const { optedIn, tokens } = await stdToken.addAlgoStdToken(wallet, asset);
                assetsAdded.push({
                    id: asset.id,
                    name: asset.name,
                    optedIn: optedIn,
                    tokens: tokens,
                });
            })
        );
        return assetsAdded;
    }
    /**
     * Generate a string from the AlgoStdAssetAdded Array
     *
     * @param {Array<AlgoStdAssetAdded>} array
     * @returns {*}  {string}
     * @memberof AlgoWalletRepository
     */
    generateStringFromAlgoStdAssetAddedArray(array: Array<AlgoStdAssetAdded>): string {
        return array
            .map(asset =>
                inlineCode(
                    `Name: ${asset.name} -- Tokens: ${asset.tokens.toLocaleString()} -- Opted-In: ${
                        asset.optedIn
                    }`
                )
            )
            .join('\n');
    }
    /**
     * Add all the assets to the wallet
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<AllWalletAssetsAdded>}
     * @memberof AlgoWalletRepository
     */
    async addAllAssetsToWallet(walletAddress: string): Promise<AllWalletAssetsAdded> {
        const algorand = container.resolve(Algorand);
        const algorandAssets = await algorand.lookupAssetsOwnedByAccount(walletAddress);

        const assetsUpdated = await this.addWalletAssets(walletAddress, algorandAssets);
        const asaAssetsAdded = await this.addAllAlgoStdAssetFromDB(walletAddress);
        const asaAssetsString = this.generateStringFromAlgoStdAssetAddedArray(asaAssetsAdded);
        return { assetsUpdated, asaAssetsString };
    }

    /**
     * Links the wallet to the assets
     *
     * @param {string} walletAddress
     * @param {number[]} holderAssets
     * @returns {*}  {Promise<{ assetsAdded: number; assetsRemoved: number; walletAssets: number } | undefined>}
     * @memberof AssetWallet
     */
    async addWalletAssets(
        walletAddress: string,
        holderAssets: Array<AssetHolding>
    ): Promise<{ assetsAdded: number; assetsRemoved: number; walletAssets: number } | undefined> {
        const em = container.resolve(MikroORM).em.fork();
        const creatorAssets = await em.getRepository(AlgoNFTAsset).getAllRealWorldAssets();

        try {
            const wallet = await this.findOneOrFail(
                { address: walletAddress },
                { populate: ['nft'] }
            );
            const walletAssets = wallet.nft.getItems();
            const assetsToAdd: AlgoNFTAsset[] = [];
            const assetsToRemove: AlgoNFTAsset[] = [];
            for (const holderAsset of holderAssets) {
                const creatorAsset = creatorAssets.find(
                    asset => asset.id === holderAsset['asset-id']
                );
                if (!creatorAsset) {
                    continue;
                }

                const walletAsset = walletAssets.find(asset => asset.id === creatorAsset.id);
                if (!walletAsset && holderAsset.amount > 0) {
                    // Asset is not in wallet but is in holder assets
                    assetsToAdd.push(creatorAsset);
                } else if (walletAsset && holderAsset.amount === 0) {
                    // Asset is in wallet but not in holder assets
                    assetsToRemove.push(walletAsset);
                }
            }

            for (const asset of assetsToAdd) {
                wallet.nft.add(asset);
            }

            for (const asset of assetsToRemove) {
                wallet.nft.remove(asset);
            }

            wallet.updatedAt = new Date();
            await this.flush();

            return {
                assetsAdded: assetsToAdd.length,
                assetsRemoved: assetsToRemove.length,
                walletAssets: wallet.nft.getItems().length,
            };
        } catch (e) {
            if (e instanceof Error) {
                logger.error(`Error adding wallet assets: ${e.message}`);
            }
        }
    }

    /**
     * Get all the tokens added to the wallet
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<Array<AlgoStdToken>>}
     * @memberof AlgoWalletRepository
     */
    async getTokensAddedToWallet(walletAddress: string): Promise<Array<AlgoStdToken>> {
        const wallet = await this.findOneOrFail(
            { address: walletAddress },
            { populate: ['tokens'] }
        );
        return wallet.tokens.getItems();
    }

    /**
     * Get all the wallets for a discord user and check if they are opted into the asset
     * If they are opted in, add them to the list of opted in wallets
     *
     * @param {string} discordUser
     * @param {AlgoStdAsset} stdAsset
     * @returns {*}  {WalletTokens}
     * @memberof AlgoWalletRepository
     */
    async allWalletsOptedIn(discordUser: string, stdAsset: AlgoStdAsset): WalletTokens {
        const wallets = await this.getAllWalletsByDiscordId(discordUser);
        const optedInWallets: Array<AlgoWallet> = [];
        let unclaimedTokens = 0;
        let indexOfWalletWithMostTokens = -1;
        let mostTokens = -1;
        for (let i = 0; i < wallets.length; i++) {
            const walletTokens = await this.getTokensAddedToWallet(wallets[i].address);
            for (const walletToken of walletTokens) {
                await walletToken.asa.init();
                if (
                    stdAsset &&
                    walletToken.asa[0]?.unitName == stdAsset.unitName &&
                    walletToken.optedIn
                ) {
                    optedInWallets.push(wallets[i]);
                    unclaimedTokens += walletToken.unclaimedTokens;
                    const currentTokens = walletToken.tokens;
                    if (currentTokens > mostTokens) {
                        indexOfWalletWithMostTokens = i;
                        mostTokens = currentTokens;
                    }
                }
            }
        }
        const walletWithMostTokens = wallets[indexOfWalletWithMostTokens];
        return { optedInWallets, unclaimedTokens, walletWithMostTokens };
    }
    /**
     * Check if all the NPC assets exist in the database
     *
     * @returns {*}  {Promise<boolean>}
     * @memberof AlgoWalletRepository
     */
    async checkAllNPCsExist(): Promise<boolean> {
        const em = container.resolve(MikroORM).em.fork();
        const matchingAssets = await em.getRepository(AlgoNFTAsset).find({
            id: { $in: GameNPCs.map(bot => bot.assetIndex) },
        });
        return matchingAssets.length === GameNPCs.length;
    }

    /**
     * Create the NPC assets if they do not exist
     *
     * @returns {*}  {Promise<boolean>}
     * @memberof AlgoWalletRepository
     */
    async createNPCsIfNotExists(): Promise<boolean> {
        const em = container.resolve(MikroORM).em.fork();
        // Count the number of matching assets in the repository
        if (await this.checkAllNPCsExist()) return false;
        const botCreatorWallet = await this.createFakeWallet(InternalUserIDs.botCreator.toString());
        for (const bot of GameNPCs) {
            const { name, gameType, assetIndex } = bot;
            // The fake wallets are real generated Algorand wallets
            const newAsset: FakeAsset = {
                assetIndex,
                name: name,
                unitName: name,
                url: gameStatusHostedUrl(gameType, 'npc'),
            };
            await em.getRepository(AlgoNFTAsset).createNPCAsset(botCreatorWallet, newAsset);
        }
        logger.info('NPC wallets created');
        return true;
    }

    /**
     * Create a fake wallet for the bot creator
     *
     * @private
     * @param {string} fakeID
     * @returns {*}  {Promise<AlgoWallet>}
     * @memberof AlgoWalletRepository
     */
    private async createFakeWallet(fakeID: string): Promise<AlgoWallet> {
        const em = container.resolve(MikroORM).em.fork();

        const algorand = container.resolve(Algorand);
        // Check if the fake user exists
        let newFakeUser = await em.getRepository(User).findOne({ id: fakeID });
        if (newFakeUser) {
            // Delete all the wallets associated with the fake user
            const walletOwner = await em
                .getRepository(User)
                .findOneOrFail({ id: fakeID }, { populate: ['algoWallets'] });
            for (const algoWallet of walletOwner.algoWallets) {
                this.removeCreatorWallet(algoWallet.address);
            }
        } else {
            newFakeUser = new User(fakeID);
            await em.getRepository(User).persistAndFlush(newFakeUser);
        }
        const fakeWallet = algorand.generateWalletAccount();
        const newFakeWallet = new AlgoWallet(fakeWallet, newFakeUser);
        await this.persistAndFlush(newFakeWallet);
        return newFakeWallet;
    }

    /**
     * Get all assets owned by a user that are playable
     *
     * @param {string} discordId
     * @returns {*}  {Promise<Array<AlgoNFTAsset>>}
     * @memberof AlgoWalletRepository
     */
    async getPlayableAssets(discordId: string): Promise<Array<AlgoNFTAsset>> {
        const wallets = await this.getAllWalletsAndAssetsByDiscordId(discordId);
        const playableAssets: Array<AlgoNFTAsset> = [];
        for (const wallet of wallets) {
            for (const asset of wallet.nft) {
                playableAssets.push(asset);
            }
        }
        return playableAssets;
    }

    /**
     * Provides a list of all the NFTs that are currently in the game sorted by the number of times they have been played
     *
     * @returns {*}  {Promise<Map<string, number>>}
     * @memberof AlgoWalletRepository
     */
    async topNFTHolders(): Promise<Map<string, number>> {
        const cache = container.resolve(CustomCache);
        const em = container.resolve(MikroORM).em.fork();
        let topNFTHolders = (await cache.get(dtCacheKeys.TOP_NFT_HOLDERS)) as Map<string, number>;
        if (!topNFTHolders) {
            const allUsers = await em.getRepository(User).getAllUsers();
            // create a user collection
            const userCounts = new Map<string, number>();
            for (const user of allUsers) {
                const allWallets = await this.getAllWalletsAndAssetsByDiscordId(user.id);
                // Count total NFT in wallet
                const totalNFT = allWallets.reduce((total, wallet) => total + wallet.nft.length, 0);
                if (totalNFT > 0) {
                    userCounts.set(user.id, totalNFT);
                }
            }
            // Sort userCounts
            topNFTHolders = new Map([...userCounts.entries()].sort((a, b) => b[1] - a[1]));
            cache.set(dtCacheKeys.TOP_NFT_HOLDERS, topNFTHolders, 600);
        }
        return topNFTHolders;
    }
}
