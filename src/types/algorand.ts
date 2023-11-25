// This file is used to translate the Api generated types into something more
import SearchForTransactions from 'algosdk/dist/types/client/v2/indexer/searchForTransactions.js';

import { IAlgoStdAsset } from '../database/algo-std-asset/algo-std-asset.schema.js';

import {
  components as AlgoIndexerComponents,
  operations as AlgoIndexerOperations,
} from './api-generated/algoindexer.js';
import { Arc69Payload as Arc69Api } from './api-generated/arc69.js';
import { components as MainnetComponents } from './api-generated/mainnet.js';
import { DiscordId, ReceiverWalletAddress, SenderWalletAddress, WalletAddress } from './core.js';

// Part of the account information returned by the Algorand API
export type AssetHolding = MainnetComponents['schemas']['AssetHolding'];
export type Asset = MainnetComponents['schemas']['Asset'];

// Arc69 is the standard for NFTs on Algorand (not generated but not changing)
export type Arc69Payload = Arc69Api;

// Lookup Asset Balances
export type LookupAssetBalancesResponse =
  AlgoIndexerOperations['lookupAssetBalances']['responses']['200']['content']['application/json'];
export type MiniAssetHolding = AlgoIndexerComponents['schemas']['MiniAssetHolding'];

export type LookUpAssetByIDResponse =
  AlgoIndexerOperations['lookupAssetByID']['responses']['200']['content']['application/json'];

// Search for transaction

export type SearchForTransactionsResponse =
  AlgoIndexerOperations['searchForTransactions']['responses']['200']['content']['application/json'];

export type EvalDelta = AlgoIndexerComponents['schemas']['EvalDelta'];
// https://developer.algorand.org/docs/rest-apis/algod/v2/#get-v2transactionspendingtxid
export type PendingTransactionResponse = {
  'pool-error': string;
  /**
   * The raw signed transaction.
   */
  txn: import('algosdk').EncodedSignedTransaction;
  /**
   * The application index if the transaction was found and it created an
   * application.
   */
  'application-index'?: number;
  /**
   * The number of the asset's unit that were transferred to the close-to address.
   */
  'asset-closing-amount'?: number;
  /**
   * The asset index if the transaction was found and it created an asset.
   */
  'asset-index'?: number;
  /**
   * Rewards in microalgos applied to the close remainder to account.
   */
  'close-rewards'?: number;
  /**
   * Closing amount for the transaction.
   */
  'closing-amount'?: number;
  /**
   * The round where this transaction was confirmed, if present.
   */
  'confirmed-round'?: number;
  /**
   * (gd) Global state key/value changes for the application being executed by this
   * transaction.
   */
  'global-state-delta'?: Array<Record<string, EvalDelta>>;
  /**
   * Inner transactions produced by application execution.
   */
  'inner-txns'?: PendingTransactionResponse[];
  /**
   * (ld) Local state key/value changes for the application being executed by this
   * transaction.
   */
  'local-state-delta'?: Array<Record<string, EvalDelta>>;
  /**
   * (lg) Logs for the application being executed by this transaction.
   */
  logs?: Uint8Array[];
  /**
   * Rewards in microalgos applied to the receiver account.
   */
  'receiver-rewards'?: number;
  /**
   * Rewards in microalgos applied to the sender account.
   */
  'sender-rewards'?: number;
};
/*

Custom Types used by functions

*/

// Define the type for the search criteria function
export type SearchCriteria<T> = (search: SearchForTransactions) => T;

// Custom Type used for some functions
export type Arc69MetaData = {
  id: number;
  arc69: Arc69Payload;
};

// * These are more custom types

export type ClaimTokenResponse = {
  status?: PendingTransactionResponse;
  txId?: string;
  error?: string;
};

export interface AlgorandTransaction {
  revocationTarget?: WalletAddress;
  from: WalletAddress;
  note?: Uint8Array;
  suggestedParams: import('algosdk').SuggestedParams;
  to: string;
  closeRemainderTo?: string;
  amount: number | bigint;
  assetIndex: number;
  rekeyTo?: WalletAddress;
}
export interface WalletWithUnclaimedAssets {
  walletAddress: ReceiverWalletAddress;
  unclaimedTokens: number;
  discordUserId: DiscordId;
}
export enum AssetType {
  Assets = 'assets',
  CreatedAssets = 'created-assets',
}

export type UnclaimedAsset = Pick<IAlgoStdAsset, '_id' | 'name' | 'unitName'>;

export interface AssetTransferOptions {
  assetIndex: number;
  amount?: number;
  receiverAddress?: ReceiverWalletAddress;
  senderAddress?: SenderWalletAddress;
  clawback?: boolean;
}
export type ClaimTokenTransferOptions = Omit<AssetTransferOptions, 'senderAddress' | 'clawback'> & {
  amount: number;
  receiverAddress: ReceiverWalletAddress;
};
export type TipTokenTransferOptions = Omit<AssetTransferOptions, 'clawback'> & {
  amount: number;
  receiverAddress: ReceiverWalletAddress;
  senderAddress: SenderWalletAddress;
};

export type ClawbackTokenTransferOptions = Omit<AssetTransferOptions, 'receiverAddress'> & {
  amount: number;
  senderAddress: SenderWalletAddress;
};
