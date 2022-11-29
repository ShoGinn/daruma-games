import { AlgoWallet } from '@entities'
import {
  Entity,
  EntityRepositoryType,
  ManyToOne,
  PrimaryKey,
  Property,
  ref,
  Ref,
} from '@mikro-orm/core'
import { EntityRepository } from '@mikro-orm/sqlite'
import {
  checkImageExists,
  hostedConvertedGifUrl,
  IGameStats,
} from '@utils/functions'

import { CustomBaseEntity } from './BaseEntity'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoNFTAssetRepository })
export class AlgoNFTAsset extends CustomBaseEntity {
  [EntityRepositoryType]?: AlgoNFTAssetRepository

  @PrimaryKey({ autoincrement: false })
  assetIndex!: number

  @ManyToOne(() => AlgoWallet, { ref: true })
  creatorWalletAddress: Ref<AlgoWallet>

  @Property()
  name: string

  @Property()
  unitName: string

  @Property()
  url: string

  @Property()
  altUrl?: boolean = false

  @Property({ nullable: true })
  alias?: string

  @ManyToOne(() => AlgoWallet, { nullable: true, ref: true })
  ownerWallet?: Ref<AlgoWallet>

  @Property({ type: 'json', nullable: true })
  arc69Meta?: AlgorandPlugin.Arc69Payload

  @Property({ type: 'json', nullable: true })
  assetNote?: DarumaTrainingPlugin.assetNote

  constructor(
    assetIndex: number,
    creatorWallet: AlgoWallet,
    name: string,
    unitName: string,
    url: string
  ) {
    super()
    this.assetIndex = assetIndex
    this.name = name
    this.unitName = unitName
    this.url = url
    this.creatorWalletAddress = ref(creatorWallet)
  }
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class AlgoNFTAssetRepository extends EntityRepository<AlgoNFTAsset> {
  /**
   *Find by the asset's id
   *
   * @param {number} id
   * @returns {*}  {(Promise<AlgoAsset | null>)}
   * @memberof AlgoAssetRepository
   */
  async findById(id: number): Promise<AlgoNFTAsset | null> {
    return this.findOne({ assetIndex: id })
  }

  /**
   * Check if the asset is a video and if there is a alternate url
   *
   * @returns {*}  {Promise<void>}
   * @memberof AlgoNFTAssetRepository
   */
  async checkAltImageURL(): Promise<void> {
    const assets = await this.findAll()
    const modifiedAssets: AlgoNFTAsset[] = []
    for (let idx = 0; idx < assets.length; idx++) {
      const asset = assets[idx]
      const arc69 = JSON.stringify(asset.arc69Meta)
      if (
        asset.url?.endsWith('#v') ||
        arc69.match(/video|animated/gi) !== null
      ) {
        const hostedUrl = hostedConvertedGifUrl(asset.url)
        if (await checkImageExists(hostedUrl)) {
          asset.altUrl = true
          modifiedAssets.push(asset)
        } else {
          console.log('Image URL does not exist', hostedUrl)
        }
      }
    }
    await this.persistAndFlush(modifiedAssets)
  }
  /**
   * Add Asset to the database
   *
   * @param {AlgoWallet} creatorWallet
   * @param {AssetResult[]} creatorAssets
   * @returns {*}  {Promise<void>}
   * @memberof AlgoNFTAssetRepository
   */
  async addAssetsLookup(
    creatorWallet: AlgoWallet,
    creatorAssets: AlgorandPlugin.AssetResult[]
  ): Promise<void> {
    let newAssets: AlgoNFTAsset[] = []
    const existingAssets = await this.findAll()
    // Filter out assets that already exist
    const filteredAssets = creatorAssets.filter(
      asset =>
        !existingAssets.find(
          existingAsset => existingAsset.assetIndex === asset.index
        )
    )
    for (let idx = 0; idx < filteredAssets.length; idx++) {
      const nonExistingAsset = filteredAssets[idx]
      const assetId = nonExistingAsset?.index
      const { url, name, 'unit-name': unitName } = nonExistingAsset.params
      const newAsset = new AlgoNFTAsset(
        assetId,
        creatorWallet,
        name ?? ' ',
        unitName ?? ' ',
        url ?? ' '
      )
      newAssets.push(newAsset)
    }
    await this.persistAndFlush(newAssets)
  }
  async createNPCAsset(
    fakeCreator: AlgoWallet,
    fakeAsset: DarumaTrainingPlugin.FakeAsset
  ) {
    // Check if the asset already exists and update it if it does
    const existingAsset = await this.findOne({
      assetIndex: fakeAsset.assetIndex,
    })
    if (existingAsset) {
      existingAsset.name = fakeAsset.name
      existingAsset.unitName = fakeAsset.unitName
      existingAsset.url = fakeAsset.url
      existingAsset.creatorWalletAddress = ref(fakeCreator)
      await this.persistAndFlush(existingAsset)
    } else {
      const newAsset = new AlgoNFTAsset(
        fakeAsset.assetIndex,
        fakeCreator,
        fakeAsset.name,
        fakeAsset.unitName,
        fakeAsset.url
      )
      await this.persistAndFlush(newAsset)
    }
  }
  async postGameSync(
    asset: AlgoNFTAsset,
    cooldown: number,
    dojoTraining: IGameStats
  ) {
    // increment the dojo training numbers
    let wins = asset.assetNote?.dojoTraining?.wins ?? 0
    let losses = asset.assetNote?.dojoTraining?.losses ?? 0
    let zen = asset.assetNote?.dojoTraining?.zen ?? 0
    // increment the wins and losses
    if (dojoTraining.wins) wins += dojoTraining.wins
    if (dojoTraining.losses) losses += dojoTraining.losses
    if (dojoTraining.zen) zen += dojoTraining.zen
    asset.assetNote = {
      coolDown: cooldown + Date.now(),
      dojoTraining: {
        wins,
        losses,
        zen,
      },
    }
    await this.persistAndFlush(asset)
  }
  async assetRankingsByWins() {
    const assets = await this.findAll()
    const rankedAssets = assets.filter(
      asset => asset.assetNote?.dojoTraining?.wins ?? -1 >= 0
    )
    const sortedAssets = rankedAssets.sort((a, b) => {
      const aWins = a.assetNote?.dojoTraining?.wins ?? 0
      const bWins = b.assetNote?.dojoTraining?.wins ?? 0
      return bWins - aWins
    })
    return sortedAssets
  }
  async assetRankingsByWinLossRatio() {
    const assets = await this.findAll()
    // Sort all assets in order by their win/loss ratio
    const rankedAssets = assets.filter(
      asset =>
        (asset.assetNote?.dojoTraining?.wins ?? -1 >= 0) &&
        (asset.assetNote?.dojoTraining?.losses ?? -1 >= 0)
    )
    const sortedAssets = rankedAssets.sort((a, b) => {
      const aWins = a.assetNote?.dojoTraining?.wins ?? 0
      const bWins = b.assetNote?.dojoTraining?.wins ?? 0
      const aLosses = a.assetNote?.dojoTraining?.losses ?? 0
      const bLosses = b.assetNote?.dojoTraining?.losses ?? 0
      const aRatio = aWins / aLosses
      const bRatio = bWins / bLosses
      return bRatio - aRatio
    })
    return sortedAssets
  }
}
