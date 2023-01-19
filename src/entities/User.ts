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

import { AlgoStdToken } from './AlgoStdToken.js';
import { AlgoWallet } from './AlgoWallet.js';
import { CustomBaseEntity } from './BaseEntity.js';
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
        return await this.findOne({ algoWallets: { address: wallet } });
    }

    async addWalletToUser(
        discordUser: string,
        walletAddress: string
    ): Promise<{ msg: string; owned: boolean; other_owner: Loaded<User, never> }> {
        const msgArr = [`Wallet ${ObjectUtil.ellipseAddress(walletAddress)}`];

        const { invalidOwner, validOwner, nfDomainWalletCheck } =
            await this.walletOwnedByAnotherUser(discordUser, walletAddress);
        if (invalidOwner) {
            msgArr[0] += nfDomainWalletCheck
                ? ` is already owned by another user.`
                : ` is has been registered to a NFT Domain.\n\nTherefore it cannot be added to your account.\n\nWhy? Your Discord ID does not match the verified ID of the NFT Domain.`;
            msgArr.push(`If you think this is an error, please contact an admin.`);
            logger.error(`Wallet ${walletAddress} is already owned by another user.`);
            return { msg: msgArr.join('\n'), owned: invalidOwner, other_owner: validOwner };
        }
        if (validOwner) {
            msgArr[0] += ` has been refreshed.`;
            return { msg: msgArr.join('\n'), owned: invalidOwner, other_owner: validOwner };
        }

        const user = await this.findOneOrFail({ id: discordUser }, { populate: ['algoWallets'] });

        const newWallet = new AlgoWallet(walletAddress, user);
        user.algoWallets.add(newWallet);
        await this.flush();
        msgArr[0] += `Added.`;
        return { msg: msgArr.join('\n'), owned: invalidOwner, other_owner: validOwner };
    }

    async walletOwnedByAnotherUser(
        discordUser: string | undefined,
        wallet: string
    ): Promise<{
        invalidOwner: boolean;
        validOwner: Loaded<User, never>;
        nfDomainWalletCheck: boolean;
    }> {
        // check nfdomain for wallet
        const nfDomainsMgr = container.resolve(NFDomainsManager);
        const nfDomainWalletCheck = await nfDomainsMgr.validateWalletFromDiscordID(
            discordUser,
            wallet
        );
        const validOwner = await this.findByWallet(wallet);
        const invalidOwner = !nfDomainWalletCheck
            ? true
            : validOwner
            ? validOwner.id !== discordUser
            : false;
        return { invalidOwner, validOwner, nfDomainWalletCheck };
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
        const { invalidOwner } = await this.walletOwnedByAnotherUser(discordUser, walletAddress);

        const em = container.resolve(MikroORM).em.fork();
        if (invalidOwner) {
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
        if (unclaimedKarma.unclaimedTokens > 0) {
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
        await container
            .resolve(MikroORM)
            .em.fork()
            .getRepository(AlgoStdToken)
            .removeNullOwnerTokens();
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
     * @returns {*}  {Promise<string[]>}
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
        const { msg, owned, other_owner } = await this.addWalletToUser(discordUser, walletAddress);
        msgArr.push(msg);
        if (owned) {
            const otherOwnerLink = other_owner ? `<@${other_owner.id}>` : 'Not sure';
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

    async incrementUserArtifacts(discordUser: string): Promise<string> {
        const user = await this.findOneOrFail({ id: discordUser });
        // increment the karmaShop totalArtifacts
        user.preToken += 1;
        await this.flush();
        logger.info(`User ${user.id} has purchased an artifact and now has ${user.preToken}.`);
        return user.preToken.toLocaleString();
    }

    async incrementEnlightenment(discordUser: string): Promise<string> {
        const user = await this.findOneOrFail({ id: discordUser });
        if (user.preToken < 4) {
            return `You need 4 artifacts to achieve enlightenment.`;
        }
        // remove 4 total artifacts
        user.preToken -= 4;
        // add 1 enlightenment
        //!TODO Add the code for enlightenment
        await this.flush();
        return 'You have achieved enlightenment!';
    }
}
