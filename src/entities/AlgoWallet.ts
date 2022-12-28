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
    Property,
    ref,
} from '@mikro-orm/core';
import type { Ref } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { BotNames, dtCacheKeys, enumKeys, InternalUserIDs } from '../enums/dtEnums.js';
import { Algorand } from '../services/Algorand.js';
import { CustomCache } from '../services/CustomCache.js';
import { gameStatusHostedUrl, getAssetUrl } from '../utils/functions/dtImages.js';
import logger from '../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../utils/Utils.js';
import { AlgoNFTAsset } from './AlgoNFTAsset.js';
import { AlgoStdAsset } from './AlgoStdAsset.js';
import { AlgoStdToken } from './AlgoStdToken.js';
import { CustomBaseEntity } from './BaseEntity.js';
import { Data } from './Data.js';
import { User } from './User.js';
// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoWalletRepository })
export class AlgoWallet extends CustomBaseEntity {
    [EntityRepositoryType]?: AlgoWalletRepository;

    @PrimaryKey({ autoincrement: false })
    walletAddress: string;

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    @Property()
    rxWallet: boolean = false;

    @ManyToOne(() => User, { ref: true })
    owner: Ref<User>;

    @OneToMany(() => AlgoNFTAsset, asset => asset.ownerWallet, {
        cascade: [Cascade.PERSIST],
        nullable: true,
    })
    assets = new Collection<AlgoNFTAsset>(this);

    @ManyToMany(() => AlgoStdAsset, asa => asa.ownerWallet, {
        cascade: [Cascade.REMOVE],
    })
    algoStdAsset = new Collection<AlgoStdAsset>(this);

    @OneToMany(() => AlgoStdToken, token => token.ownerWallet, {
        orphanRemoval: true,
    })
    algoStdTokens = new Collection<AlgoStdToken>(this);

