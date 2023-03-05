import {
    Collection,
    Entity,
    EntityRepository,
    EntityRepositoryType,
    Loaded,
    MikroORM,
    OneToMany,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';
import { inlineCode } from 'discord.js';
import { container } from 'tsyringe';

import { AlgoStdToken } from './AlgoStdToken.entity.js';
import { AlgoWallet, AllWalletAssetsAdded } from './AlgoWallet.entity.js';
import { CustomBaseEntity } from './BaseEntity.entity.js';
import { NFDomainsManager } from '../model/framework/manager/NFDomains.js';
import logger from '../utils/functions/LoggerFactory.js';
// ===========================================
// ============= Interfaces ==================
// ===========================================
interface WalletOwners {
    isWalletInvalid: boolean;
    walletOwner: Loaded<User, never> | null;
    isWalletOwnedByOtherDiscordID: boolean;
    walletOwnerMsg?: string;
}

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => UserRepository })
export class User extends CustomBaseEntity {
    [EntityRepositoryType]?: UserRepository;

    @PrimaryKey({ autoincrement: false })
    id!: string;

    @Property()
    lastInteract: Date = new Date();

    @OneToMany(() => AlgoWallet, wallet => wallet.owner, { orphanRemoval: true })
    algoWallets = new Collection<AlgoWallet>(this);

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    @Property()
    preToken: number = 0;
    constructor(id: string) {
        super();
        this.id = id;
    }
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class UserRepository extends EntityRepository<User> {
    /**
     * Updates the last interact date of a user
     *
     * @param {string} [userId]
     * @returns {*}  {Promise<void>}
     * @memberof UserRepository
     */
    async updateLastInteract(userId?: string): Promise<void> {
        const user = await this.findOne({ id: userId });

        if (user) {
            user.lastInteract = new Date();
            await this.flush();
        }
    }
    async getAllUsers(): Promise<Array<Loaded<User, never>>> {
        // Return a list of all users in the database
        // Users have an id length of greater than 10
        return await this.find({ id: { $like: '__________%' } });
    }

    async getUserById(discordUser: string): Promise<Loaded<User, never>> {
        return await this.findOneOrFail({ id: discordUser });
    }
    async findByWallet(wallet: string): Promise<Loaded<User, never> | null> {
        return await this.findOne({ algoWallets: { address: wallet } });
    }
    async findByDiscordIDWithWallets(
        discordUser: string
    ): Promise<Loaded<User, 'algoWallets'> | null> {
        return await this.findOne({ id: discordUser }, { populate: ['algoWallets'] });
    }
    async updateUserPreToken(discordUser: string, quantity: number): Promise<string> {
        const user = await this.findOneOrFail({ id: discordUser });
        if (user.preToken + quantity < 0) {
            throw new Error(
                `Not enough artifacts. You have ${user.preToken.toLocaleString()} artifacts.`
            );
        }
        user.preToken += quantity;
        await this.flush();
        return user.preToken.toLocaleString();
    }

    async walletOwnedByAnotherUser(
        discordUser: string,
        wallet: string,
        checkNFD: boolean = true
    ): Promise<WalletOwners> {
        let isWalletInvalid = false;
        let isWalletOwnedByOtherDiscordID = false;

        // Check if wallet is valid on NFDomain
        if (checkNFD) {
            isWalletOwnedByOtherDiscordID = await this.isWalletOwnedByOtherDiscordID(
                discordUser,
                wallet
            );
        }
        if (isWalletOwnedByOtherDiscordID) {
            isWalletInvalid = true;
        }

        // Check if wallet is already owned by another user
        const walletOwner = await this.findByWallet(wallet);
        if (walletOwner && walletOwner.id !== discordUser) {
            isWalletInvalid = true;
        }
        return { isWalletInvalid, walletOwner, isWalletOwnedByOtherDiscordID };
    }
    async isWalletOwnedByOtherDiscordID(discordUser: string, wallet: string): Promise<boolean> {
        const nfDomainsMgr = container.resolve(NFDomainsManager);
        return await nfDomainsMgr.isWalletOwnedByOtherDiscordID(discordUser, wallet);
    }
    /* istanbul ignore next */
    async addAllAssetsToWallet(walletAddress: string): Promise<AllWalletAssetsAdded> {
        const em = container.resolve(MikroORM).em.fork();
        const algoWalletRepo = em.getRepository(AlgoWallet);

        return await algoWalletRepo.addAllAssetsToWallet(walletAddress);
    }
    async addNewWalletToUser(discordUser: string, walletAddress: string): Promise<WalletOwners> {
        const { isWalletInvalid, walletOwner, isWalletOwnedByOtherDiscordID } =
            await this.walletOwnedByAnotherUser(discordUser, walletAddress);
        if (!isWalletInvalid && !walletOwner) {
            const user = await this.findByDiscordIDWithWallets(discordUser);
            if (!user) throw new Error(`User not found.`);
            const newWallet = new AlgoWallet(walletAddress, user);
            user.algoWallets.add(newWallet);
            await this.flush();
        }
        const walletOwnerMsg = this.__processWalletOwnerMsg(walletAddress, {
            isWalletInvalid,
            walletOwner,
            isWalletOwnedByOtherDiscordID,
        });
        return { isWalletInvalid, walletOwner, isWalletOwnedByOtherDiscordID, walletOwnerMsg };
    }
    private __processWalletOwnerMsg(walletAddress: string, walletOwners: WalletOwners): string {
        const codedWallet = inlineCode(walletAddress);
        const { isWalletInvalid, walletOwner, isWalletOwnedByOtherDiscordID } = walletOwners;
        let newMsg = '';
        if (!isWalletInvalid && !walletOwner) {
            newMsg = `${codedWallet} Added.`;
        } else if (isWalletInvalid) {
            newMsg = isWalletOwnedByOtherDiscordID
                ? `${codedWallet} has been registered to a NFT Domain.\n\nTherefore it cannot be added to your account.\n\nWhy? Your Discord ID does not match the verified ID of the NFT Domain.`
                : `${codedWallet} is already owned by another user.`;
        } else if (walletOwner) {
            newMsg = `${codedWallet} has been refreshed.`;
        }
        return newMsg;
    }
    /**
     *removes a wallet from a user
     *
     * @param {string} discordUser
     * @param {string} walletAddress
     * @returns {*}  {Promise<string>}
     * @memberof UserRepository
     */
    async removeWalletFromUser(discordUser: string, walletAddress: string): Promise<string> {
        const { isWalletInvalid } = await this.walletOwnedByAnotherUser(
            discordUser,
            walletAddress,
            false
        );

        const em = container.resolve(MikroORM).em.fork();
        if (isWalletInvalid) {
            return `You do not own the wallet ${walletAddress}`;
        }
        // delete the wallet
        const walletToRemove = await em.getRepository(AlgoWallet).findOneOrFail({
            address: walletAddress,
        });
        // check if the wallet has unclaimed tokens
        const unclaimedTokens = await em
            .getRepository(AlgoStdToken)
            .getAllAssetsByWalletWithUnclaimedTokens(walletToRemove);
        if (unclaimedTokens.length > 0) {
            return `You have unclaimed tokens. Please check your wallet before removing it.`;
        }
        await em.getRepository(AlgoWallet).removeAndFlush(walletToRemove);
        // update the algoWallets collection of the affected user entity
        const user = await this.findOneOrFail({ id: discordUser }, { populate: ['algoWallets'] });
        user.algoWallets.remove(walletToRemove);
        await this.flush();
        return `Wallet ${walletAddress} removed`;
    }

    /**
     * Syncs all wallets owned by the user with the Algorand blockchain
     *
     * @returns {*}  {Promise<string>}
     * @memberof UserRepository
     */
    async userAssetSync(): Promise<string> {
        const users = await this.getAllUsers();
        logger.info(`Syncing ${users.length} Users`);

        for (const user of users) {
            const discordUser = user.id;
            await this.syncUserWallets(discordUser);
        }
        const msg = `User Asset Sync Complete -- ${users.length} users`;
        logger.info(msg);

        return msg;
    }

    /**
     * Syncs all wallets owned by the user with the Algorand blockchain
     *
     * @param {string} discordUser
     * @returns {*}  {Promise<string>}
     * @memberof AssetWallet
     */
    async syncUserWallets(discordUser: string): Promise<string> {
        const walletOwner = await this.findByDiscordIDWithWallets(discordUser);
        if (walletOwner) {
            const wallets = walletOwner.algoWallets.getItems();
            if (wallets.length < 1) {
                return 'No wallets found';
            } else {
                const walletPromises = wallets.map(wallet => {
                    return this.addWalletAndSyncAssets(walletOwner, wallet.address);
                });
                const msgArr = await Promise.all(walletPromises);
                return msgArr.join('\n');
            }
        } else {
            return 'User is not registered.';
        }
    }

    /**
     * Adds a wallet to the user and syncs all assets
     *
     * @param {string} user
     * @param {string} walletAddress
     * @returns {*}  {Promise<string>}
     * @memberof UserRepository
     */
    async addWalletAndSyncAssets<T extends string | User>(
        user: T,
        walletAddress: string
    ): Promise<string> {
        // check instance of user and set discordUser
        const discordUser: string = typeof user === 'string' ? user : user.id;
        const walletOwners = await this.addNewWalletToUser(discordUser, walletAddress);
        if (walletOwners.isWalletInvalid) {
            return walletOwners.walletOwnerMsg as string;
        }
        const { numberOfNFTAssetsAdded, asaAssetsString } = await this.addAllAssetsToWallet(
            walletAddress
        );
        const message = `${walletOwners.walletOwnerMsg}\n__Synced__\n${numberOfNFTAssetsAdded} assets\n${asaAssetsString}`;
        return message;
    }
}
