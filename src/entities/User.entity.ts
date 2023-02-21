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
import { container } from 'tsyringe';

import { AlgoStdToken } from './AlgoStdToken.entity.js';
import { AlgoWallet } from './AlgoWallet.entity.js';
import { CustomBaseEntity } from './BaseEntity.entity.js';
import { NFDomainsManager } from '../model/framework/manager/NFDomains.js';
import { Algorand } from '../services/Algorand.js';
import logger from '../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../utils/Utils.js';
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

    async addWalletToUser(
        discordUser: string,
        walletAddress: string
    ): Promise<{ msg: string; isWalletInvalid: boolean; walletOwner: Loaded<User, never> | null }> {
        const msgArr = [`Wallet ${ObjectUtil.ellipseAddress(walletAddress)}`];

        const { isWalletInvalid, walletOwner, walletOwnedByDiscordUser } =
            await this.walletOwnedByAnotherUser(discordUser, walletAddress);
        if (isWalletInvalid) {
            msgArr[0] += walletOwnedByDiscordUser
                ? ` is already owned by another user.`
                : ` has been registered to a NFT Domain.\n\nTherefore it cannot be added to your account.\n\nWhy? Your Discord ID does not match the verified ID of the NFT Domain.`;
            msgArr.push(`If you think this is an error, please contact an admin.`);
            logger.error(`Wallet ${walletAddress} is already owned by another user.`);
            return { msg: msgArr.join('\n'), isWalletInvalid, walletOwner };
        }
        if (walletOwner) {
            msgArr[0] += ` has been refreshed.`;
            return { msg: msgArr.join('\n'), isWalletInvalid, walletOwner };
        }

        const user = await this.findOneOrFail({ id: discordUser }, { populate: ['algoWallets'] });

        const newWallet = new AlgoWallet(walletAddress, user);
        user.algoWallets.add(newWallet);
        await this.flush();
        msgArr[0] += ` Added.`;
        return { msg: msgArr.join('\n'), isWalletInvalid, walletOwner };
    }

    async walletOwnedByAnotherUser(
        discordUser: string,
        wallet: string,
        noNFD: boolean = false
    ): Promise<{
        isWalletInvalid: boolean;
        walletOwner: Loaded<User, never> | null;
        walletOwnedByDiscordUser: boolean;
    }> {
        let isWalletInvalid = false;

        // Check if wallet is valid on NFDomain
        let walletOwnedByDiscordUser = true;
        if (!noNFD) {
            walletOwnedByDiscordUser = await this.checkNFDomainOwnership(discordUser, wallet);
            if (!walletOwnedByDiscordUser) {
                isWalletInvalid = true;
            }
        }
        // Check if wallet is already owned by another user
        const walletOwner = await this.findByWallet(wallet);
        if (walletOwner && walletOwner.id !== discordUser) {
            isWalletInvalid = true;
        }
        return { isWalletInvalid, walletOwner, walletOwnedByDiscordUser };
    }

    /**
     * Checks if a wallet is owned by a discord user
     *
     * @param {string} discordUser
     * @param {string} wallet
     * @returns {*}  {Promise<boolean>} true if wallet is owned by discord user or is not owned by anyone else false if wallet is owned by another discord user
     * @memberof UserRepository
     */
    async checkNFDomainOwnership(discordUser: string, wallet: string): Promise<boolean> {
        const nfDomainsMgr = container.resolve(NFDomainsManager);
        return await nfDomainsMgr.checkWalletOwnershipFromDiscordID(discordUser, wallet);
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
            true
        );

        const em = container.resolve(MikroORM).em.fork();
        if (isWalletInvalid) {
            return `You do not own the wallet ${walletAddress}`;
        }
        // delete the wallet
        const walletToRemove = await em.getRepository(AlgoWallet).findOneOrFail({
            address: walletAddress,
        });
        // check if the wallet has unclaimed KARMA tokens
        const unclaimedKarma = await em.getRepository(AlgoStdToken).findOne({
            wallet: walletToRemove,
        });
        const unclaimedTokens = unclaimedKarma?.unclaimedTokens ?? 0;
        if (unclaimedTokens > 0) {
            return `You have unclaimed KARMA tokens. Please claim them before removing your wallet.`;
        }
        await em.getRepository(AlgoWallet).removeAndFlush(walletToRemove);
        await this.syncUserWallets(discordUser);
        return `Wallet ${walletAddress} removed`;
    }

    /**
     * Syncs all wallets owned by the user with the Algorand blockchain
     *
     * @param {string} discordUser
     * @returns {*}  {Promise<string>}
     * @memberof AssetWallet
     */
    async syncUserWallets(discordUser: string): Promise<string> {
        if (discordUser.length < 10) return 'Internal User';

        const walletOwner = await this.findOne({ id: discordUser }, { populate: ['algoWallets'] });
        // Cleanup the rare possibility of a standard asset having a null owner
        const msgArr = [];
        if (walletOwner) {
            const wallets = walletOwner.algoWallets.getItems();
            if (wallets.length < 1) {
                return 'No wallets found';
            } else {
                for (const wallet of wallets) {
                    msgArr.push(await this.addWalletAndSyncAssets(walletOwner, wallet.address));
                }
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
        if (discordUser.length < 10) return 'Internal User';

        const algorand = container.resolve(Algorand);
        const em = container.resolve(MikroORM).em.fork();
        const msgArr = [];
        const { msg, isWalletInvalid, walletOwner } = await this.addWalletToUser(
            discordUser,
            walletAddress
        );
        msgArr.push(msg);
        if (isWalletInvalid) {
            const otherOwnerLink = walletOwner ? `<@${walletOwner.id}>` : 'Not sure';
            logger.warn(`Wallet ${walletAddress} is owned by another user -- ${otherOwnerLink}`);
        } else {
            const holderAssets = await algorand.lookupAssetsOwnedByAccount(walletAddress);
            const assetsAdded = await em
                .getRepository(AlgoWallet)
                .addWalletAssets(walletAddress, holderAssets);
            msgArr.push('__Synced__');
            msgArr.push(`${assetsAdded ?? '0'} assets`);
            msgArr.push(await em.getRepository(AlgoWallet).addAllAlgoStdAssetFromDB(walletAddress));
            //await migrateUserKarmaToStdTokenKarma(discordUser);
        }
        return msgArr.join('\n');
    }

    async incrementUserArtifacts(discordUser: string, quantity: number = 1): Promise<string> {
        const user = await this.findOneOrFail({ id: discordUser });
        // increment the karmaShop totalArtifacts
        user.preToken += quantity;
        await this.flush();
        logger.info(
            `User ${user.id} has purchased ${quantity} artifact and now has ${user.preToken}.`
        );
        return user.preToken.toLocaleString();
    }

    async incrementEnlightenment(discordUser: string): Promise<string> {
        const user = await this.findOneOrFail({ id: discordUser });
        if (user.preToken < 4) {
            return `You need 4 artifacts to achieve enlightenment.`;
        }
        // remove 4 total artifacts
        user.preToken -= 4;
        await this.flush();
        return 'You have achieved enlightenment!';
    }
}
