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

import { Algorand } from '../services/Algorand.js';
import { karmaShopDefaults } from '../utils/functions/dtUtils.js';
import logger from '../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../utils/Utils.js';
import { AlgoStdToken } from './AlgoStdToken.js';
import { AlgoWallet } from './AlgoWallet.js';
import { CustomBaseEntity } from './BaseEntity.js';
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

    @Property({ type: 'json', nullable: true })
    karmaShop?: DarumaTrainingPlugin.karmaShop = karmaShopDefaults();
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
    async getAllUsers(): Promise<Loaded<User, never>[]> {
        // Return a list of all users in the database
        // Users have an id length of greater than 10
        return await this.find({ id: { $like: '__________%' } });
    }

    async getUserById(discordUser: string): Promise<Loaded<User, never>> {
        return await this.findOneOrFail({ id: discordUser });
    }
    async findByWallet(wallet: string): Promise<Loaded<User, never>> {
        return await this.findOne({ algoWallets: { walletAddress: wallet } });
    }

    async addWalletToUser(
        discordUser: string,
        walletAddress: string
    ): Promise<{ msg: string; owned: boolean; other_owner: Loaded<User, never> }> {
        let msgArr = [`Wallet ${ObjectUtil.ellipseAddress(walletAddress)}`];

        const { owned, owner } = await this.walletOwnedByAnotherUser(discordUser, walletAddress);
        if (owned) {
            msgArr[0] += ` is already owned by another user.`;
            msgArr.push(`If you think this is an error, please contact an admin.`);
            return { msg: msgArr.join('\n'), owned: owned, other_owner: owner };
        }
        if (owner) {
            msgArr[0] += ` has been refreshed.`;
            return { msg: msgArr.join('\n'), owned: owned, other_owner: owner };
        }
        const user = await this.findOneOrFail({ id: discordUser }, { populate: ['algoWallets'] });

        const newWallet = new AlgoWallet(walletAddress, user);
        user.algoWallets.add(newWallet);
        await this.flush();
        msgArr[0] += `Added.`;
        return { msg: msgArr.join('\n'), owned: owned, other_owner: owner };
    }

    async walletOwnedByAnotherUser(
        discordUser: string | undefined,
        wallet: string
    ): Promise<{ owned: boolean; owner: Loaded<User, never> }> {
        const user = await this.findByWallet(wallet);
        let owned = false;
        if (user) {
            owned = user.id !== discordUser;
        }
        return { owned: owned, owner: user };
    }

    /**
     *removes a wallet from a user
     *
     * @param {string} discordUser
     * @param {string} wallet
     * @returns {*}  {Promise<string>}
     * @memberof UserRepository
     */
    async removeWalletFromUser(discordUser: string, wallet: string): Promise<string> {
        const em = container.resolve(MikroORM).em.fork();
        const walletOwnedByUser = await this.findByWallet(wallet);
        if (walletOwnedByUser?.id != discordUser) {
            return `You do not own the wallet ${wallet}`;
        }
        // delete the wallet
        const walletToRemove = await em.getRepository(AlgoWallet).findOneOrFail({
            walletAddress: wallet,
        });
        // check if the wallet has unclaimed KARMA tokens
        const unclaimedKarma = await em.getRepository(AlgoStdToken).findOne({
            ownerWallet: walletToRemove,
        });
        if (unclaimedKarma.unclaimedTokens > 0) {
            return `You have unclaimed KARMA tokens. Please claim them before removing your wallet.`;
        }
        await em.getRepository(AlgoWallet).removeAndFlush(walletToRemove);
        await this.syncUserWallets(discordUser);
        return `Wallet ${wallet} removed`;
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
        // Check to make sure karmaShop is not null
        if (!walletOwner.karmaShop) {
            walletOwner.karmaShop = karmaShopDefaults();
        }
        // Cleanup the rare possibility of a standard asset having a null owner
        await container
            .resolve(MikroORM)
            .em.fork()
            .getRepository(AlgoStdToken)
            .removeNullOwnerTokens();
        let msgArr = [];
        if (!walletOwner) {
            return 'User is not registered.';
        } else {
            const wallets = walletOwner.algoWallets.getItems();
            if (wallets.length < 1) {
                return 'No wallets found';
            } else {
                for (let i = 0; i < wallets.length; i++) {
                    msgArr.push(
                        await this.addWalletAndSyncAssets(walletOwner, wallets[i].walletAddress)
                    );
                }
                return msgArr.join('\n');
            }
        }
    }

    /**
     * Adds a wallet to the user and syncs all assets
     *
     * @param {string} user
     * @param {string} walletAddress
     * @returns {*}  {Promise<string[]>}
     * @memberof UserRepository
     */
    async addWalletAndSyncAssets<T extends string | User>(
        user: T,
        walletAddress: string
    ): Promise<string> {
        // check instance of user and set discordUser
        let discordUser: string;
        if (typeof user === 'string') {
            discordUser = user;
        } else {
            discordUser = user.id;
        }
        if (discordUser.length < 10) return 'Internal User';

        const algorand = container.resolve(Algorand);
        const em = container.resolve(MikroORM).em.fork();
        let msgArr = [];
        let { msg, owned, other_owner } = await this.addWalletToUser(discordUser, walletAddress);
        msgArr.push(msg);
        if (!owned) {
            const holderAssets = await algorand.lookupAssetsOwnedByAccount(walletAddress);
            const assetsAdded = await em
                .getRepository(AlgoWallet)
                .addWalletAssets(walletAddress, holderAssets);
            msgArr.push('__Synced__');
            msgArr.push(`${assetsAdded ?? '0'} assets`);
            msgArr.push(await em.getRepository(AlgoWallet).addAllAlgoStdAssetFromDB(walletAddress));
            //await migrateUserKarmaToStdTokenKarma(discordUser);
        } else {
            logger.warn(
                `Wallet ${walletAddress} is owned by another user -- ${other_owner ?? 'Not sure'}`
            );
        }
        return msgArr.join('\n');
    }

    async incrementUserArtifacts(discordUser: string): Promise<string> {
        const user = await this.findOneOrFail({ id: discordUser });
        // increment the karmaShop totalArtifacts
        user.karmaShop.totalPieces += 1;
        await this.flush();
        logger.info(
            `User ${user.id} has purchased an artifact and now has ${user.karmaShop.totalPieces}.`
        );
        return user.karmaShop.totalPieces.toLocaleString();
    }

    async incrementEnlightenment(discordUser: string): Promise<string> {
        const user = await this.findOneOrFail({ id: discordUser });
        if (user.karmaShop.totalPieces < 4) {
            return `You need 4 artifacts to achieve enlightenment.`;
        }
        // remove 4 total artifacts
        user.karmaShop.totalPieces -= 4;
        // add 1 enlightenment
        user.karmaShop.totalEnlightened += 1;
        logger.info(
            `User ${user.id} has achieved enlightenment. This is their ${user.karmaShop.totalEnlightened} enlightenment.`
        );
        await this.flush();
        return user.karmaShop.totalEnlightened.toLocaleString();
    }
}
