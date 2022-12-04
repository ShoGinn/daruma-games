import { Data, User } from '@entities'
import {
  Cascade,
  Collection,
  Entity,
  EntityRepositoryType,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  ref,
  Ref,
} from '@mikro-orm/core'
import { EntityRepository } from '@mikro-orm/sqlite'
import { Algorand, Database, Logger } from '@services'
import {
  BotNames,
  enumKeys,
  gameStatusHostedUrl,
  getAssetUrl,
  InternalUserIDs,
  resolveDependencies,
  resolveDependency,
} from '@utils/functions'

import { AlgoNFTAsset, AlgoStdAsset, AlgoStdToken } from '.'
import { CustomBaseEntity } from './BaseEntity'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoWalletRepository })
export class AlgoWallet extends CustomBaseEntity {
  [EntityRepositoryType]?: AlgoWalletRepository

  @PrimaryKey({ autoincrement: false })
  walletAddress: string

  @Property()
  rxWallet: boolean = false

  @ManyToOne(() => User, { ref: true })
  owner: Ref<User>

  @OneToMany(() => AlgoNFTAsset, asset => asset.ownerWallet, {
    cascade: [Cascade.PERSIST],
    nullable: true,
  })
  assets = new Collection<AlgoNFTAsset>(this)

  @ManyToMany(() => AlgoStdAsset, asa => asa.ownerWallet, {
    cascade: [Cascade.REMOVE],
  })
  algoStdAsset = new Collection<AlgoStdAsset>(this)

  @OneToMany(() => AlgoStdToken, token => token.ownerWallet, {
    orphanRemoval: true,
  })
  algoStdTokens = new Collection<AlgoStdToken>(this)

  constructor(walletAddress: string, owner: User) {
    super()
    this.walletAddress = walletAddress
    this.owner = ref(owner)
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
    const [db] = await resolveDependencies([Database])
    const user = await db.get(User).findOneOrFail({ id: discordId })
    const wallets = await this.find({ owner: user })
    return wallets
  }
  async getAllWalletsAndAssetsByDiscordId(
    discordId: string
  ): Promise<AlgoWallet[]> {
    const [db] = await resolveDependencies([Database])
    const user = await db.get(User).findOneOrFail({ id: discordId })
    const wallets = await this.find({ owner: user }, { populate: ['assets'] })
    return wallets
  }
  async clearAllDiscordUserAssetCoolDowns(discordId: string) {
    let wallets = await this.getAllWalletsAndAssetsByDiscordId(discordId)
    for (let index = 0; index < wallets.length; index++) {
      const wallet = wallets[index]
      for (let i = 0; i < wallet.assets.length; i++) {
        const asset = wallet.assets[i]
        if (asset.assetNote) {
          asset.assetNote.coolDown = 0
        }
      }
    }
    await this.persistAndFlush(wallets)
  }

  /**
   * Get all the creator wallets
   *
   * @returns {*}  {Promise<AlgoWallet[]>}
   * @memberof AlgoWalletRepository
   */
  async getCreatorWallets(): Promise<AlgoWallet[]> {
    let creatorID = InternalUserIDs.creator.toString()
    return await this.find({ owner: { id: creatorID } })
  }

