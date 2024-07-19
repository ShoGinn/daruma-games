import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import * as algokit from '@algorandfoundation/algokit-utils';
import {
  SigningAccount,
  TransactionSignerAccount,
} from '@algorandfoundation/algokit-utils/types/account';
import { ClientManager } from '@algorandfoundation/algokit-utils/types/client-manager';
import { AlgoConfig } from '@algorandfoundation/algokit-utils/types/network-client';
import { TransferAssetParams } from '@algorandfoundation/algokit-utils/types/transfer';
import { TransactionType } from 'algosdk';
import { inject, injectable, singleton } from 'tsyringe';

import { getConfig } from '../config/config.js';
import { PostConstruct } from '../decorators/post-construct.js';
import {
  Arc69MetaData,
  Arc69Payload,
  Asset,
  AssetHolding,
  AssetTransferOptions,
  AssetType,
  ClaimTokenTransferOptions,
  ClawbackTokenTransferOptions,
  LookupAssetBalancesResponse,
  LookUpAssetByIDResponse,
  MiniAssetHolding,
  TipTokenTransferOptions,
  TransactionResultOrError,
} from '../types/algorand.js';
import { WalletAddress } from '../types/core.js';
import logger from '../utils/functions/logger-factory.js';

import { handleTransferErrors } from './algorand.errorprocessor.js';
import { CustomCache } from './custom-cache.js';

@singleton()
@injectable()
export class Algorand {
  private _algorandClient?: AlgorandClient;
  private _clawbackAccount?: TransactionSignerAccount & { account: SigningAccount };
  private _claimTokenAccount?: TransactionSignerAccount & { account: SigningAccount };
  public constructor(@inject(CustomCache) private customCache: CustomCache) {}
  setupClients(config?: AlgoConfig): { algorandClient: AlgorandClient } {
    config = config ?? ClientManager.getConfigFromEnvironmentOrLocalNet();
    if (getConfig().get().nodeEnv === 'production') {
      config = {
        ...config,
        algodConfig: ClientManager.getAlgoNodeConfig('mainnet', 'algod'),
        indexerConfig: ClientManager.getAlgoNodeConfig('mainnet', 'indexer'),
      };
    }
    //TODO: remove this once things are working
    process.env['ALGOD_SERVER'] = config.algodConfig.server;
    process.env['ALGOD_PORT'] = config.algodConfig.port?.toString();
    process.env['ALGOD_TOKEN'] = config.algodConfig.token?.toString();
    this._algorandClient = AlgorandClient.fromConfig(config);
    return { algorandClient: this._algorandClient };
  }
  get algorandClient(): AlgorandClient {
    if (!this._algorandClient) {
      const { algorandClient } = this.setupClients();
      return algorandClient;
    }
    return this._algorandClient;
  }
  get clawbackAccount(): TransactionSignerAccount & { account: SigningAccount } {
    if (!this._clawbackAccount) {
      throw new Error('Clawback Account not set');
    }
    return this._clawbackAccount;
  }
  get claimTokenAccount(): TransactionSignerAccount & { account: SigningAccount } {
    if (!this._claimTokenAccount) {
      throw new Error('Claim Token Account not set');
    }
    return this._claimTokenAccount;
  }
  /**
   * Takes a note and returns the arc69 payload if it exists
   *
   * @param {(string | undefined)} note
   * @returns {*}  {Arc69Payload}
   * @memberof Algorand
   */
  noteToArc69Payload(note?: string | undefined | null): Arc69Payload | undefined {
    if (note == null) {
      return undefined;
    }

    const noteUnencoded = Buffer.from(note, 'base64');
    const decoder = new TextDecoder();
    const json = decoder.decode(noteUnencoded);

    if (!json.startsWith('{') || !json.includes('arc69')) {
      return undefined;
    }

    return JSON.parse(json) as Arc69Payload;
  }
  @PostConstruct
  async initAccounts(): Promise<void> {
    if (this._claimTokenAccount && this._clawbackAccount) {
      return;
    }
    const { token, clawback } = await this.getMnemonicAccounts();
    this._claimTokenAccount = token;
    this._clawbackAccount = clawback;
  }
  /**
   * Retrieves the mnemonic from the environment
   * If the claim mnemonic is not set then it will use the clawback mnemonic
   *
   * @returns {*}  {{ token: Account; clawback: Account }}
   * @memberof Algorand
   */
  async getMnemonicAccounts(): Promise<{
    token: TransactionSignerAccount & {
      account: SigningAccount;
    };
    clawback: TransactionSignerAccount & {
      account: SigningAccount;
    };
  }> {
    let claimTokenAccount;
    let clawbackTokenAccount;
    try {
      clawbackTokenAccount = await this.algorandClient.account.fromEnvironment('clawback_token');
    } catch (error) {
      throw new Error(`Clawback Token not set: ${(error as Error).message}`);
    }

    try {
      claimTokenAccount = await this.algorandClient.account.fromEnvironment('claim_token');
    } catch {
      claimTokenAccount = clawbackTokenAccount;
      logger.warn('Claim Token not set, using Clawback Token');
    }

    return { token: claimTokenAccount, clawback: clawbackTokenAccount };
  }
  private createCacheKey(walletAddress: WalletAddress, assetType: AssetType): string {
    return `walletAccountAssets-${walletAddress}-${assetType}`;
  }
  private logAssets<T>(assetType: AssetType, walletAddress: WalletAddress, assets: T[]): void {
    if (assets.length === 0) {
      logger.info(`Didn't find any ${assetType} for account ${walletAddress}`);
    } else if (assetType === AssetType.CreatedAssets) {
      logger.info(`Found ${assets.length} ${assetType} for account ${walletAddress}`);
    }
  }

