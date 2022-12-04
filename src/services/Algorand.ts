import { algorandConfig } from '@config'
import { Schedule } from '@decorators'
import { AlgoNFTAsset, AlgoWallet, User } from '@entities'
import { EntityRepository } from '@mikro-orm/core'
import { Database, Logger } from '@services'
import {
  chunkArray,
  getAccountFromMnemonic,
  getAlgoClient,
  getIndexerClient,
  updateCreatorAssetSync,
  updateUserAssetSync,
  waitForConfirmation,
} from '@utils/functions'
import algosdk, { TransactionType } from 'algosdk'
import SearchForTransactions from 'algosdk/dist/types/src/client/v2/indexer/searchForTransactions'
import { RateLimiter } from 'limiter'
import { injectable, singleton } from 'tsyringe'
import { Retryable } from 'typescript-retry-decorator'

@singleton()
@injectable()
export class Algorand {
  private algoNFTAssetRepo: EntityRepository<AlgoNFTAsset>
  private userRepo: EntityRepository<User>

  constructor(private db: Database, private logger: Logger) {
    this.algoNFTAssetRepo = this.db.get(AlgoNFTAsset)
    this.userRepo = this.db.get(User)
  }

  private algoIndexer = getIndexerClient()
  private algodClient = getAlgoClient()

  //? rate limiter to prevent hitting the rate limit of the api
  private limiter = new RateLimiter({
    tokensPerInterval: 9,
    interval: 'second',
  })

  /**
   * Syncs the assets created by the creators in the .env file
   * On a schedule every night at midnight
   */
  @Schedule('0 0 * * *')
  async creatorAssetSync() {
    let msg = ''
    const creatorAddressArr = await this.db.get(AlgoWallet).getCreatorWallets()
    if (creatorAddressArr.length === 0) {
      msg = 'No Creators to Sync'
      return msg
    }
    let creatorAssets: AlgorandPlugin.AssetResult[] = []
    await this.logger.log(`Syncing ${creatorAddressArr.length} Creators`)
    for (let i = 0; i < creatorAddressArr.length; i++) {
      creatorAssets = await this.getCreatedAssets(
        creatorAddressArr[i].walletAddress
      )
      await this.db
        .get(AlgoNFTAsset)
        .addAssetsLookup(creatorAddressArr[i], creatorAssets)
    }
    msg = `Creator Asset Sync Complete -- ${creatorAssets.length} assets`
    await this.updateAssetMetadata()
    await this.db.get(AlgoNFTAsset).checkAltImageURLAndAssetNotes()
    await updateCreatorAssetSync()
    return msg
  }

  /**
   ** Syncs EVERY user assets on a daily basis
   *
   * @memberof Algorand
   */
  @Schedule('30 0 * * *')
  async userAssetSync() {
    const users = await this.db.get(User).getAllUsers()
    let msg = ''
    if (users.length === 0) {
      msg = 'No Users to Sync'
      return msg
    }
    await this.logger.log(`Syncing ${users.length} Users`)
    for (let i = 0; i < users.length; i++) {
      const discordUser = users[i].id
      if (discordUser.length > 10) {
        msg += await this.db.get(User).syncUserWallets(discordUser)
      }
    }
    await updateUserAssetSync()
    msg += `User Asset Sync Complete -- ${users.length} users`
    this.logger.console(msg)

    return msg
  }

