import { MikroORM } from '@mikro-orm/core';
import pkg, {
    Account,
    assignGroupID,
    isValidAddress,
    makeAssetTransferTxnWithSuggestedParams,
    mnemonicToSecretKey,
    Transaction,
    TransactionType,
    waitForConfirmation,
} from 'algosdk';
import chunk from 'lodash/chunk.js';
import isString from 'lodash/isString.js';
import { container, injectable, singleton } from 'tsyringe';
import { Retryable } from 'typescript-retry-decorator';

import { CustomCache } from './custom-cache.js';
import { AlgoStdAsset } from '../entities/algo-std-asset.entity.js';
import { AlgoStdToken } from '../entities/algo-std-token.entity.js';
import { AlgoWallet } from '../entities/algo-wallet.entity.js';
import { User } from '../entities/user.entity.js';
import { AlgoClientEngine } from '../model/framework/engine/impl/algo-client-engine.js';
import {
    Arc69Payload,
    AssetHolding,
    AssetLookupResult,
    ClaimTokenResponse,
    MainAssetResult,
    PendingTransactionResponse,
    TransactionSearchResults,
} from '../model/types/algorand.js';
import logger from '../utils/functions/logger-factory.js';
const { generateAccount } = pkg;

@singleton()
@injectable()
export class Algorand extends AlgoClientEngine {
    public constructor() {
        super();
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

    /**
     *Validates wallet address
     *
     * @param {string} walletAddress
     * @returns {*} boolean
     * @memberof Algorand
     */
    validateWalletAddress(walletAddress: string): boolean {
        return isValidAddress(walletAddress);
    }

    /**
     * Creates a new wallet using the Algorand SDK
     *
     * @returns {*}  {string}
     * @memberof Algorand
     */
    generateWalletAccount(): string {
        const account = generateAccount();
        return account.addr;
    }
    /**
     * Get account from mnemonic
     *
    
     * @param {string} mnemonic
     * @returns {*}  {Account}
     */
    getAccountFromMnemonic(mnemonic: string): Account | undefined {
        if (!isString(mnemonic)) {
            return;
        }
        const cleanedMnemonic = mnemonic
            .replaceAll(/\W/g, ' ')
            .replaceAll(/\s{2,}/g, ' ')
            .trimEnd()
            .trimStart();
        let secretKey: Account;
        try {
            secretKey = mnemonicToSecretKey(cleanedMnemonic);
        } catch (error) {
            logger.error(`Failed to get account from mnemonic: ${JSON.stringify(error)}`);
            return;
        }
        return secretKey;
    }

    /**
     * Retrieves the mnemonic from the environment
     * If the claim mnemonic is not set then it will use the clawback mnemonic
     *
     * @returns {*}  {{ token: Account; clawback: Account }}
     * @memberof Algorand
     */
    getMnemonicAccounts(): { token: Account; clawback: Account } {
        // If clawback mnemonic and claim mnemonic are the same then use the same account.
        const { claimTokenMnemonic, clawBackTokenMnemonic } = Algorand;

        const claimTokenAccount = claimTokenMnemonic
            ? this.getAccountFromMnemonic(claimTokenMnemonic)
            : this.getAccountFromMnemonic(clawBackTokenMnemonic);

        const clawbackAccount = this.getAccountFromMnemonic(clawBackTokenMnemonic);

        if (!claimTokenAccount || !clawbackAccount) {
            throw new Error('Failed to get accounts from mnemonics');
        }

        return { token: claimTokenAccount, clawback: clawbackAccount };
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
    public async getAccountAssets(
        walletAddress: string,
        assetType: 'assets' | 'created-assets'
    ): Promise<AssetHolding[] | MainAssetResult[] | []> {
        const cache = container.resolve(CustomCache);
        const cacheKey = `walletAccountAssets-${walletAddress}-${assetType}`;
        const cached = (await cache.get(cacheKey)) as AssetHolding[] | MainAssetResult[] | [];
        if (cached) {
            return cached;
        }

        const accountAssets = await this.rateLimitedRequest(async () => {
            return await this.algodClient.accountInformation(walletAddress).do();
        });
        const assets = accountAssets[assetType] as AssetHolding[] | MainAssetResult[];

        // setting cache for 1 hour
        cache.set(cacheKey, assets);
        if (assets.length === 0) {
            logger.info(`Didn't find any ${assetType} for account ${walletAddress}`);
            return [];
        }

        if (assetType === 'created-assets') {
            logger.info(`Found ${assets.length} ${assetType} for account ${walletAddress}`);
        }

        return assets;
    }

    /**
     * Retrieves the assets owned by a wallet address
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<AssetHolding[]>}
     * @memberof Algorand
     */
    public async lookupAssetsOwnedByAccount(walletAddress: string): Promise<AssetHolding[]> {
        return (await this.getAccountAssets(walletAddress, 'assets')) as AssetHolding[];
    }

    /**
     * Retrieves the assets created by a wallet address
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<MainAssetResult[]>}
     * @memberof Algorand
     */
    public async getCreatedAssets(walletAddress: string): Promise<MainAssetResult[]> {
        return (await this.getAccountAssets(walletAddress, 'created-assets')) as MainAssetResult[];
    }
    /**
     * Get the token opt in status for a wallet address
     *
     * @param {string} walletAddress
     * @param {number} optInAssetId
     * @returns {*}  {(Promise<{ optedIn: boolean; tokens: number | bigint }>)}
     * @memberof Algorand
     */
    @Retryable({ maxAttempts: 5 })
    async getTokenOptInStatus(
        walletAddress: string,
        optInAssetId: number
    ): Promise<{ optedIn: boolean; tokens: number | bigint }> {
        const accountAssets = (await this.getAccountAssets(
            walletAddress,
            'assets'
        )) as AssetHolding[];
        const asset = accountAssets.find(a => a['asset-id'] === optInAssetId);

        return {
            optedIn: !!asset,
            tokens: asset?.amount || 0,
        };
    }

    /**
     * Get the asset by index
     *
     * @param {number} index
     * @param {(boolean | undefined)} [getAll]
     * @returns {*}  {Promise<AssetLookupResult>}
     * @memberof Algorand
     */
    @Retryable({ maxAttempts: 5 })
    async lookupAssetByIndex(
        index: number,
        getAll?: boolean | undefined
    ): Promise<AssetLookupResult> {
        return await this.rateLimitedRequest(async () => {
            return (await this.indexerClient
                .lookupAssetByID(index)
                .includeAll(getAll)
                .do()) as AssetLookupResult;
        });
    }

    /**
     * Search for transactions
     *
     * @param {(s: any) => any} searchCriteria
     * @returns {*}  {Promise<TransactionSearchResults>}
     * @memberof Algorand
     */
    @Retryable({ maxAttempts: 5 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async searchTransactions(searchCriteria: (s: any) => any): Promise<TransactionSearchResults> {
        return await this.rateLimitedRequest(async () => {
            return (await searchCriteria(
                this.indexerClient.searchForTransactions()
            ).do()) as TransactionSearchResults;
        });
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
            const acfgTransactions = await this.searchTransactions(s =>
                s.assetID(assetIndex).txType(TransactionType.acfg)
            );
            // Sort the transactions by round number in descending order
            const sortedTransactions = acfgTransactions.transactions.sort(
                (a, b) => (b['confirmed-round'] ?? 0) - (a['confirmed-round'] ?? 0)
            );
            // Get the note from the most recent transaction (first in the sorted list)
            const lastNote = sortedTransactions[0]?.note;
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
     * @returns {Promise<{ id: number; arc69: Arc69Payload }[]>} - The bulk asset metadata containing the asset ID and ARC69 payload.
     */
    async getBulkAssetArc69Metadata(
        assetIndexes: number[]
    ): Promise<{ id: number; arc69: Arc69Payload }[]> {
        const assetMeta = await Promise.all(
            assetIndexes.map(async assetId => {
                const arc69Metadata = await this.getAssetArc69Metadata(assetId);
                return {
                    id: assetId,
                    arc69: arc69Metadata,
                };
            })
        );
        return assetMeta.filter(asset => asset.arc69) as { id: number; arc69: Arc69Payload }[];
    }

    /**
     * This is a batch claim token transfer that will claim all unclaimed tokens for multiple wallets
     *
     * @param {Array<[AlgoWallet, number, string]>} chunk
     * @param {AlgoStdAsset} asset
     * @returns {*}  {Promise<void>}
     * @memberof Algorand
     */
    async unclaimedGroupClaim(
        chunk: Array<[AlgoWallet, number, string]>,
        asset: AlgoStdAsset
    ): Promise<void> {
        try {
            const claimStatus = await this.rateLimitedRequest(async () => {
                return await this.groupClaimToken(asset.id, chunk);
            });
            const chunkUnclaimedAssets = chunk.reduce(
                (accumulator, current) => accumulator + current[1],
                0
            );

            if (claimStatus.txId) {
                logger.info(
                    `Auto Claimed ${
                        chunk.length
                    } wallets with a total of ${chunkUnclaimedAssets.toLocaleString()} ${
                        asset.name
                    } -- Block: ${claimStatus?.status?.['confirmed-round'] ?? 'unk'} -- TxId: ${
                        claimStatus.txId
                    }`
                );
                // Remove the unclaimed tokens from the wallet
                await this.removeUnclaimedTokens(chunk, asset);
            } else {
                logger.error(
                    `Auto Claim Failed ${
                        chunk.length
                    } wallets with a total of ${chunkUnclaimedAssets.toLocaleString()} ${
                        asset.name
                    }`
                );
                // log the failed chunked wallets
                this.logFailedChunkedWallets(chunk);
            }
        } catch (error) {
            logger.error(`Auto Claim Failed: ${(error as Error).message}`);

            this.logFailedChunkedWallets(chunk);
        }
    }

    /**
     * Remove the unclaimed tokens from the wallet
     *
     * @private
     * @param {Array<[AlgoWallet, number, string]>} chunk
     * @param {AlgoStdAsset} asset
     * @returns {*}  {Promise<void>}
     * @memberof Algorand
     */
    private async removeUnclaimedTokens(
        chunk: Array<[AlgoWallet, number, string]>,
        asset: AlgoStdAsset
    ): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();

        const algoStdToken = em.getRepository(AlgoStdToken);
        const userDatabase = em.getRepository(User);

        for (const wallet of chunk) {
            await algoStdToken.removeUnclaimedTokens(wallet[0], asset.id, wallet[1]);
            await userDatabase.syncUserWallets(wallet[2]);
        }
    }

    /**
     * Log the failed chunked wallets
     *
     * @private
     * @param {Array<[AlgoWallet, number, string]>} chunk
     * @memberof Algorand
     */
    private logFailedChunkedWallets(chunk: Array<[AlgoWallet, number, string]>): void {
        for (const wallet of chunk) {
            logger.error(`${wallet[0].address} -- ${wallet[1]} -- ${wallet[2]}`);
        }
    }
    /**
     * Claim Token
     *
     * @param {number} optInAssetId
     * @param {number} amount
     * @param {string} receiverAddress
     * @param {string} [note='Claim']
     * @returns {*}  {Promise<ClaimTokenResponse>}
     * @memberof Algorand
     */
    async claimToken(
        optInAssetId: number,
        amount: number,
        receiverAddress: string,
        note: string = 'Claim'
    ): Promise<ClaimTokenResponse> {
        try {
            if (!this.validateWalletAddress(receiverAddress)) {
                const errorMessage = {
                    'pool-error': 'Invalid Address',
                } as PendingTransactionResponse;
                return { status: errorMessage };
            }
            return await this.assetTransfer(optInAssetId, amount, receiverAddress, '');
        } catch (error) {
            const errorMessage = `Failed the ${note} Token Transfer`;
            if (error instanceof Error) {
                logger.error(errorMessage);
                logger.error(error.stack);
            }
            const errorResponse = {
                'pool-error': errorMessage,
            } as PendingTransactionResponse;

            return { status: errorResponse };
        }
    }

    /**
     * This is a batch claim token transfer that will claim all unclaimed tokens for multiple wallets
     * This is a all successful or all fail transaction
     *
     * @param {number} optInAssetId
     * @param {Array<[AlgoWallet, number, string]>} unclaimedTokenTuple
     * @returns {*}  {Promise<ClaimTokenResponse>}
     * @memberof Algorand
     */
    async groupClaimToken(
        optInAssetId: number,
        unclaimedTokenTuple: Array<[AlgoWallet, number, string]>
    ): Promise<ClaimTokenResponse> {
        // Throw an error if the array is greater than 16
        if (unclaimedTokenTuple.length > 16) {
            logger.error('Atomic Claim Token Transfer: Array is greater than 16');
            const errorMessage = {
                'pool-error': 'Atomic Claim Token Transfer: Array is greater than 16',
            } as PendingTransactionResponse;
            return { status: errorMessage };
        }

        try {
            return await this.rateLimitedRequest(async () => {
                return await this.assetTransfer(optInAssetId, 0, '', '', unclaimedTokenTuple);
            });
        } catch (error) {
            const errorMessage = 'Failed the Atomic Claim Token Transfer';
            if (error instanceof Error) {
                logger.error(errorMessage);
                logger.error(error.stack);
            }
            const errorResponse = {
                'pool-error': errorMessage,
            } as PendingTransactionResponse;
            return { status: errorResponse };
        }
    }

    /**
     * This is a batch claim token transfer that will claim all unclaimed tokens for multiple wallets
     *
     * @param {number} claimThreshold
     * @param {AlgoStdAsset} asset
     * @returns {*}  {Promise<void>}
     * @memberof Algorand
     */
    async unclaimedAutomated(claimThreshold: number, asset: AlgoStdAsset): Promise<void> {
        const cache = container.resolve(CustomCache);
        const cacheKey = `unclaimedAutomated-${asset.id}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
            logger.info(`Skipping ${cacheKey} as it is cached`);
            return;
        }
        // setting cache for 1 hour
        cache.set(cacheKey, true);
        const em = container.resolve(MikroORM).em.fork();
        const userDatabase = em.getRepository(User);
        const algoWalletDatabase = em.getRepository(AlgoWallet);
        const algoStdToken = em.getRepository(AlgoStdToken);
        await userDatabase.userAssetSync();
        const users = await userDatabase.getAllUsers();
        // Get all users wallets that have opted in and have unclaimed "Asset Tokens"
        const walletsWithUnclaimedAssetsTuple: Array<[AlgoWallet, number, string]> = [];
        for (const user of users) {
            const { optedInWallets } = await algoWalletDatabase.allWalletsOptedIn(user.id, asset);
            // If no opted in wallets, goto next user
            if (!optedInWallets) {
                continue;
            }
            // filter out any opted in wallet that does not have unclaimed Asset Tokens
            const walletsWithUnclaimedAssets: Array<AlgoWallet> = [];
            // make tuple with wallet and unclaimed tokens
            for (const wallet of optedInWallets) {
                const singleWallet = await algoStdToken.getWalletWithUnclaimedTokens(
                    wallet,
                    asset.id
                );
                if (singleWallet && singleWallet?.unclaimedTokens > claimThreshold) {
                    walletsWithUnclaimedAssets.push(wallet);
                    walletsWithUnclaimedAssetsTuple.push([
                        wallet,
                        singleWallet.unclaimedTokens,
                        user.id,
                    ]);
                }
            }
        }
        if (walletsWithUnclaimedAssetsTuple.length === 0) {
            logger.info(`No unclaimed ${asset.name} to claim`);
            // Delete cache
            cache.del(cacheKey);
            return;
        }
        await this.batchTransactions(walletsWithUnclaimedAssetsTuple, asset);
        // Delete cache
        cache.del(cacheKey);
    }

    /**
     * This is a batch claim token transfer that will claim all unclaimed tokens for multiple wallets
     *
     * @param {Array<[AlgoWallet, number, string]>} unclaimedAssetsTuple
     * @param {AlgoStdAsset} asset
     * @returns {*}  {Promise<void>}
     * @memberof Algorand
     */
    async batchTransactions(
        unclaimedAssetsTuple: Array<[AlgoWallet, number, string]>,
        asset: AlgoStdAsset
    ): Promise<void> {
        // Only 16 wallets can be claimed in a single atomic transfer so we need to split the array into chunks
        const arraySize = 16;
        const chunkedWallets = chunk(unclaimedAssetsTuple, arraySize);
        const promiseArray = [];
        logger.info(
            `Claiming ${unclaimedAssetsTuple.length} wallets with unclaimed ${asset.name}...`
        );
        logger.info(
            `For a total of ${unclaimedAssetsTuple
                .reduce((accumulator, current) => accumulator + current[1], 0)
                .toLocaleString()} ${asset.name}`
        );
        for (const chunk of chunkedWallets) {
            // sum the total unclaimed Assets for all users using [1] in tuple
            // Claim all unclaimed Assets using atomic transfer
            promiseArray.push(this.unclaimedGroupClaim(chunk, asset));
        }
        await Promise.all(promiseArray);
    }

    /**
     * This transfer tokens from one wallet to another
     *
     * @param {number} optInAssetId
     * @param {number} amount
     * @param {string} receiverAddress
     * @param {string} senderAddress
     * @returns {*}  {Promise<ClaimTokenResponse>}
     * @memberof Algorand
     */
    async tipToken(
        optInAssetId: number,
        amount: number,
        receiverAddress: string,
        senderAddress: string
    ): Promise<ClaimTokenResponse> {
        try {
            if (!this.validateWalletAddress(receiverAddress)) {
                const errorMessage = {
                    'pool-error': 'Invalid Address',
                } as PendingTransactionResponse;
                return { status: errorMessage };
            }
            return await this.assetTransfer(optInAssetId, amount, receiverAddress, senderAddress);
        } catch (error) {
            const errorMessage = 'Failed the Tip Token transfer';
            if (error instanceof Error) {
                logger.error(errorMessage);
                logger.error(error.stack);
            }
            const errorResponse = {
                'pool-error': errorMessage,
            } as PendingTransactionResponse;
            return { status: errorResponse };
        }
    }

    /**
     * This is a generic function to transfer assets using the clawback
     * it can be used to exchange ASA tokens for virtual placeholders in game
     *
     * @param {string} itemName
     * @param {number} optInAssetId
     * @param {number} amount
     * @param {string} rxAddress
     * @returns {*}  {Promise<ClaimTokenResponse>}
     * @memberof Algorand
     */
    async purchaseItem(
        itemName: string,
        optInAssetId: number,
        amount: number,
        rxAddress: string
    ): Promise<ClaimTokenResponse> {
        const failMessage = `${itemName} purchase: encountered an error`;
        try {
            if (!this.validateWalletAddress(rxAddress)) {
                const errorMessage = {
                    'pool-error': 'Invalid Address',
                } as PendingTransactionResponse;
                return { status: errorMessage };
            }
            return await this.assetTransfer(optInAssetId, amount, 'clawback', rxAddress);
        } catch (error) {
            if (error instanceof Error) {
                logger.error(failMessage);
                logger.error(error.stack);
            }
            const errorMessage = {
                'pool-error': failMessage,
            } as PendingTransactionResponse;
            return { status: errorMessage };
        }
    }

    /**
     * This is the raw transfer used in all other transfers
     *
     * @param {number} optInAssetId
     * @param {number} amount
     * @param {string} receiverAddress
     * @param {string} senderAddress
     * @param {Array<[AlgoWallet, number, string]>} [groupTransfer]
     * @returns {*}  {Promise<ClaimTokenResponse>}
     * @memberof Algorand
     */
    async assetTransfer(
        optInAssetId: number,
        amount: number,
        receiverAddress: string,
        senderAddress: string,
        groupTransfer?: Array<[AlgoWallet, number, string]>
    ): Promise<ClaimTokenResponse> {
        try {
            const suggestedParameters = await this.algodClient.getTransactionParams().do();

            // For distributing tokens.
            const { token: claimTokenAccount, clawback: clawbackAccount } =
                this.getMnemonicAccounts();
            let fromAcct = claimTokenAccount.addr;
            let revocationTarget: string | undefined;
            let signTxnAccount = claimTokenAccount.sk;
            if (senderAddress.length > 0) {
                // If this is a tip sender the revocation target is the sender
                // Must have the clawback mnemonic set

                revocationTarget = senderAddress;
                fromAcct = clawbackAccount.addr;
                // Check to make sure the sender has enough funds to cover the tip
                const { tokens: senderBalance } = await this.rateLimitedRequest(async () => {
                    return await this.getTokenOptInStatus(senderAddress, optInAssetId);
                });
                if (senderBalance < amount) {
                    const errorMessage = {
                        'pool-error': 'Insufficient Funds',
                    } as PendingTransactionResponse;
                    return { status: errorMessage };
                }
                if (receiverAddress === 'clawback') {
                    receiverAddress = clawbackAccount.addr;
                }
                signTxnAccount = clawbackAccount.sk;
            }
            // Check if the receiver address is an array of addresses
            let rawTxn: { txId: string };
            if (!groupTransfer || groupTransfer?.length === 1) {
                if (groupTransfer?.length === 1 && groupTransfer[0]) {
                    receiverAddress = groupTransfer[0][0].address;
                    amount = groupTransfer[0][1];
                }
                const singleTxn = makeAssetTransferTxnWithSuggestedParams(
                    fromAcct,
                    receiverAddress,
                    undefined,
                    revocationTarget,
                    amount,
                    undefined,
                    optInAssetId,
                    suggestedParameters
                );
                const rawSingleSignedTxn = singleTxn.signTxn(signTxnAccount);
                rawTxn = await this.algodClient.sendRawTransaction(rawSingleSignedTxn).do();
            } else {
                const rawMultiTxn: Array<Transaction> = [];
                for (const address of groupTransfer) {
                    rawMultiTxn.push(
                        makeAssetTransferTxnWithSuggestedParams(
                            fromAcct,
                            address[0].address,
                            undefined,
                            revocationTarget,
                            address[1],
                            undefined,
                            optInAssetId,
                            suggestedParameters
                        )
                    );
                }
                // Assign the group id to the multi signed transaction
                assignGroupID(rawMultiTxn);
                // Sign the multi signed transaction
                const rawMultiSignedTxn = rawMultiTxn.map(txn => txn.signTxn(signTxnAccount));
                rawTxn = await this.algodClient.sendRawTransaction(rawMultiSignedTxn).do();
            }
            const confirmationStatus = (await waitForConfirmation(
                this.algodClient,
                rawTxn.txId,
                5
            )) as PendingTransactionResponse;
            return { txId: rawTxn?.txId, status: confirmationStatus };
        } catch (error) {
            const errorMessage = 'Asset Transfer: Error sending transaction';
            if (error instanceof Error) {
                logger.error(errorMessage);
                logger.error(error.stack);
            }
            const errorResponse = {
                'pool-error': errorMessage,
            } as PendingTransactionResponse;
            return { status: errorResponse };
        }
    }
}