    constructor(walletAddress: string, owner: User) {
        super();
        this.walletAddress = walletAddress;
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
        const wallets = await this.find({ owner: user });
        return wallets;
    }
    async getAllWalletsAndAssetsByDiscordId(discordId: string): Promise<AlgoWallet[]> {
        const em = container.resolve(MikroORM).em.fork();
        const user = await em.getRepository(User).findOneOrFail({ id: discordId });
        const wallets = await this.find({ owner: user }, { populate: ['assets'] });
        return wallets;
    }
    async clearAllDiscordUserAssetCoolDowns(discordId: string): Promise<void> {
        let wallets = await this.getAllWalletsAndAssetsByDiscordId(discordId);
        for (let index = 0; index < wallets.length; index++) {
            const wallet = wallets[index];
            for (let i = 0; i < wallet.assets.length; i++) {
                const asset = wallet.assets[i];
                if (asset.assetNote) {
                    asset.assetNote.coolDown = 0;
                }
            }
        }
        await this.persistAndFlush(wallets);
    }
    async clearCoolDownsForAllDiscordUsers(): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();
        const users = await em.getRepository(User).getAllUsers();
        for (let index = 0; index < users.length; index++) {
            const user = users[index];
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
        let creatorID = InternalUserIDs.creator.toString();
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

        let creatorID = InternalUserIDs.creator.toString();

        let user = await em.getRepository(User).findOne({ id: creatorID });
        if (!user) {
            const newUser = new User();
            newUser.id = creatorID;
            await em.getRepository(User).persistAndFlush(newUser);
            user = newUser;
        }
        if (!(await this.findOne({ walletAddress: walletAddress }))) {
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
        const wallet = await this.findOneOrFail({ walletAddress: walletAddress });
        const assets = await em.getRepository(AlgoNFTAsset).find({
            creatorWalletAddress: wallet,
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
            { walletAddress: walletAddress },
            { populate: ['assets'] }
        );
        return walletEntity.assets.count();
    }
    async getTotalAssetsByDiscordUser(discordId: string): Promise<number> {
        const em = container.resolve(MikroORM).em.fork();
        const user = await em.getRepository(User).findOneOrFail({ id: discordId });
        const wallets = await this.find({ owner: user });
        let totalAssets = 0;
        for (const wallet of wallets) {
            const walletEntity = await this.findOneOrFail(
                { walletAddress: wallet.walletAddress },
                { populate: ['assets'] }
            );
            totalAssets += walletEntity.assets.count();
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
            { walletAddress: walletAddress },
            { populate: ['assets'] }
        );
        const assets = walletEntity.assets.getItems();
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
        const wallet = await this.findOneOrFail(
            { walletAddress: walletAddress },
            { populate: ['algoStdAsset'] }
        );
        let assetsAdded: string[] = [];
        await Promise.all(
            algoStdAssets.map(async asset => {
                // Check if the Wallet is opted into the ASA
                const { optedIn, tokens } = await algorand.getTokenOptInStatus(
                    walletAddress,
                    asset.assetIndex
                );
                if (optedIn) {
                    // Add the asset to the wallet
                    await em.getRepository(AlgoStdToken).addAlgoStdToken(wallet, asset, tokens);
                    assetsAdded.push(asset.name);
                } else {
                    assetsAdded.push(`Not opted into ${asset.name}`);
                    // TODO: change rx wallet to be per ASA
                    wallet.rxWallet = false;
                    await this.persistAndFlush(wallet);
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
                { walletAddress: walletAddress },
                { populate: ['assets'] }
            );
            let assetCount = 0;
            for (let i = 0; i < holderAssets.length; i++) {
                for (let j = 0; j < creatorAssets.length; j++) {
                    if (
                        holderAssets[i]['asset-id'] == creatorAssets[j].assetIndex &&
                        holderAssets[i].amount > 0
                    ) {
                        assetCount++;
                        wallet.assets.add(creatorAssets[j]);
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
        const wallet = await this.findOneOrFail(
            { walletAddress: walletAddress },
            { populate: ['assets'] }
        );
        wallet.assets.removeAll();
        await this.flush();
    }

    async getWalletTokens(walletAddress: string): Promise<AlgoStdToken[]> {
        const wallet = await this.findOneOrFail(
            { walletAddress: walletAddress },
            { populate: ['algoStdTokens'] }
        );
        const wallets = wallet.algoStdTokens.getItems();
        return wallets;
    }

    async createBotNPCs(): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();

        const dataRepository = em.getRepository(Data);
        const botNPCsCreated = await dataRepository.get('botNPCsCreated');
        if (!botNPCsCreated) {
            logger.info('Creating Bot NPCs');
            // Use the bot creator wallet (Id 2) to create the bot NPCs
            const botCreatorWallet = await this.createFakeWallet(
                InternalUserIDs.botCreator.toString()
            );
            // The bot ID's are necessary for adding to the game and finding their asset
            let botWallets = [InternalUserIDs.OneVsNpc, InternalUserIDs.FourVsNpc];
            let botNames = [BotNames.OneVsNpc, BotNames.FourVsNpc];
            // The Game types is for the game image assets
            let gameTypes = enumKeys(BotNames);

            for (let i = 0; i < botWallets.length; i++) {
                let walletID = botWallets[i];
                let currentBotName = botNames[i];
                // The fake wallets are real generated Algorand wallets
                const botWallet = await this.createFakeWallet(walletID.toString());
                const newAsset: DarumaTrainingPlugin.FakeAsset = {
                    assetIndex: walletID,
                    name: currentBotName,
                    unitName: currentBotName,
                    url: gameStatusHostedUrl(gameTypes[i], 'npc'),
                };
                await em.getRepository(AlgoNFTAsset).createNPCAsset(botCreatorWallet, newAsset);
                let pulledAsset = await em
                    .getRepository(AlgoNFTAsset)
                    .findOneOrFail({ assetIndex: walletID });
                botWallet.assets.add(pulledAsset);
                await this.persistAndFlush(botWallet);
            }
            await dataRepository.set('botNPCsCreated', true);
            logger.info('Bot NPCs Created');
        }
    }

    private async createFakeWallet(fakeID: string): Promise<AlgoWallet> {
        const em = container.resolve(MikroORM).em.fork();

        const algorand = container.resolve(Algorand);
        // Check if the fake user exists
        let newFakeUser = await em.getRepository(User).findOne({ id: fakeID });
        if (!newFakeUser) {
            newFakeUser = new User();
            newFakeUser.id = fakeID;
            await em.getRepository(User).persistAndFlush(newFakeUser);
        } else {
            // Delete all the wallets associated with the fake user
            const walletOwner = await em
                .getRepository(User)
                .findOneOrFail({ id: fakeID }, { populate: ['algoWallets'] });
            for (let i = 0; i < walletOwner.algoWallets.length; i++) {
                await em.getRepository(AlgoWallet).removeAndFlush(walletOwner.algoWallets[i]);
            }
        }
        let fakeWallet = algorand.createFakeWallet();
        const newFakeWallet = new AlgoWallet(fakeWallet, newFakeUser);
        await this.persistAndFlush(newFakeWallet);
        return newFakeWallet;
    }
    async getPlayableAssets(discordId: string): Promise<AlgoNFTAsset[]> {
        const wallets = await this.getAllWalletsAndAssetsByDiscordId(discordId);
        let playableAssets: AlgoNFTAsset[] = [];
        for (let index = 0; index < wallets.length; index++) {
            const wallet = wallets[index];
            for (let i = 0; i < wallet.assets.length; i++) {
                const asset = wallet.assets[i];
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
            let userCounts = new Map<string, number>();
            for (let i = 0; i < allUsers.length; i++) {
                const user = allUsers[i];
                const allWallets = await this.getAllWalletsAndAssetsByDiscordId(user.id);
                // Count total NFT in wallet
                let totalNFT = 0;
                for (let j = 0; j < allWallets.length; j++) {
                    const wallet = allWallets[j];
                    totalNFT += wallet.assets.length;
                }
                userCounts.set(user.id, totalNFT);
            }
            // Sort userCounts
            topNFTHolders = new Map([...userCounts.entries()].sort((a, b) => b[1] - a[1]));
            cache.set(dtCacheKeys.TOPNFTHOLDERS, topNFTHolders, 60 * 10);
        }
        return topNFTHolders;
    }
    async getStdTokenByAssetUnitName(
        userWallet: AlgoWallet,
        assetUnitName: string
    ): Promise<number> {
        // Get std asset name by id
        const em = container.resolve(MikroORM).em.fork();
        // get std assetType by assetUnitName
        const stdAssetType = await em
            .getRepository(AlgoStdAsset)
            .getStdAssetByUnitName(assetUnitName);
        const stdToken = await em
            .getRepository(AlgoStdToken)
            .checkIfWalletHasAsset(userWallet, stdAssetType.assetIndex);
        if (stdToken) {
            return stdToken.tokens;
        } else {
            return 0;
        }
    }
}