  noteToArc69Payload = (note: string | undefined) => {
    if (!note) {
      return undefined
    }
    const noteUnencoded = Buffer.from(note, 'base64')
    const json = new TextDecoder().decode(noteUnencoded)
    if (json.match(/^\{/) && json.includes('arc69')) {
      return JSON.parse(json) as AlgorandPlugin.Arc69Payload
    }
    return undefined
  }

  /**
   *Validates wallet address
   *
   * @param {string} walletAddress
   * @returns {*} boolean
   * @memberof Algorand
   */
  validateWalletAddress(walletAddress: string): boolean {
    return algosdk.isValidAddress(walletAddress)
  }

  async claimToken(
    amount: number,
    receiverAddress: string,
    optInAssetId: number,
    tokenMnemonic?: string
  ): Promise<AlgorandPlugin.ClaimTokenResponse | undefined> {
    try {
      if (!this.validateWalletAddress(receiverAddress))
        return { error: 'Invalid Address' }
      if (!tokenMnemonic) {
        await this.logger.log(
          'ALGO_TOKEN_MNEMONIC not set but still faking the transaction for testing'
        )
        // Provide a response for testing
        let thisMockTxn = mockTxn
        thisMockTxn.status.txn.txn.aamt = amount
        return mockTxn as AlgorandPlugin.ClaimTokenResponse
      }
      const suggestedParams = await this.algodClient.getTransactionParams().do()

      const account = getAccountFromMnemonic(tokenMnemonic)
      const revocationTarget = undefined
      const closeRemainderTo = undefined
      const note = undefined

      const xtxn = algosdk.makeAssetTransferTxnWithSuggestedParams(
        account.addr,
        receiverAddress,
        closeRemainderTo,
        revocationTarget,
        amount,
        note,
        optInAssetId,
        suggestedParams
      )
      const rawSignedTxn = xtxn.signTxn(account.sk)
      const { txId } = (await this.algodClient
        .sendRawTransaction(rawSignedTxn)
        .do()) as { txId: string }
      let confirmationStatus:
        | AlgorandPlugin.PendingTransactionResponse
        | undefined = undefined
      confirmationStatus = await waitForConfirmation(this.algodClient, txId, 5)
      await this.logger.log(JSON.stringify(confirmationStatus), 'info')
      await this.logger.log(txId)

      return {
        status: confirmationStatus,
        txId,
      }
    } catch (error) {
      await this.logger.log('Failed to Claim Tokens', 'error')
      await this.logger.logError(error, 'Exception')
      return { error: 'error notify admins' }
    }
  }

  /**
   * Gets all assets owned by a wallet address
   *
   * @param {string} address
   * @param {(boolean | undefined)} [includeAll=undefined]
   * @returns {*}  {Promise<AssetHolding[]>}
   * @memberof Algorand
   */
  async lookupAssetsOwnedByAccount(
    address: string,
    includeAll: boolean | undefined = undefined
  ): Promise<AlgorandPlugin.AssetHolding[]> {
    return await this.executePaginatedRequest(
      (response: AlgorandPlugin.AssetsLookupResult) => response.assets,
      nextToken => {
        let s = this.algoIndexer
          .lookupAccountAssets(address)
          .includeAll(includeAll)
          .limit(algorandConfig.defaultAlgoApi.max_api_resources)
        if (nextToken) {
          s = s.nextToken(nextToken)
        }
        return s
      }
    )
  }
  /**
   * Checks if the user has opted into the token
   * It checks if the token value is greater than 0
   *
   * @param {string} walletAddress
   * @returns {*} number
   * @memberof Algorand
   */
  async getTokenOptInStatus(
    walletAddress: string,
    optInAssetId: number
  ): Promise<number | bigint | false> {
    let tokens: number | bigint = 0
    const accountInfo = await this.algoIndexer
      .lookupAccountAssets(walletAddress)
      .assetId(optInAssetId)
      .do()
    if (accountInfo['assets'].length > 0) {
      tokens = accountInfo['assets'][0]['amount']
      return tokens
    }
    return false
  }
  @Retryable({ maxAttempts: 5 })
  async lookupAssetByIndex(
    index: number,
    getAll: boolean | undefined = undefined
  ): Promise<AlgorandPlugin.AssetLookupResult> {
    await this.limiter.removeTokens(1)
    return (await this.algoIndexer
      .lookupAssetByID(index)
      .includeAll(getAll)
      .do()) as AlgorandPlugin.AssetLookupResult
  }

  @Retryable({ maxAttempts: 5 })
  async searchTransactions(
    searchCriteria: (s: SearchForTransactions) => SearchForTransactions
  ): Promise<AlgorandPlugin.TransactionSearchResults> {
    await this.limiter.removeTokens(1)
    return (await searchCriteria(
      this.algoIndexer.searchForTransactions()
    ).do()) as AlgorandPlugin.TransactionSearchResults
  }

  async getAssetArc69Metadata(
    assetIndex: number
  ): Promise<AlgorandPlugin.Arc69Payload | undefined> {
    let lastNote: string | undefined = undefined
    const configTransactions = await this.searchTransactions(s =>
      s.assetID(assetIndex).txType(TransactionType.acfg)
    )
    const notes = configTransactions.transactions
      .map(t => ({ note: t.note, round: t['round-time'] ?? 1 }))
      .sort(function (t1, t2) {
        return t1.round - t2.round
      })

    if (notes && notes.length > 0) {
      lastNote = notes[notes.length - 1].note
    }
    return this.noteToArc69Payload(lastNote)
  }

  async updateAssetMetadata() {
    const assets = await this.db.get(AlgoNFTAsset).getAllPlayerAssets()
    const newAss: AlgoNFTAsset[] = []
    const percentInc = Math.floor(assets.length / 6)
    let count = 0
    await this.logger.log('Updating Asset Metadata')
    // Chunk the requests to prevent overloading MySQL
    for (const chunk of chunkArray(assets, 100)) {
      await Promise.all(
        chunk.map(async ea => {
          const asset = await this.getAssetArc69Metadata(ea.assetIndex)
          ea.arc69Meta = asset
          newAss.push(ea)
          count++
          if (count % percentInc === 0) {
            await this.logger.log(`Updated ${count} of ${assets.length} assets`)
          }
        })
      )
      await this.algoNFTAssetRepo.flush()
    }
    await this.logger.log('Completed Asset Metadata Update')
  }

  /**
   * Gets all assets created by a wallet address
   *
   * @param {string} walletAddress
   * @returns {*}  {Promise<AssetResult[]>}
   * @memberof Algorand
   */
  async getCreatedAssets(
    walletAddress: string
  ): Promise<AlgorandPlugin.AssetResult[]> {
    const accountAssets = await this.lookupAccountCreatedAssetsByAddress(
      walletAddress
    )
    const existingAssets = accountAssets.filter(a => !a.deleted)
    if (existingAssets.length === 0) {
      console.log(`Didn't find any assets for account ${walletAddress}`)
      return []
    }
    await this.logger.log(
      `Found ${existingAssets.length} assets for account ${walletAddress}`
    )
    return existingAssets
  }

  /**
   * Lookup all assets created by a wallet address
   *
   * @param {string} address
   * @param {(boolean | undefined)} [getAll=undefined]
   * @returns {*}  {Promise<AssetResult[]>}
   * @memberof Algorand
   */
  async lookupAccountCreatedAssetsByAddress(
    address: string,
    getAll: boolean | undefined = undefined
  ): Promise<AlgorandPlugin.AssetResult[]> {
    return await this.executePaginatedRequest(
      (
        response: AlgorandPlugin.AssetsCreatedLookupResult | { message: string }
      ) => {
        if ('message' in response) {
          throw { status: 404, ...response }
        }
        return response.assets
      },
      nextToken => {
        let s = this.algoIndexer
          .lookupAccountCreatedAssets(address)
          .includeAll(getAll)
          .limit(algorandConfig.defaultAlgoApi.max_api_resources)
        if (nextToken) {
          s = s.nextToken(nextToken)
        }
        return s
      }
    )
  }

  // https://developer.algorand.org/docs/get-details/indexer/#paginated-results
  async executePaginatedRequest<
    TResult,
    TRequest extends { do: () => Promise<any> }
  >(
    extractItems: (response: any) => TResult[],
    buildRequest: (nextToken?: string) => TRequest
  ): Promise<TResult[]> {
    let results = []
    let nextToken: string | undefined = undefined
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const request = buildRequest(nextToken)
      const response = await request.do()
      const items = extractItems(response)
      if (items == null || items.length === 0) {
        break
      }
      results.push(...items)
      nextToken = response['next-token']
      if (!nextToken) {
        break
      }
    }
    return results
  }
  createFakeWallet() {
    let account = algosdk.generateAccount()
    return account.addr
  }
}

const mockTxn = {
  txId: 'MOCK_4TETVHCZO22KDO32PQ44OMGBZUVUR3TXJ5XSZ4T63Z3HC4NSTX4Q',
  status: {
    txn: {
      txn: {
        aamt: 800,
      },
    },
  },
}
