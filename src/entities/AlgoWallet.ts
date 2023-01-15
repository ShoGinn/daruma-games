import {
    Cascade,
    Collection,
    Entity,
    EntityRepository,
    EntityRepositoryType,
    ManyToMany,
    ManyToOne,
    MikroORM,
    OneToMany,
    PrimaryKey,
    ref,
} from '@mikro-orm/core';
import type { Ref } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { AlgoNFTAsset } from './AlgoNFTAsset.js';
import { AlgoStdAsset } from './AlgoStdAsset.js';
import { AlgoStdToken } from './AlgoStdToken.js';
import { CustomBaseEntity } from './BaseEntity.js';
import { Data } from './Data.js';
import { User } from './User.js';
import { BotNames, dtCacheKeys, enumKeys, InternalUserIDs } from '../enums/dtEnums.js';
import { Algorand } from '../services/Algorand.js';
import { CustomCache } from '../services/CustomCache.js';
import { gameStatusHostedUrl, getAssetUrl } from '../utils/functions/dtImages.js';
import logger from '../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../utils/Utils.js';
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

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class AlgoWalletRepository extends EntityRepository<AlgoWallet> {
    /**
     * Get all Wallets by the discord id
     *
     * @param {string} discordId
     * @returns {*}  {Promise<AlgoWallet[]>}
     * @memberof AlgoWalletRepository
     */
    async getAllWalletsByDiscordId(discordId: string): Promise<AlgoWallet[]> {
        const em = container.resolve(MikroORM).em.fork();
        const user = await em.getRepository(User).findOneOrFail({ id: discordId });
        return await this.find({ owner: user });
    }
    async getAllWalletsAndAssetsByDiscordId(discordId: string): Promise<AlgoWallet[]> {
        const em = container.resolve(MikroORM).em.fork();
        const user = await em.getRepository(User).findOneOrFail({ id: discordId });
        return await this.find({ owner: user }, { populate: ['nft'] });
    }
    async clearAllDiscordUserAssetCoolDowns(discordId: string): Promise<void> {
        const wallets = await this.getAllWalletsAndAssetsByDiscordId(discordId);
        for (const wallet of wallets) {
            for (const asset of wallet.nft) {
                if (asset.note) {
                    asset.note.coolDown = 0;
                }
            }
        }
        await this.persistAndFlush(wallets);
    }
    async randomAssetCoolDownReset(
        discordId: string,
        numberOfAssets: number
    ): Promise<AlgoNFTAsset[]> {
        const wallets = await this.getAllWalletsAndAssetsByDiscordId(discordId);
        let assetsToReset: AlgoNFTAsset[] = [];
        let allAssets: AlgoNFTAsset[] = [];
        // add all assets from all wallets into array
        for (const wallet of wallets) {
            allAssets = [...allAssets, ...wallet.nft.getItems()];
        }
        // Shuffle the array and then pick numberOfAssets from the shuffled array
        allAssets = ObjectUtil.shuffle(allAssets);
        assetsToReset = allAssets.slice(0, numberOfAssets);

        // Reset the cooldowns
        for (const asset of assetsToReset) {
            if (asset.note) {
                asset.note.coolDown = 0;
            }
        }
        await this.persistAndFlush(wallets);
        // return the assets that were reset
        return assetsToReset;
    }
    async clearCoolDownsForAllDiscordUsers(): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();
        const users = await em.getRepository(User).getAllUsers();
        for (const user of users) {
            await this.clearAllDiscordUserAssetCoolDowns(user.id);
        }
    }
    /**
     * Get all the creator wallets
     *
     * @returns {*}  {Promise<AlgoWallet[]>}
     * @memberof AlgoWalletRepository
     */
    async getCreatorWallets(): Promise<AlgoWallet[]> {
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

        const algorand = container.resolve(Algorand);

        const creatorID = InternalUserIDs.creator.toString();

        let user = await em.getRepository(User).findOne({ id: creatorID });
        if (!user) {
            const newUser = new User();
            newUser.id = creatorID;
            await em.getRepository(User).persistAndFlush(newUser);
            user = newUser;
        }
        if (!(await this.findOne({ address: walletAddress }))) {
            const wallet = new AlgoWallet(walletAddress, user);
            await this.persistAndFlush(wallet);
            await algorand.creatorAssetSync();
            return wallet;
        }
        return null;
    }
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
        const walletEntity = await this.findOneOrFail(
            { address: walletAddress },
            { populate: ['nft'] }
        );
        return walletEntity.nft.count();
    }
    async getWalletStdAsset(walletAddress: string, stdAssetId: number): Promise<AlgoStdAsset> {
        const walletEntity = await this.findOneOrFail(
            { address: walletAddress },
            { populate: ['asa'] }
        );
        return walletEntity.asa.getItems().find(asset => asset.id === stdAssetId);
    }
    async getTotalAssetsByDiscordUser(discordId: string): Promise<number> {
        const em = container.resolve(MikroORM).em.fork();
        const user = await em.getRepository(User).findOneOrFail({ id: discordId });
        const wallets = await this.find({ owner: user });
        let totalAssets = 0;
        for (const wallet of wallets) {
            const walletEntity = await this.findOneOrFail(
                { address: wallet.address },
                { populate: ['nft'] }
            );
            totalAssets += walletEntity.nft.count();
        }
        return totalAssets;
    }
    async lastUpdatedDate(discordId: string): Promise<Date> {
        const em = container.resolve(MikroORM).em.fork();
        const user = await em.getRepository(User).findOneOrFail({ id: discordId });
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
        const walletEntity = await this.findOneOrFail(
            { address: walletAddress },
            { populate: ['nft'] }
        );
        const assets = walletEntity.nft.getItems();
        const randomAsset = ObjectUtil.getRandomElement(ObjectUtil.shuffle(assets));
        return getAssetUrl(randomAsset);
    }

    /**
     * Add the enabled standard assets to the wallet
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<string[]>}
     * @memberof AlgoWalletRepository
     */
    async addAllAlgoStdAssetFromDB(walletAddress: string): Promise<string> {
        const em = container.resolve(MikroORM).em.fork();

        const algorand = container.resolve(Algorand);
        // Get all the ASA's registered to the bot
        const algoStdAssets = await em.getRepository(AlgoStdAsset).getAllStdAssets();
        const wallet = await this.findOneOrFail({ address: walletAddress }, { populate: ['asa'] });
        const stdToken = em.getRepository(AlgoStdToken);
        const assetsAdded: string[] = [];
        await Promise.all(
            algoStdAssets.map(async asset => {
                // Check if the Wallet is opted into the ASA
                const { optedIn, tokens } = await algorand.getTokenOptInStatus(
                    walletAddress,
                    asset.id
                );
                // Add the asset to the wallet
                await stdToken.addAlgoStdToken(wallet, asset, tokens, optedIn);
                assetsAdded.push(asset.name);
                if (!optedIn) {
                    assetsAdded.push(`${asset.name} (Not Opted In)`);
                }
            })
        );
        return assetsAdded.join('\n');
    }

    /**
     * Links the wallet to the assets
     *
     * @param {string} walletAddress
     * @param {number[]} holderAssets
     * @returns {*}  {Promise<number>}
     * @memberof AssetWallet
     */
    async addWalletAssets(
        walletAddress: string,
        holderAssets: AlgorandPlugin.AssetHolding[]
    ): Promise<number> {
        await this.clearWalletAssets(walletAddress);
        const em = container.resolve(MikroORM).em.fork();

        const creatorAssets = await em.getRepository(AlgoNFTAsset).getAllPlayerAssets();

        try {
            const wallet = await this.findOneOrFail(
                { address: walletAddress },
                { populate: ['nft'] }
            );
            let assetCount = 0;
            for (const holderAsset of holderAssets) {
                for (const creatorAsset of creatorAssets) {
                    if (holderAsset['asset-id'] == creatorAsset.id && holderAsset.amount > 0) {
                        assetCount++;
                        wallet.nft.add(creatorAsset);
                    }
                }
            }
            wallet.updatedAt = new Date();
            await this.flush();

            return assetCount;
        } catch (e) {
            logger.error(`Error adding wallet assets: ${e.message}`);
            return -1;
        }
    }
    async clearWalletAssets(walletAddress: string): Promise<void> {
        const wallet = await this.findOneOrFail({ address: walletAddress }, { populate: ['nft'] });
        wallet.nft.removeAll();
        await this.flush();
    }

    async getWalletTokens(walletAddress: string): Promise<AlgoStdToken[]> {
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
     * @returns {*}  {Promise<{
     *         optedInWallets: AlgoWallet[];
     *         unclaimedKarma: number;
     *         walletWithMostTokens: AlgoWallet;
     *     }>}
     * @memberof AlgoWalletRepository
     */
    async allWalletsOptedIn(
        discordUser: string,
        stdAsset: AlgoStdAsset
    ): Promise<{
        optedInWallets: AlgoWallet[];
        unclaimedKarma: number;
        walletWithMostTokens: AlgoWallet;
    }> {
        const wallets = await this.getAllWalletsByDiscordId(discordUser);
        const optedInWallets: AlgoWallet[] = [];
        let unclaimedKarma = 0;
        let mostTokensIndex = -1;
        const mostTokens = -1;
        for (let i = 0; i < wallets.length; i++) {
            const walletTokens = await this.getWalletTokens(wallets[i].address);
            for (const walletToken of walletTokens) {
                await walletToken.asa.init();
                if (walletToken.asa[0]?.unitName == stdAsset.unitName && walletToken.optedIn) {
                    optedInWallets.push(wallets[i]);
                    unclaimedKarma += walletToken.unclaimedTokens;
                    if (walletToken.tokens > mostTokens) {
                        mostTokensIndex = i;
                    }
                }
            }
        }
        const walletWithMostTokens = optedInWallets[mostTokensIndex];
        return { optedInWallets, unclaimedKarma, walletWithMostTokens };
    }
    async createBotNPCs(): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();

        const dataRepository = em.getRepository(Data);
        const botNPCsCreated = await dataRepository.get('botNPCsCreated');
        if (botNPCsCreated) {
            return;
        }
        logger.info('Creating Bot NPCs');
        // Use the bot creator wallet (Id 2) to create the bot NPCs
        const botCreatorWallet = await this.createFakeWallet(InternalUserIDs.botCreator.toString());
        // The bot ID's are necessary for adding to the game and finding their asset
        const botWallets = [InternalUserIDs.OneVsNpc, InternalUserIDs.FourVsNpc];
        const botNames = [BotNames.OneVsNpc, BotNames.FourVsNpc];
        // The Game types is for the game image assets
        const gameTypes = enumKeys(BotNames);

        for (let i = 0; i < botWallets.length; i++) {
            const walletID = botWallets[i];
            const currentBotName = botNames[i];
            // The fake wallets are real generated Algorand wallets
            const botWallet = await this.createFakeWallet(walletID.toString());
            const newAsset: DarumaTrainingPlugin.FakeAsset = {
                assetIndex: walletID,
                name: currentBotName,
                unitName: currentBotName,
                url: gameStatusHostedUrl(gameTypes[i], 'npc'),
            };
            await em.getRepository(AlgoNFTAsset).createNPCAsset(botCreatorWallet, newAsset);
            const pulledAsset = await em
                .getRepository(AlgoNFTAsset)
                .findOneOrFail({ id: walletID });
            botWallet.nft.add(pulledAsset);
            await this.persistAndFlush(botWallet);
        }
        await dataRepository.set('botNPCsCreated', true);
        logger.info('Bot NPCs Created');
    }

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
                await em.getRepository(AlgoWallet).removeAndFlush(algoWallet);
            }
        } else {
            newFakeUser = new User();
            newFakeUser.id = fakeID;
            await em.getRepository(User).persistAndFlush(newFakeUser);
        }
        const fakeWallet = algorand.createFakeWallet();
        const newFakeWallet = new AlgoWallet(fakeWallet, newFakeUser);
        await this.persistAndFlush(newFakeWallet);
        return newFakeWallet;
    }
    async getPlayableAssets(discordId: string): Promise<AlgoNFTAsset[]> {
        const wallets = await this.getAllWalletsAndAssetsByDiscordId(discordId);
        const playableAssets: AlgoNFTAsset[] = [];
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
        let topNFTHolders: Map<string, number> = await cache.get(dtCacheKeys.TOPNFTHOLDERS);
        if (!topNFTHolders) {
            const allUsers = await em.getRepository(User).getAllUsers();
            // create a user collection
            const userCounts = new Map<string, number>();
            for (const user of allUsers) {
                const allWallets = await this.getAllWalletsAndAssetsByDiscordId(user.id);
                // Count total NFT in wallet
                let totalNFT = 0;
                for (const wallet of allWallets) {
                    totalNFT += wallet.nft.length;
                }
                userCounts.set(user.id, totalNFT);
            }
            // Sort userCounts
            topNFTHolders = new Map([...userCounts.entries()].sort((a, b) => b[1] - a[1]));
            cache.set(dtCacheKeys.TOPNFTHOLDERS, topNFTHolders, 60 * 10);
        }
        return topNFTHolders;
    }
}