  /**
   * Add a wallet with creator as owner
   *
   * @param {string} walletAddress
   * @returns {*}  {(Promise<AlgoWallet | null>)}
   * @memberof AlgoWalletRepository
   */
  async addCreatorWallet(walletAddress: string): Promise<AlgoWallet | null> {
    const [db, algorand] = await resolveDependencies([Database, Algorand])
    let creatorID = InternalUserIDs.creator.toString()

    let user = await db.get(User).findOne({ id: creatorID })
    if (!user) {
      const newUser = new User()
      newUser.id = creatorID
      await db.get(User).persistAndFlush(newUser)
      user = newUser
    }
    if (!(await this.findOne({ walletAddress: walletAddress }))) {
      const wallet = new AlgoWallet(walletAddress, user)
      await this.persistAndFlush(wallet)
      await algorand.creatorAssetSync()
      return wallet
    }
    return null
  }
  async removeCreatorWallet(walletAddress: string) {
    // Remove Assets that are owned by the wallet and delete the wallet
    const [db] = await resolveDependencies([Database])
    const wallet = await this.findOneOrFail({ walletAddress: walletAddress })
    const assets = await db.get(AlgoNFTAsset).find({
      creatorWalletAddress: wallet,
    })
    for (const asset of assets) {
      await db.get(AlgoNFTAsset).removeAndFlush(asset)
    }
    await this.removeAndFlush(wallet)
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
    )
    return walletEntity.assets.count()
  }
  async getTotalAssetsByDiscordUser(discordId: string): Promise<number> {
    const [db] = await resolveDependencies([Database])
    const user = await db.get(User).findOneOrFail({ id: discordId })
    const wallets = await this.find({ owner: user })
    let totalAssets = 0
    for (const wallet of wallets) {
      const walletEntity = await this.findOneOrFail(
        { walletAddress: wallet.walletAddress },
        { populate: ['assets'] }
      )
      totalAssets += walletEntity.assets.count()
    }
    return totalAssets
  }
  async lastUpdatedDate(discordId: string) {
    const [db] = await resolveDependencies([Database])
    const user = await db.get(User).findOneOrFail({ id: discordId })
    const wallets = await this.find({ owner: user })
    // Get the last updated date of the wallet
    let lastUpdatedDate: Date = new Date(0)
    for (const wallet of wallets) {
      if (wallet.updatedAt > lastUpdatedDate) {
        lastUpdatedDate = wallet.updatedAt
      }
    }
    return lastUpdatedDate
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
    )
    const assets = walletEntity.assets.getItems()
    const randomAsset = assets[Math.floor(Math.random() * assets.length)]
    return getAssetUrl(randomAsset)
  }

  /**
   * Add the enabled standard assets to the wallet
   *
   * @param {string} walletAddress
   * @returns {*}  {Promise<string[]>}
   * @memberof AlgoWalletRepository
   */
  async addAllAlgoStdAssetFromDB(walletAddress: string): Promise<string> {
    const [db, algorand] = await resolveDependencies([Database, Algorand])
    // Get all the ASA's registered to the bot
    const algoStdAssets = await db.get(AlgoStdAsset).getAllStdAssets()
    const wallet = await this.findOneOrFail(
      { walletAddress: walletAddress },
      { populate: ['algoStdAsset'] }
    )
    let assetsAdded: string[] = []
    await Promise.all(
      algoStdAssets.map(async asset => {
        // Check if the Wallet is opted into the ASA
        const tokens = await algorand.getTokenOptInStatus(
          walletAddress,
          asset.assetIndex
        )
        if (tokens) {
          // Add the asset to the wallet
          wallet.algoStdAsset.add(asset)
          await db.get(AlgoStdToken).addAlgoStdToken(wallet, asset, tokens)
          assetsAdded.push(asset.name)
        } else {
          assetsAdded.push(`Not opted into ${asset.name}`)
          // TODO: change rx wallet to be per ASA
          wallet.rxWallet = false
        }
      })
    )
    await this.persistAndFlush(wallet)
    return assetsAdded.join('\n')
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
    const [db, logger] = await resolveDependencies([Database, Logger])
    const creatorAssets = await db.get(AlgoNFTAsset).getAllPlayerAssets()

    try {
      const wallet = await this.findOneOrFail(
        { walletAddress: walletAddress },
        { populate: ['assets'] }
      )
      wallet.assets.removeAll()
      let assetCount = 0
      for (let i = 0; i < holderAssets.length; i++) {
        for (let j = 0; j < creatorAssets.length; j++) {
          if (
            holderAssets[i]['asset-id'] == creatorAssets[j].assetIndex &&
            holderAssets[i].amount > 0
          ) {
            assetCount++
            wallet.assets.add(creatorAssets[j])
          }
        }
      }
      wallet.updatedAt = new Date()
      return assetCount
    } catch (e) {
      await logger.logError(e, 'Exception')
      return -1
    } finally {
      await this.flush()
    }
  }

  async getWalletTokens(walletAddress: string): Promise<AlgoStdToken[]> {
    const wallet = await this.findOneOrFail(
      { walletAddress: walletAddress },
      { populate: ['algoStdTokens'] }
    )
    const wallets = wallet.algoStdTokens.getItems()
    return wallets
  }

  async createBotNPCs() {
    const [db] = await resolveDependencies([Database])
    const dataRepository = db.get(Data)
    const botNPCsCreated = await dataRepository.get('botNPCsCreated')
    if (!botNPCsCreated) {
      console.log('Creating Bot NPCs')
      // Use the bot creator wallet (Id 2) to create the bot NPCs
      const botCreatorWallet = await this.createFakeWallet(
        InternalUserIDs.botCreator.toString()
      )
      // The bot ID's are necessary for adding to the game and finding their asset
      let botWallets = [InternalUserIDs.OneVsNpc, InternalUserIDs.FourVsNpc]
      let botNames = [BotNames.OneVsNpc, BotNames.FourVsNpc]
      // The Game types is for the game image assets
      let gameTypes = enumKeys(BotNames)

      for (let i = 0; i < botWallets.length; i++) {
        let walletID = botWallets[i]
        let currentBotName = botNames[i]
        // The fake wallets are real generated Algorand wallets
        const botWallet = await this.createFakeWallet(walletID.toString())
        const newAsset: DarumaTrainingPlugin.FakeAsset = {
          assetIndex: walletID,
          name: currentBotName,
          unitName: currentBotName,
          url: gameStatusHostedUrl(gameTypes[i], 'npc'),
        }
        await db.get(AlgoNFTAsset).createNPCAsset(botCreatorWallet, newAsset)
        let pulledAsset = await db
          .get(AlgoNFTAsset)
          .findOneOrFail({ assetIndex: walletID })
        botWallet.assets.add(pulledAsset)
        await this.persistAndFlush(botWallet)
      }
      await dataRepository.set('botNPCsCreated', true)
      console.log('Bot NPCs Created')
    }
  }

  private async createFakeWallet(fakeID: string) {
    const [db, algorand] = await resolveDependencies([Database, Algorand])
    // Check if the fake user exists
    let newFakeUser = await db.get(User).findOne({ id: fakeID })
    if (!newFakeUser) {
      newFakeUser = new User()
      newFakeUser.id = fakeID
      await db.get(User).persistAndFlush(newFakeUser)
    } else {
      // Delete all the wallets associated with the fake user
      const walletOwner = await db
        .get(User)
        .findOneOrFail({ id: fakeID }, { populate: ['algoWallets'] })
      for (let i = 0; i < walletOwner.algoWallets.length; i++) {
        await db.get(AlgoWallet).removeAndFlush(walletOwner.algoWallets[i])
      }
    }
    let fakeWallet = algorand.createFakeWallet()
    const newFakeWallet = new AlgoWallet(fakeWallet, newFakeUser)
    await this.persistAndFlush(newFakeWallet)
    return newFakeWallet
  }
  async getPlayableAssets(discordId: string): Promise<AlgoNFTAsset[]> {
    const wallets = await this.getAllWalletsAndAssetsByDiscordId(discordId)
    let playableAssets: AlgoNFTAsset[] = []
    for (let index = 0; index < wallets.length; index++) {
      const wallet = wallets[index]
      for (let i = 0; i < wallet.assets.length; i++) {
        const asset = wallet.assets[i]
        playableAssets.push(asset)
      }
    }
    return playableAssets
  }
  async getTopPlayers(): Promise<Map<string, number>> {
    const db = await resolveDependency(Database)
    const allUsers = await db.get(User).findAll()
    // create a user collection
    let userCounts = new Map<string, number>()
    for (let i = 0; i < allUsers.length; i++) {
      // skip the bot users
      if (Number(allUsers[i].id) < 1000) continue
      const user = allUsers[i]
      const allWallets = await this.getAllWalletsAndAssetsByDiscordId(user.id)
      // Count total NFT in wallet
      let totalNFT = 0
      for (let j = 0; j < allWallets.length; j++) {
        const wallet = allWallets[j]
        totalNFT += wallet.assets.length
      }
      userCounts.set(user.id, totalNFT)
    }
    // Sort userCounts
    const sortedUserCounts = new Map(
      [...userCounts.entries()].sort((a, b) => b[1] - a[1])
    )
    return sortedUserCounts
  }
}
