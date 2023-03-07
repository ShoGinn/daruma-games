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
import { container, injectable, singleton } from 'tsyringe';
import { Retryable } from 'typescript-retry-decorator';

import { CustomCache } from './CustomCache.js';
import { AlgoNFTAsset } from '../entities/AlgoNFTAsset.entity.js';
import { AlgoStdAsset } from '../entities/AlgoStdAsset.entity.js';
import { AlgoStdToken } from '../entities/AlgoStdToken.entity.js';
import { AlgoWallet } from '../entities/AlgoWallet.entity.js';
import { User } from '../entities/User.entity.js';
import { AlgoClientEngine } from '../model/framework/engine/impl/AlgoClientEngine.js';
import {
    Arc69Payload,
    AssetHolding,
    AssetLookupResult,
    AssetsLookupResult,
    ClaimTokenResponse,
    MainAssetResult,
    PendingTransactionResponse,
    TransactionSearchResults,
} from '../model/types/algorand.js';
import logger from '../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../utils/Utils.js';
const { generateAccount } = pkg;

@singleton()
@injectable()
export class Algorand extends AlgoClientEngine {
    public constructor() {
        super();
    }
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
        const userDb = em.getRepository(User);
        const algoWalletDb = em.getRepository(AlgoWallet);
        const algoStdToken = em.getRepository(AlgoStdToken);
        await userDb.userAssetSync();
        const users = await userDb.getAllUsers();
        // Get all users wallets that have opted in and have unclaimed "Asset Tokens"
        const walletsWithUnclaimedAssetsTuple: Array<[AlgoWallet, number, string]> = [];
        for (const user of users) {
            const { optedInWallets } = await algoWalletDb.allWalletsOptedIn(user.id, asset);
            // If no opted in wallets, goto next user
            if (!optedInWallets) continue;
            // filter out any opted in wallet that does not have unclaimed Asset Tokens
            const walletsWithUnclaimedAssets: Array<AlgoWallet> = [];
            // make tuple with wallet and unclaimed tokens
            for (const wallet of optedInWallets) {
                const singleWallet = await algoStdToken.getWalletWithUnclaimedTokens(
                    wallet,
                    asset.id
                );
                if (singleWallet) {
                    if (singleWallet?.unclaimedTokens > claimThreshold) {
                        walletsWithUnclaimedAssets.push(wallet);
                        walletsWithUnclaimedAssetsTuple.push([
                            wallet,
                            singleWallet.unclaimedTokens,
                            user.id,
                        ]);
                    }
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
    async batchTransactions(
        unclaimedAssetsTuple: Array<[AlgoWallet, number, string]>,
        asset: AlgoStdAsset
    ): Promise<void> {
        // Only 16 wallets can be claimed in a single atomic transfer so we need to split the array into chunks
        const arraySize = 16;
        const chunkedWallets = ObjectUtil.chunkArray(unclaimedAssetsTuple, arraySize);
        const promiseArray = [];
        logger.info(
            `Claiming ${unclaimedAssetsTuple.length} wallets with unclaimed ${asset.name}...`
        );
        logger.info(
            `For a total of ${unclaimedAssetsTuple
                .reduce((acc, curr) => acc + curr[1], 0)
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
     * Claim all unclaimed assets for a chunk of wallets
     * This is a all successful or all fail transaction
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
        const em = container.resolve(MikroORM).em.fork();

        const algoStdToken = em.getRepository(AlgoStdToken);
        const userDb = em.getRepository(User);

        const claimStatus = await this.rateLimitedRequest(async () => {
            return await this.groupClaimToken(asset.id, chunk);
        });
        const chunkUnclaimedAssets = chunk.reduce((acc, curr) => acc + curr[1], 0);

        if (claimStatus.txId) {
            logger.info(
                `Auto Claimed ${
                    chunk.length
                } wallets with a total of ${chunkUnclaimedAssets.toLocaleString()} ${
                    asset.name
                } -- Block: ${claimStatus?.status?.['confirmed-round']} -- TxId: ${
                    claimStatus.txId
                }`
            );
            // Remove the unclaimed tokens from the wallet
            for (const wallet of chunk) {
                await algoStdToken.removeUnclaimedTokens(wallet[0], asset.id, wallet[1]);
                await userDb.syncUserWallets(wallet[2]);
            }
        } else {
            logger.error(
                `Auto Claim Failed ${
                    chunk.length
                } wallets with a total of ${chunkUnclaimedAssets.toLocaleString()} ${asset.name}`
            );
            // log the failed chunked wallets
            for (const wallet of chunk) {
                logger.error(`${wallet[0].address} -- ${wallet[1]} -- ${wallet[2]}`);
            }
        }
    }

    /**
     * Takes a note and returns the arc69 payload if it exists
     *
     * @param {(string | undefined)} note
     * @returns {*}  {Arc69Payload}
     * @memberof Algorand
     */
    noteToArc69Payload(note: string | undefined): Arc69Payload | undefined {
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
                const errorMsg = {
                    'pool-error': 'Invalid Address',
                } as PendingTransactionResponse;
                return { status: errorMsg };
            }
            return await this.assetTransfer(optInAssetId, amount, receiverAddress, '');
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed the ${note} Token Transfer`);
                logger.error(error.stack);
            }
            const errorMsg = {
                'pool-error': `Failed the ${note} Token Transfer`,
            } as PendingTransactionResponse;

            return { status: errorMsg };
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
            const errorMsg = {
                'pool-error': 'Atomic Claim Token Transfer: Array is greater than 16',
            } as PendingTransactionResponse;
            return { status: errorMsg };
        }

        try {
            return await this.rateLimitedRequest(async () => {
                return await this.assetTransfer(optInAssetId, 0, '', '', unclaimedTokenTuple);
            });
        } catch (error) {
            if (error instanceof Error) {
                logger.error('Failed the Atomic Claim Token Transfer');
                logger.error(error.stack);
            }
            const errorMsg = {
                'pool-error': 'Failed the Atomic Claim Token Transfer',
            } as PendingTransactionResponse;
            return { status: errorMsg };
        }
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
                const errorMsg = {
                    'pool-error': 'Invalid Address',
                } as PendingTransactionResponse;
                return { status: errorMsg };
            }
            return await this.assetTransfer(optInAssetId, amount, receiverAddress, senderAddress);
        } catch (error) {
            if (error instanceof Error) {
                logger.error('Failed the Tip Token Transfer');
                logger.error(error.stack);
            }
            const errorMsg = {
                'pool-error': 'Failed the Tip Token transfer',
            } as PendingTransactionResponse;
            return { status: errorMsg };
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
        const failMsg = `Failed the ${itemName} Transfer`;
        try {
            if (!this.validateWalletAddress(rxAddress)) {
                const errorMsg = {
                    'pool-error': 'Invalid Address',
                } as PendingTransactionResponse;
                return { status: errorMsg };
            }
            return await this.assetTransfer(optInAssetId, amount, 'clawback', rxAddress);
        } catch (error) {
            if (error instanceof Error) {
                logger.error(failMsg);
                logger.error(error.stack);
            }
            const errorMsg = {
                'pool-error': failMsg,
            } as PendingTransactionResponse;
            return { status: errorMsg };
        }
    }
    private getMnemonicAccounts(): { token: Account; clawback: Account } {
        // If clawback mnemonic and claim mnemonic are the same then use the same account.
        const claimTokenMnemonic = Algorand.claimTokenMnemonic;
        const clawbackMnemonic = Algorand.clawBackTokenMnemonic;

        const claimTokenAccount = claimTokenMnemonic
            ? this.getAccountFromMnemonic(claimTokenMnemonic)
            : this.getAccountFromMnemonic(clawbackMnemonic);

        const clawbackAccount = clawbackMnemonic
            ? this.getAccountFromMnemonic(clawbackMnemonic)
            : this.getAccountFromMnemonic(claimTokenMnemonic);
        if (!claimTokenAccount || !clawbackAccount)
            throw new Error('Failed to get accounts from mnemonics');

        return { token: claimTokenAccount, clawback: clawbackAccount };
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
            const suggestedParams = await this.algodClient.getTransactionParams().do();

            // For distributing tokens.
            const { token: claimTokenAccount, clawback: clawbackAccount } =
                this.getMnemonicAccounts();
            let fromAcct = claimTokenAccount.addr;
            let revocationTarget: string | undefined = undefined;
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
                    const errorMsg = {
                        'pool-error': 'Insufficient Funds',
                    } as PendingTransactionResponse;
                    return { status: errorMsg };
                }
                if (receiverAddress === 'clawback') {
                    receiverAddress = clawbackAccount.addr;
                }
                signTxnAccount = clawbackAccount.sk;
            }
            // Check if the receiver address is an array of addresses
            let rawTxn: { txId: string };
            if (!groupTransfer || groupTransfer?.length === 1) {
                if (groupTransfer?.length === 1) {
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
                    suggestedParams
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
                            suggestedParams
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
            if (error instanceof Error) {
                logger.error('Failed the asset Transfer');
                logger.error(error.stack);
            }
            const errorMsg = {
                'pool-error': 'Failed the transfer',
            } as PendingTransactionResponse;
            return { status: errorMsg };
        }
    }

    async lookupAssetsOwnedByAccount(walletAddress: string): Promise<AssetHolding[]> {
        const accountAssets = await this.rateLimitedRequest(async () => {
            return await this.algodClient.accountInformation(walletAddress).do();
        });
        const ownedAssets = accountAssets['assets'] as Array<AssetHolding>;
        if (ownedAssets.length === 0) {
            logger.info(`Didn't find any assets for account ${walletAddress}`);
            return [];
        }
        return ownedAssets;
    }
    /**
     * Gets all assets owned by a wallet address
     *
     * @param {string} address
     * @param {(boolean | undefined)} [includeAll=undefined]
     * @returns {*}  {Promise<AssetHolding[]>}
     * @memberof Algorand
     */
    async lookupAssetsOwnedByAccountIndexer(
        address: string,
        includeAll: boolean | undefined = undefined
    ): Promise<Array<AssetHolding>> {
        return await this.executePaginatedRequest(
            (response: AssetsLookupResult) => response.assets,
            nextToken => {
                const s = this.indexerClient
                    .lookupAccountAssets(address)
                    .includeAll(includeAll)
                    .limit(this.algoApiMaxResults);
                if (nextToken) {
                    return s.nextToken(nextToken);
                }
                return s;
            }
        );
    }
    // https://developer.algorand.org/docs/get-details/indexer/#paginated-results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async executePaginatedRequest<TResult, TRequest extends { do: () => Promise<any> }>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extractItems: (response: any) => Array<TResult>,
        buildRequest: (nextToken?: string) => TRequest
    ): Promise<Array<TResult>> {
        const results = [];
        let nextToken: string | undefined = undefined;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const request = buildRequest(nextToken);
            const response = await request.do();
            const items = extractItems(response);
            if (items == null || items.length === 0) {
                break;
            }
            results.push(...items);
            nextToken = response['next-token'];
            if (!nextToken) {
                break;
            }
        }
        return results;
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
        let tokens: number | bigint = 0;
        let optedInRound: number | undefined;
        const accountInfo = await this.rateLimitedRequest(async () => {
            return (await this.indexerClient
                .lookupAccountAssets(walletAddress)
                .assetId(optInAssetId)
                .do()) as AssetsLookupResult;
        });
        if (accountInfo.assets[0]) {
            tokens = accountInfo.assets[0].amount;
            optedInRound = accountInfo.assets[0]['opted-in-at-round'] || 0;
            if (optedInRound > 0) {
                return { optedIn: true, tokens };
            }
        }
        return { optedIn: false, tokens: 0 };
    }
    @Retryable({ maxAttempts: 5 })
    async lookupAssetByIndex(
        index: number,
        getAll: boolean | undefined = undefined
    ): Promise<AssetLookupResult> {
        return await this.rateLimitedRequest(async () => {
            return (await this.indexerClient
                .lookupAssetByID(index)
                .includeAll(getAll)
                .do()) as AssetLookupResult;
        });
    }

    @Retryable({ maxAttempts: 5 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async searchTransactions(searchCriteria: (s: any) => any): Promise<TransactionSearchResults> {
        return await this.rateLimitedRequest(async () => {
            return (await searchCriteria(
                this.indexerClient.searchForTransactions()
            ).do()) as TransactionSearchResults;
        });
    }
    async getAssetArc69Metadata(assetIndex: number): Promise<Arc69Payload | undefined> {
        const acfgTransactions = await this.searchTransactions(s =>
            s.assetID(assetIndex).txType(TransactionType.acfg)
        );
        // Sort the transactions by round number in descending order
        const sortedTransactions = acfgTransactions.transactions.sort(
            (a, b) => (b['confirmed-round'] ?? 0) - (a['confirmed-round'] ?? 0)
        );
        // Get the note from the most recent transaction
        const lastNote = sortedTransactions[0]?.note;
        return this.noteToArc69Payload(lastNote);
    }

    async updateAssetMetadata(): Promise<number> {
        const em = container.resolve(MikroORM).em.fork();
        const algoNFTAssetRepo = em.getRepository(AlgoNFTAsset);
        const realWorldAssets = await algoNFTAssetRepo.getAllRealWorldAssets();
        logger.info('Updating Asset Metadata');
        const updatedAssets = await Promise.all(
            ObjectUtil.chunkArray(realWorldAssets, 100).map(async chunk => {
                const updatedChunk = await Promise.all(
                    chunk.map(async chunkedAsset => {
                        const arc69Metadata = await this.getAssetArc69Metadata(chunkedAsset.id);
                        chunkedAsset.arc69 = arc69Metadata;
                        chunkedAsset.updatedAt = new Date();
                        return chunkedAsset;
                    })
                );
                await algoNFTAssetRepo.persistAndFlush(updatedChunk);
                return updatedChunk;
            })
        );
        const updatedAssetsFlat = updatedAssets.flat();
        logger.info(`Completed Asset Metadata Update for ${updatedAssetsFlat.length} assets`);
        return updatedAssetsFlat.length;
    }
    /**
     * Gets all assets created by a wallet address
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<MainAssetResult[]>}
     * @memberof Algorand
     */
    async getCreatedAssets(walletAddress: string): Promise<MainAssetResult[]> {
        const accountAssets = await this.algodClient.accountInformation(walletAddress).do();
        const creatorAssets = accountAssets['created-assets'] as Array<MainAssetResult>;
        if (creatorAssets.length === 0) {
            logger.info(`Didn't find any assets for account ${walletAddress}`);
            return [];
        }
        logger.info(`Found ${creatorAssets.length} assets for account ${walletAddress}`);
        return creatorAssets;
    }

    createFakeWallet(): string {
        const account = generateAccount();
        return account.addr;
    }
    /**
     * Get account from mnemonic
     *
    
     * @param {string} mnemonic
     * @returns {*}  {Account}
     */
    private getAccountFromMnemonic(mnemonic: string): Account | undefined {
        if (!ObjectUtil.isValidString(mnemonic)) {
            return;
        }
        const cleanedMnemonic = mnemonic
            .replace(/\W/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trimEnd()
            .trimStart();
        return mnemonicToSecretKey(cleanedMnemonic);
    }
}