  private async getCachedOrFetch<T>(cacheKey: string, fetchFunction: () => Promise<T>): Promise<T> {
    const cached = (await this.customCache.get(cacheKey)) as T;
    if (cached) {
      return cached;
    }
    const data = await fetchFunction();
    this.customCache.set(cacheKey, data); // setting cache for 1 hour
    return data;
  }
  /**
   * Retrieves the wallet account from the database
   * It then caches the wallet account for 1 hour
   *
   * @param {string} walletAddress
   * @param {('assets' | 'created-assets')} assetType
   * @returns {*}  {(Promise<AssetHolding[] | MainAssetResult[] | []>)}
   * @memberof Algorand
   */
  public async getAccountAssets<T extends AssetHolding | Asset>(
    walletAddress: WalletAddress,
    assetType: AssetType,
  ): Promise<T[] | []> {
    const cacheKey = this.createCacheKey(walletAddress, assetType);
    const request = this.algorandClient.client.algod.accountInformation(walletAddress);
    const accountAssets = await this.getCachedOrFetch(cacheKey, () => request.do());
    const assets = accountAssets[assetType] as T[];
    this.logAssets(assetType, walletAddress, assets);
    return assets;
  }

  /**
   * Retrieves the asset holdings for a given wallet address and asset index.
   * @param {string} walletAddress - The wallet address to retrieve asset holdings for.
   * @param {number} assetIndex - The index of the asset to retrieve holdings for.
   * @returns {*} {Promise<AssetHolding[] | []>}
   * @memberof Algorand
   */
  public async getHeldAssetFromAccount(
    walletAddress: WalletAddress,
    assetIndex: number,
  ): Promise<AssetHolding | undefined> {
    const request = this.algorandClient.client.algod.accountAssetInformation(
      walletAddress,
      assetIndex,
    );
    let accountAssets;
    try {
      accountAssets = await request.do();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (('response' in error && Number(error.response.status) === 404) || error.status === 404) {
        return;
      }
      logger.error(
        `Failed to get asset holdings for asset ${assetIndex} and wallet ${walletAddress}`,
      );
      logger.error(error);
      return;
    }
    return accountAssets['asset-holding'];
  }

  /**
   * Retrieves the assets owned by a wallet address
   *
   * @param {string} walletAddress
   * @returns {*}  {Promise<AssetHolding[]>}
   * @memberof Algorand
   */
  public async lookupAssetsOwnedByAccount(walletAddress: WalletAddress): Promise<AssetHolding[]> {
    return await this.getAccountAssets<AssetHolding>(walletAddress, AssetType.Assets);
  }

  /**
   * Retrieves the assets created by a wallet address
   *
   * @param {string} walletAddress
   * @returns {*}  {Promise<Asset[]>}
   * @memberof Algorand
   */
  public async getCreatedAssets(walletAddress: WalletAddress): Promise<Asset[]> {
    return await this.getAccountAssets<Asset>(walletAddress, AssetType.CreatedAssets);
  }
  /**
   * Get the token opt in status for a wallet address
   *
   * @param {string} walletAddress
   * @param {number} assetIndex
   * @returns {*}  {(Promise<{ optedIn: boolean; tokens: number | bigint }>)}
   * @memberof Algorand
   */
  async getTokenOptInStatus(
    walletAddress: WalletAddress,
    assetIndex: number,
  ): Promise<{ optedIn: boolean; tokens: number | bigint }> {
    const accountAssets = await this.getHeldAssetFromAccount(walletAddress, assetIndex);
    const tokens = accountAssets?.amount ?? 0;
    const optedIn = !!accountAssets;
    return { optedIn, tokens };
  }
  async lookupAssetBalances(
    assetIndex: number,
    getAll?: boolean | undefined,
  ): Promise<MiniAssetHolding[]> {
    let holders: MiniAssetHolding[] = [];
    let nextToken: string | undefined;
    do {
      const response = this.algorandClient.client.indexer
        .lookupAssetBalances(assetIndex)
        .includeAll(getAll);
      if (nextToken) {
        response.nextToken(nextToken);
      }
      const result = (await response.do()) as LookupAssetBalancesResponse;

      holders = [...holders, ...result.balances.filter((balance) => balance.amount > 0)];
      nextToken = result['next-token'];
    } while (nextToken !== undefined);
    return holders;
  }
  /**
   * Get the asset by index
   *
   * @param {number} assetIndex
   * @param {(boolean | undefined)} [getAll]
   * @returns {*}  {Promise<AssetLookupResult>}
   * @memberof Algorand
   */
  async lookupAssetByIndex(
    assetIndex: number,
    getAll?: boolean | undefined,
  ): Promise<LookUpAssetByIDResponse> {
    const request = this.algorandClient.client.indexer
      .lookupAssetByID(assetIndex)
      .includeAll(getAll);
    return (await request.do()) as LookUpAssetByIDResponse;
  }

