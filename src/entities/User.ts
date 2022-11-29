import { AlgoWallet } from '@entities'
import {
  Collection,
  Entity,
  EntityRepositoryType,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core'
import { EntityRepository } from '@mikro-orm/sqlite'
import { Algorand, Database, Logger } from '@services'
import {
  ellipseAddress,
  resolveDependencies,
  resolveDependency,
} from '@utils/functions'

import { CustomBaseEntity } from './BaseEntity'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => UserRepository })
export class User extends CustomBaseEntity {
  [EntityRepositoryType]?: UserRepository

  @PrimaryKey({ autoincrement: false })
  id!: string

  @Property()
  lastInteract: Date = new Date()

  @OneToMany(() => AlgoWallet, wallet => wallet.owner, { orphanRemoval: true })
  algoWallets = new Collection<AlgoWallet>(this)

  @Property()
  karma: number = 0
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
    const user = await this.findOne({ id: userId })

    if (user) {
      user.lastInteract = new Date()
      await this.flush()
    }
  }
  async getUserById(discordUser: string) {
    return await this.findOneOrFail({ id: discordUser })
  }
  async findByWallet(wallet: string) {
    return await this.findOne({ algoWallets: { walletAddress: wallet } })
  }
  async getRXWallet(discordUser: string) {
    const user = await this.findOneOrFail(
      { id: discordUser },
      { populate: ['algoWallets'] }
    )
    const wallet = user.algoWallets
      .getItems()
      .find(wallet => wallet.rxWallet === true)
    return wallet
  }
  async setRxWallet(discordUser: string, walletAddress: string) {
    const user = await this.findOneOrFail(
      { id: discordUser },
      { populate: ['algoWallets'] }
    )
    const wallet = user.algoWallets
      .getItems()
      .find(wallet => wallet.walletAddress === walletAddress)
    if (!wallet) {
      return false
    }
    user.algoWallets.getItems().forEach(wallet => {
      wallet.rxWallet = false
    })
    wallet.rxWallet = true
    await this.flush()
    return true
  }

  async addWalletToUser(discordUser: string, walletAddress: string) {
    const user = await this.findOneOrFail(
      { id: discordUser },
      { populate: ['algoWallets'] }
    )
    let msgArr = [`Wallet ${ellipseAddress(walletAddress)}`]
    const totalWallets = user.algoWallets.getItems().length

    const defaultRX = totalWallets < 1 ? true : false

    const { owned, owner } = await this.walletOwnedByAnotherUser(
      discordUser,
      walletAddress
    )
    if (owned) {
      msgArr[0] += ` is already owned by another user.`
      msgArr.push(`If you think this is an error, please contact an admin.`)
      return { msg: msgArr.join('\n'), owned: owned, other_owner: owner }
    }
    if (owner) {
      msgArr[0] += ` has been refreshed.`
      return { msg: msgArr.join('\n'), owned: owned, other_owner: owner }
    }
    const newWallet = new AlgoWallet(walletAddress, user)
    newWallet.rxWallet = defaultRX
    user.algoWallets.add(newWallet)
    await this.flush()
    msgArr[0] += `Added.`
    if (defaultRX) {
      msgArr.push(`And is now the default wallet.`)
    }
    return { msg: msgArr.join('\n'), owned: owned, other_owner: owner }
  }

  async walletOwnedByAnotherUser(
    discordUser: string | undefined,
    wallet: string
  ) {
    const user = await this.findByWallet(wallet)
    let owned = false
    if (user) {
      owned = user.id !== discordUser
    }
    return { owned: owned, owner: user }
  }

  /**
   *removes a wallet from a user
   *
   * @param {string} discordUser
   * @param {string} wallet
   * @returns {*}  {Promise<string>}
   * @memberof UserRepository
   */
  async removeWalletFromUser(
    discordUser: string,
    wallet: string
  ): Promise<string> {
    const db = await resolveDependency(Database)
    const walletOwnedByUser = await this.findByWallet(wallet)
    if (walletOwnedByUser?.id != discordUser) {
      return `You do not own the wallet ${wallet}`
    }
    // delete the wallet
    const walletToRemove = await db.get(AlgoWallet).findOneOrFail({
      walletAddress: wallet,
    })
    if (walletToRemove.rxWallet) {
      return `Wallet ${wallet} is set as your default wallet. Please set another wallet as your default wallet before removing this one.\n`
    }
    await db.get(AlgoWallet).removeAndFlush(walletToRemove)
    await this.syncUserWallets(discordUser)
    return `Wallet ${wallet} removed`
  }

  /**
   * Syncs all wallets owned by the user with the Algorand blockchain
   *
   * @param {string} discordUser
   * @returns {*}  {Promise<string>}
   * @memberof AssetWallet
   */
  async syncUserWallets(discordUser: string): Promise<string> {
    if (discordUser.length < 10) return 'Internal User'

    const walletOwner = await this.findOne(
      { id: discordUser },
      { populate: ['algoWallets'] }
    )
    let msgArr = []
    if (!walletOwner) {
      return 'User is not registered.'
    } else {
      const wallets = walletOwner.algoWallets.getItems()
      if (wallets.length < 1) {
        return 'No wallets found'
      } else {
        for (let i = 0; i < wallets.length; i++) {
          msgArr.push(
            await this.addWalletAndSyncAssets(
              discordUser,
              wallets[i].walletAddress
            )
          )
        }
        return msgArr.join('\n')
      }
    }
  }

  /**
   * Adds a wallet to the user and syncs all assets
   *
   * @param {string} discordUser
   * @param {string} walletAddress
   * @returns {*}  {Promise<string[]>}
   * @memberof UserRepository
   */
  async addWalletAndSyncAssets(
    discordUser: string,
    walletAddress: string
  ): Promise<string> {
    if (discordUser.length < 10) return 'Internal User'

    const [algorand, logger, db] = await resolveDependencies([
      Algorand,
      Logger,
      Database,
    ])
    let msgArr = []
    let { msg, owned, other_owner } = await this.addWalletToUser(
      discordUser,
      walletAddress
    )
    msgArr.push(msg)
    if (!owned) {
      const holderAssets = await algorand.lookupAssetsOwnedByAccount(
        walletAddress
      )
      const assetsAdded = await db
        .get(AlgoWallet)
        .addWalletAssets(walletAddress, holderAssets)
      msgArr.push('__Synced__')
      msgArr.push(`${assetsAdded ?? '0'} assets`)
      msgArr.push(
        await db.get(AlgoWallet).addAllAlgoStdAssetFromDB(walletAddress)
      )
    } else {
      await logger.log(
        `Wallet ${walletAddress} is owned by another user -- ${
          other_owner ?? 'Not sure'
        }`,
        'warn'
      )
    }
    return msgArr.join('\n')
  }
  async addKarma(discordUser: string, karma: number) {
    const logger = await resolveDependency(Logger)
    const user = await this.findOneOrFail({ id: discordUser })
    if (karma > 0) {
      user.karma += karma
      await logger.log(`Added ${karma} KARMA to ${user.id}`, 'warn')
      await this.flush()
    } else {
      await logger.log(`Karma not added to ${user.id}`, 'warn')
    }
  }
}
