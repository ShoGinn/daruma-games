import algosdk, { Account, TransactionType, waitForConfirmation } from 'algosdk';
import SearchForTransactions from 'algosdk/dist/types/client/v2/indexer/searchForTransactions';
import { RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';
import { container, injectable, singleton } from 'tsyringe';
import { Retryable } from 'typescript-retry-decorator';

import { AlgoNFTAsset } from '../entities/AlgoNFTAsset.js';
import { AlgoWallet } from '../entities/AlgoWallet.js';
import { User } from '../entities/User.js';
import METHOD_EXECUTOR_TIME_UNIT from '../enums/METHOD_EXECUTOR_TIME_UNIT.js';
import { RunEvery } from '../model/framework/decorators/RunEvery.js';
import { AlgoClientEngine } from '../model/framework/engine/impl/AlgoClientEngine.js';
import { AssetSyncChecker } from '../model/logic/assetSyncChecker.js';
import logger from '../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../utils/Utils.js';
import { Database } from './Database.js';

@singleton()
@injectable()
export class Algorand extends AlgoClientEngine {
    private db: Database;
    public constructor() {
        super();
        this.db = container.resolve(Database);
    }
    //? rate limiter to prevent hitting the rate limit of the api
    private limiterFlexible = new RateLimiterMemory({
        points: 10,
        duration: 1,
    });
    limiterQueue = new RateLimiterQueue(this.limiterFlexible, {
        maxQueueSize: 100,
    });

    /**
     ** Syncs the assets created by the creators in the .env file
     * Does this every 24 hours
     */
    @RunEvery(1, METHOD_EXECUTOR_TIME_UNIT.days)
    async creatorAssetSync(): Promise<string> {
        let msg = '';
        const creatorAddressArr = await this.db.get(AlgoWallet).getCreatorWallets();
        if (creatorAddressArr.length === 0) {
            msg = 'No Creators to Sync';
            return msg;
        }
        let creatorAssets: AlgorandPlugin.AssetResult[] = [];
        logger.info(`Syncing ${creatorAddressArr.length} Creators`);
        for (let i = 0; i < creatorAddressArr.length; i++) {
            creatorAssets = await this.getCreatedAssets(creatorAddressArr[i].walletAddress);
            await this.db.get(AlgoNFTAsset).addAssetsLookup(creatorAddressArr[i], creatorAssets);
        }
        msg = `Creator Asset Sync Complete -- ${creatorAssets.length} assets`;
        await this.updateAssetMetadata();
        await this.db.get(AlgoNFTAsset).checkAltImageURLAndAssetNotes();
        const assetSync = container.resolve(AssetSyncChecker);
        await assetSync.updateCreatorAssetSync();
        return msg;
    }

    /**
     ** Syncs EVERY user assets every 6 hours
     *
     * @memberof Algorand
     */
    @RunEvery(6, METHOD_EXECUTOR_TIME_UNIT.hours)
    async userAssetSync(): Promise<string> {
        const users = await this.db.get(User).getAllUsers();
        let msg = '';
        if (users.length === 0) {
            msg = 'No Users to Sync';
            return msg;
        }
        logger.info(`Syncing ${users.length} Users`);
        for (let i = 0; i < users.length; i++) {
            const discordUser = users[i].id;
            if (discordUser.length > 10) {
                await this.db.get(User).syncUserWallets(discordUser);
            }
        }
        const assetSync = container.resolve(AssetSyncChecker);

        await assetSync.updateUserAssetSync();
        msg += `User Asset Sync Complete -- ${users.length} users`;
        logger.info(msg);

        return msg;
    }
    noteToArc69Payload(note: string | undefined): AlgorandPlugin.Arc69Payload {
        if (!note) {
            return undefined;
        }
        const noteUnencoded = Buffer.from(note, 'base64');
        const json = new TextDecoder().decode(noteUnencoded);
        if (json.match(/^\{/) && json.includes('arc69')) {
            return JSON.parse(json) as AlgorandPlugin.Arc69Payload;
        }
        return undefined;
    }

    /**
     *Validates wallet address
     *
     * @param {string} walletAddress
     * @returns {*} boolean
     * @memberof Algorand
     */
    validateWalletAddress(walletAddress: string): boolean {
        return algosdk.isValidAddress(walletAddress);
    }
    async claimToken(
        optInAssetId: number,
        amount: number,
        receiverAddress: string
    ): Promise<AlgorandPlugin.ClaimTokenResponse> {
        try {
            if (!this.validateWalletAddress(receiverAddress)) {
                let errorMsg = {
                    'pool-error': 'Invalid Address',
                } as AlgorandPlugin.PendingTransactionResponse;
                return { status: errorMsg };
            }
            return await this.assetTransfer(optInAssetId, amount, receiverAddress, '');
        } catch (error) {
            logger.error('Failed the Claim Token Transfer');
            logger.error(error.stack);
            let errorMsg = {
                'pool-error': 'Failed the Claim Token Transfer',
            } as AlgorandPlugin.PendingTransactionResponse;
            return { status: errorMsg };
        }
    }
    async tipToken(
        optInAssetId: number,
        amount: number,
        receiverAddress: string,
        senderAddress: string
    ): Promise<AlgorandPlugin.ClaimTokenResponse> {
        try {
            if (!this.validateWalletAddress(receiverAddress)) {
                let errorMsg = {
                    'pool-error': 'Invalid Address',
                } as AlgorandPlugin.PendingTransactionResponse;
                return { status: errorMsg };
            }
            return await this.assetTransfer(optInAssetId, amount, receiverAddress, senderAddress);
        } catch (error) {
            logger.error('Failed the Tip Token Transfer');
            logger.error(error.stack);
            let errorMsg = {
                'pool-error': 'Failed the Tip Token transfer',
            } as AlgorandPlugin.PendingTransactionResponse;
            return { status: errorMsg };
        }
    }
    async claimArtifact(
        optInAssetId: number,
        amount: number,
        artifactReceiverAddress: string
    ): Promise<AlgorandPlugin.ClaimTokenResponse> {
        try {
            if (!this.validateWalletAddress(artifactReceiverAddress)) {
                let errorMsg = {
                    'pool-error': 'Invalid Address',
                } as AlgorandPlugin.PendingTransactionResponse;
                return { status: errorMsg };
            }
            return await this.assetTransfer(
                optInAssetId,
                amount,
                'clawback',
                artifactReceiverAddress
            );
        } catch (error) {
            logger.error('Failed the Claim Artifact Transfer');
            logger.error(error.stack);
            let errorMsg = {
                'pool-error': 'Failed the Claim Artifact transfer',
            } as AlgorandPlugin.PendingTransactionResponse;
            return { status: errorMsg };
        }
    }

    private getMnemonicAccounts(): { token: algosdk.Account; clawback: algosdk.Account } {
        const tokenMnemonic = Algorand.claimTokenMnemonic || Algorand.clawBackTokenMnemonic;
        let tokenAccount: Account;
        let clawbackAccount: Account;
        tokenAccount = this.getAccountFromMnemonic(tokenMnemonic);
        if (Algorand.clawBackTokenMnemonic !== tokenMnemonic) {
            clawbackAccount = this.getAccountFromMnemonic(Algorand.clawBackTokenMnemonic);
        } else {
            clawbackAccount = tokenAccount;
        }
        return { token: tokenAccount, clawback: clawbackAccount };
    }
    async assetTransfer(
        optInAssetId: number,
        amount: number,
        receiverAddress: string,
        senderAddress: string
    ): Promise<AlgorandPlugin.ClaimTokenResponse> {
        try {
            const suggestedParams = await this.algodClient.getTransactionParams().do();

            // For distributing tokens.
            let { token: tokenAccount, clawback: clawbackAccount } = this.getMnemonicAccounts();
            let fromAcct = tokenAccount.addr;
            let revocationTarget: string | undefined = undefined;

            if (senderAddress.length > 0) {
                // If this is a tip sender the revocation target is the sender
                // Must have the clawback mnemonic set
                revocationTarget = senderAddress;
                fromAcct = clawbackAccount.addr;
                // Check to make sure the sender has enough funds to cover the tip
                const { tokens: senderBalance } = await this.getTokenOptInStatus(
                    senderAddress,
                    optInAssetId
                );
                if (senderBalance < amount) {
                    let errorMsg = {
                        'pool-error': 'Insufficient Funds',
                    } as AlgorandPlugin.PendingTransactionResponse;
                    return { status: errorMsg };
                }
                if (receiverAddress === 'clawback') {
                    receiverAddress = clawbackAccount.addr;
                }
            }
            const closeRemainderTo = undefined;
            const note = undefined;

            const xtxn = algosdk.makeAssetTransferTxnWithSuggestedParams(
                fromAcct,
                receiverAddress,
                closeRemainderTo,
                revocationTarget,
                amount,
                note,
                optInAssetId,
                suggestedParams
            );
            const rawSignedTxn = xtxn.signTxn(tokenAccount.sk);
            const xtx = await this.algodClient.sendRawTransaction(rawSignedTxn).do();
            const confirmationStatus = (await waitForConfirmation(
                this.algodClient,
                xtx.txId,
                5
            )) as AlgorandPlugin.PendingTransactionResponse;
            return { txId: xtx?.txId, status: confirmationStatus };
        } catch (error) {
            logger.error('Failed the asset Transfer');
            logger.error(error.stack);
            let errorMsg = {
                'pool-error': 'Failed the transfer',
            } as AlgorandPlugin.PendingTransactionResponse;
            return { status: errorMsg };
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
                let s = this.indexerClient
                    .lookupAccountAssets(address)
                    .includeAll(includeAll)
                    .limit(this.algoApiDefaults.max_api_resources);
                if (nextToken) {
                    s = s.nextToken(nextToken);
                }
                return s;
            }
        );
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
    ): Promise<{ optedIn: boolean; tokens: number | bigint }> {
        let tokens: number | bigint = 0;
        let optedInRound: number | undefined;
        const accountInfo = (await this.indexerClient
            .lookupAccountAssets(walletAddress)
            .assetId(optInAssetId)
            .do()) as AlgorandPlugin.AssetsLookupResult;
        if (accountInfo.assets[0]) {
            tokens = accountInfo.assets[0].amount;
            optedInRound = accountInfo.assets[0]['opted-in-at-round'] || 0;
            if (optedInRound > 0) {
                return { optedIn: true, tokens: tokens };
            }
        }
        return { optedIn: false, tokens: 0 };
    }
    @Retryable({ maxAttempts: 5 })
    async lookupAssetByIndex(
        index: number,
        getAll: boolean | undefined = undefined
    ): Promise<AlgorandPlugin.AssetLookupResult> {
        await this.limiterQueue.removeTokens(1);
        return (await this.indexerClient
            .lookupAssetByID(index)
            .includeAll(getAll)
            .do()) as AlgorandPlugin.AssetLookupResult;
    }

    @Retryable({ maxAttempts: 5 })
    async searchTransactions(
        searchCriteria: (s: SearchForTransactions) => SearchForTransactions
    ): Promise<AlgorandPlugin.TransactionSearchResults> {
        await this.limiterQueue.removeTokens(1);
        return (await searchCriteria(
            this.indexerClient.searchForTransactions()
        ).do()) as AlgorandPlugin.TransactionSearchResults;
    }
    async getAssetArc69Metadata(
        assetIndex: number
    ): Promise<AlgorandPlugin.Arc69Payload | undefined> {
        let lastNote: string | undefined = undefined;
        const configTransactions = await this.searchTransactions(s =>
            s.assetID(assetIndex).txType(TransactionType.acfg)
        );
        const notes = configTransactions.transactions
            .map(t => ({ note: t.note, round: t['round-time'] ?? 1 }))
            .sort((t1, t2): number => t1.round - t2.round);

        if (notes && notes.length > 0) {
            lastNote = notes[notes.length - 1].note;
        }
        return this.noteToArc69Payload(lastNote);
    }

    async updateAssetMetadata(): Promise<void> {
        const algoNFTAssetRepo = this.db.get(AlgoNFTAsset);
        const assets = await algoNFTAssetRepo.getAllPlayerAssets();
        const newAss: AlgoNFTAsset[] = [];
        const percentInc = Math.floor(assets.length / 6);
        let count = 0;
        logger.info('Updating Asset Metadata');
        // Chunk the requests to prevent overloading MySQL
        for (const chunk of ObjectUtil.chunkArray(assets, 100)) {
            await Promise.all(
                chunk.map(async ea => {
                    const asset = await this.getAssetArc69Metadata(ea.assetIndex);
                    ea.arc69Meta = asset;
                    newAss.push(ea);
                    count++;
                    if (count % percentInc === 0) {
                        logger.info(`Updated ${count} of ${assets.length} assets`);
                    }
                })
            );
            await algoNFTAssetRepo.flush();
        }
        logger.info('Completed Asset Metadata Update');
    }

    /**
     * Gets all assets created by a wallet address
     *
     * @param {string} walletAddress
     * @returns {*}  {Promise<AssetResult[]>}
     * @memberof Algorand
     */
    async getCreatedAssets(walletAddress: string): Promise<AlgorandPlugin.AssetResult[]> {
        const accountAssets = await this.lookupAccountCreatedAssetsByAddress(walletAddress);
        const existingAssets = accountAssets.filter(a => !a.deleted);
        if (existingAssets.length === 0) {
            logger.info(`Didn't find any assets for account ${walletAddress}`);
            return [];
        }
        logger.info(`Found ${existingAssets.length} assets for account ${walletAddress}`);
        return existingAssets;
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
            (response: AlgorandPlugin.AssetsCreatedLookupResult | { message: string }) => {
                if ('message' in response) {
                    throw { status: 404, ...response };
                }
                return response.assets;
            },
            nextToken => {
                let s = this.indexerClient
                    .lookupAccountCreatedAssets(address)
                    .includeAll(getAll)
                    .limit(this.algoApiDefaults.max_api_resources);
                if (nextToken) {
                    s = s.nextToken(nextToken);
                }
                return s;
            }
        );
    }

    // https://developer.algorand.org/docs/get-details/indexer/#paginated-results
    async executePaginatedRequest<TResult, TRequest extends { do: () => Promise<any> }>(
        extractItems: (response: any) => TResult[],
        buildRequest: (nextToken?: string) => TRequest
    ): Promise<TResult[]> {
        let results = [];
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
    createFakeWallet(): string {
        let account = algosdk.generateAccount();
        return account.addr;
    }
    private mockTxn = {
        txn: {
            txn: {
                aamt: 800,
            },
        },
    };
    /**
     * Get account from mnemonic
     *
     * @export
     * @param {string} mnemonic
     * @returns {*}  {Account}
     */
    private getAccountFromMnemonic(mnemonic: string): Account {
        const cleanedMnemonic = mnemonic
            .replace(/\W/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trimEnd()
            .trimStart();
        return algosdk.mnemonicToSecretKey(cleanedMnemonic);
    }
}