  /**
   * Get the asset metadata from the most recent transaction
   *
   * @param {number} assetIndex
   * @returns {*}  {(Promise<Arc69Payload | undefined>)}
   * @memberof Algorand
   */
  async getAssetArc69Metadata(assetIndex: number): Promise<Arc69Payload | undefined> {
    try {
      const acfgTransactions = await algokit.searchTransactions(
        this.algorandClient.client.indexer,
        (s) => s.assetID(assetIndex).txType(TransactionType.acfg),
      );
      // Sort the transactions by round number in descending order
      const sortedTransactions = acfgTransactions.transactions.sort(
        (a, b) => (b['confirmed-round'] ?? 0) - (a['confirmed-round'] ?? 0),
      );
      // Get the note from the most recent transaction (first in the sorted list)
      const lastNote = sortedTransactions[0]?.note;
      if (!lastNote) {
        return undefined;
      }
      return this.noteToArc69Payload(lastNote);
    } catch (error) {
      logger.error(`Error fetching metadata for assetIndex ${assetIndex}:`, error);
      return undefined;
    }
  }
  /**
   * Retrieves the bulk asset metadata for the given asset indexes.
   *
   * @param {number[]} assetIndexes - The indexes of the assets to retrieve metadata for.
   * @returns {Promise<Arc69MetaData[]>} - The bulk asset metadata containing the asset ID and ARC69 payload.
   */
  async getBulkAssetArc69Metadata(assetIndexes: number[]): Promise<Arc69MetaData[] | []> {
    const assetMeta = await Promise.all(
      assetIndexes.map(async (assetId) => {
        const arc69Metadata = await this.getAssetArc69Metadata(assetId);
        return {
          id: assetId,
          arc69: arc69Metadata,
        };
      }),
    );
    return assetMeta.filter((asset) => asset.arc69) as Array<{
      id: number;
      arc69: Arc69Payload;
    }>;
  }

  claimToken(options: ClaimTokenTransferOptions): Promise<TransactionResultOrError> {
    return this.transferOptionsProcessor(options);
  }
  tipToken(options: TipTokenTransferOptions): Promise<TransactionResultOrError> {
    return this.transferOptionsProcessor(options);
  }

  purchaseItem(options: ClawbackTokenTransferOptions): Promise<TransactionResultOrError> {
    options.clawback = true;
    return this.transferOptionsProcessor(options);
  }

  async transferOptionsProcessor(
    options: AssetTransferOptions,
    note: string = 'This transaction was made by the Daruma Game Bot On Discord!',
  ): Promise<TransactionResultOrError> {
    const transferAssetParameters = this.buildTransferAssetParams(options, note);
    return await this.transferAsset(transferAssetParameters);
  }
  async transferAsset(
    transferAssetParameters: TransferAssetParams,
  ): Promise<TransactionResultOrError> {
    try {
      return await algokit.transferAsset(transferAssetParameters, this.algorandClient.client.algod);
    } catch (error) {
      return { error: true, message: handleTransferErrors(error) };
    }
  }
  getSignerAccount(
    options: AssetTransferOptions,
  ): TransactionSignerAccount & { account: SigningAccount } {
    if (options.senderAddress) {
      return this.clawbackAccount;
    }
    return this.claimTokenAccount;
  }
  buildTransferAssetParams(options: AssetTransferOptions, note?: string): TransferAssetParams {
    const { assetIndex, amount, receiverAddress, senderAddress, clawback } = options;
    const fromAccount = this.getSignerAccount(options);
    const transferOptions: TransferAssetParams = {
      from: fromAccount,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      to: clawback ? this.clawbackAccount : receiverAddress!,
      amount: amount,
      assetId: assetIndex,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      clawbackFrom: senderAddress!,
      note,
    };
    return transferOptions;
  }
}
