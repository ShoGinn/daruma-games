import { MikroORM } from '@mikro-orm/core';
import algosdk, { Account, TransactionType, waitForConfirmation } from 'algosdk';
import SearchForTransactions from 'algosdk/dist/types/client/v2/indexer/searchForTransactions';
import { container, injectable, singleton } from 'tsyringe';
import { Retryable } from 'typescript-retry-decorator';

import { AlgoNFTAsset } from '../entities/AlgoNFTAsset.js';
import { AlgoStdAsset } from '../entities/AlgoStdAsset.js';
import { AlgoStdToken } from '../entities/AlgoStdToken.js';
import { AlgoWallet } from '../entities/AlgoWallet.js';
import { User } from '../entities/User.js';
import METHOD_EXECUTOR_TIME_UNIT from '../enums/METHOD_EXECUTOR_TIME_UNIT.js';
import { RunEvery } from '../model/framework/decorators/RunEvery.js';
import { Schedule } from '../model/framework/decorators/Schedule.js';
import { AlgoClientEngine } from '../model/framework/engine/impl/AlgoClientEngine.js';
import { AssetSyncChecker } from '../model/logic/assetSyncChecker.js';
import logger from '../utils/functions/LoggerFactory.js';
import { ObjectUtil, validString } from '../utils/Utils.js';

@singleton()
@injectable()
export class Algorand extends AlgoClientEngine {
    public constructor() {
        super();
    }
    /**
     ** Syncs the assets created by the creators in the .env file
     * Does this every 24 hours
     */
    @Schedule('0 0 * * *')
    async creatorAssetSync(): Promise<string> {
        const em = container.resolve(MikroORM).em.fork();
        let msg = '';
        const creatorAddressArr = await em.getRepository(AlgoWallet).getCreatorWallets();
        if (creatorAddressArr.length === 0) {
            return 'No Creators to Sync';
        }
        let creatorAssets: Array<AlgorandPlugin.AssetResult> = [];
        logger.info(`Syncing ${creatorAddressArr.length} Creators`);
        for (const creatorA of creatorAddressArr) {
            creatorAssets = await this.getCreatedAssets(creatorA.address);
            await em.getRepository(AlgoNFTAsset).addAssetsLookup(creatorA, creatorAssets);
        }
        msg = `Creator Asset Sync Complete -- ${creatorAssets.length} assets`;
        await this.updateAssetMetadata();
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
        const em = container.resolve(MikroORM).em.fork();
        const users = await em.getRepository(User).getAllUsers();
        let msg = '';
        if (users.length === 0) {
            return 'No Users to Sync';
        }
        logger.info(`Syncing ${users.length} Users`);
        for (const user of users) {
            const discordUser = user.id;
            await em.getRepository(User).syncUserWallets(discordUser);
            // const _msg = `${discordUser}|${await em
            //     .getRepository(User)
            //     .syncUserWallets(discordUser)}`;

            // logger.debug(_msg.replace(/\n|\r/g, ' -- '));
        }
        const assetSync = container.resolve(AssetSyncChecker);

        await assetSync.updateUserAssetSync();
        msg += `User Asset Sync Complete -- ${users.length} users`;
        logger.info(msg);

        return msg;
    }
    async unclaimedAutomated(claimThreshold: number, asset: AlgoStdAsset): Promise<void> {
        const em = container.resolve(MikroORM).em.fork();
        const userDb = em.getRepository(User);
        const algoWalletDb = em.getRepository(AlgoWallet);
        const algoStdToken = em.getRepository(AlgoStdToken);
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
                const singleWallet = await algoStdToken.checkIfWalletHasAssetWithUnclaimedTokens(
                    wallet,
                    asset.id
                );
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
        if (walletsWithUnclaimedAssetsTuple.length === 0) {
            logger.info(`No unclaimed ${asset.name} to claim`);
            return;
        }
        // Only 16 wallets can be claimed in a single atomic transfer so we need to split the array into chunks
        const arraySize = 16;
        const chunkedWallets = ObjectUtil.chunkArray(walletsWithUnclaimedAssetsTuple, arraySize);
        const promiseArray = [];
        logger.info(
            `Claiming ${walletsWithUnclaimedAssetsTuple.length} wallets with unclaimed ${asset.name}...`
        );
        logger.info(
            `For a total of ${walletsWithUnclaimedAssetsTuple.reduce(
                (acc, curr) => acc + curr[1],
                0
            )} ${asset.name}`
        );
        for (const chunk of chunkedWallets) {
            // sum the total unclaimed Assets for all users using [1] in tuple
            // Claim all unclaimed Assets using atomic transfer
            promiseArray.push(this.unclaimedAtomicClaim(chunk, asset));
        }
        await Promise.all(promiseArray);
    }
    async unclaimedAtomicClaim(
        chunk: Array<[AlgoWallet, number, string]>,
        asset: AlgoStdAsset
    ): Promise<void> {
        await this.limiterQueue.removeTokens(1);
        const em = container.resolve(MikroORM).em.fork();

        const algoStdToken = em.getRepository(AlgoStdToken);
        const userDb = em.getRepository(User);

        const claimStatus = await this.atomicClaimToken(asset.id, chunk);
        const chunkUnclaimedAssets = chunk.reduce((acc, curr) => acc + curr[1], 0);

        if (claimStatus.txId) {
            logger.info(
                `Auto Claimed ${
                    chunk.length
                } wallets with a total of ${chunkUnclaimedAssets.toLocaleString()} ${
                    asset.name
                } -- Block: ${claimStatus?.status['confirmed-round']} -- TxId: ${claimStatus.txId}`
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
        receiverAddress: string,
        note: string = 'Claim'
    ): Promise<AlgorandPlugin.ClaimTokenResponse> {
        try {
            if (!this.validateWalletAddress(receiverAddress)) {
                const errorMsg = {
                    'pool-error': 'Invalid Address',
                } as AlgorandPlugin.PendingTransactionResponse;
                return { status: errorMsg };
            }
            return await this.assetTransfer(optInAssetId, amount, receiverAddress, '');
        } catch (error) {
            logger.error(`Failed the ${note} Token Transfer`);
            logger.error(error.stack);
            const errorMsg = {
                'pool-error': `Failed the ${note} Token Transfer`,
            } as AlgorandPlugin.PendingTransactionResponse;
            return { status: errorMsg };
        }
    }
    async atomicClaimToken(
        optInAssetId: number,
        unclaimedTokenTuple: Array<[AlgoWallet, number, string]>
    ): Promise<AlgorandPlugin.ClaimTokenResponse> {
        // Throw an error if the array is greater than 16
        await this.limiterQueue.removeTokens(1);
        if (unclaimedTokenTuple.length > 16) {
            logger.error('Atomic Claim Token Transfer: Array is greater than 16');
            const errorMsg = {
                'pool-error': 'Atomic Claim Token Transfer: Array is greater than 16',
            } as AlgorandPlugin.PendingTransactionResponse;
            return { status: errorMsg };
        }

        try {
            return await this.assetTransfer(optInAssetId, 0, '', '', unclaimedTokenTuple);
        } catch (error) {
            logger.error('Failed the Atomic Claim Token Transfer');
            logger.error(error.stack);
            const errorMsg = {
                'pool-error': 'Failed the Atomic Claim Token Transfer',
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
                const errorMsg = {
                    'pool-error': 'Invalid Address',
                } as AlgorandPlugin.PendingTransactionResponse;
                return { status: errorMsg };
            }
            return await this.assetTransfer(optInAssetId, amount, receiverAddress, senderAddress);
        } catch (error) {
            logger.error('Failed the Tip Token Transfer');
            logger.error(error.stack);
            const errorMsg = {
                'pool-error': 'Failed the Tip Token transfer',
            } as AlgorandPlugin.PendingTransactionResponse;
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
     * @returns {*}  {Promise<AlgorandPlugin.ClaimTokenResponse>}
     * @memberof Algorand
     */
    async purchaseItem(
        itemName: string,
        optInAssetId: number,
        amount: number,
        rxAddress: string
    ): Promise<AlgorandPlugin.ClaimTokenResponse> {
        const failMsg = `Failed the ${itemName} Transfer`;
        try {
            if (!this.validateWalletAddress(rxAddress)) {
                const errorMsg = {
                    'pool-error': 'Invalid Address',
                } as AlgorandPlugin.PendingTransactionResponse;
                return { status: errorMsg };
            }
            return await this.assetTransfer(optInAssetId, amount, 'clawback', rxAddress);
        } catch (error) {
            logger.error(failMsg);
            logger.error(error.stack);
            const errorMsg = {
                'pool-error': failMsg,
            } as AlgorandPlugin.PendingTransactionResponse;
            return { status: errorMsg };
        }
    }
    private getMnemonicAccounts(): { token: algosdk.Account; clawback: algosdk.Account } {
        // If clawback mnemonic and claim mnemonic are the same then use the same account.
        const claimTokenMnemonic = Algorand.claimTokenMnemonic;
        const clawbackMnemonic = Algorand.clawBackTokenMnemonic;

        const claimTokenAccount = claimTokenMnemonic
            ? this.getAccountFromMnemonic(claimTokenMnemonic)
            : this.getAccountFromMnemonic(clawbackMnemonic);

        const clawbackAccount = clawbackMnemonic
            ? this.getAccountFromMnemonic(clawbackMnemonic)
            : this.getAccountFromMnemonic(claimTokenMnemonic);

        return { token: claimTokenAccount, clawback: clawbackAccount };
    }
    async assetTransfer(
        optInAssetId: number,
        amount: number,
        receiverAddress: string,
        senderAddress: string,
        atomicTransfer?: Array<[AlgoWallet, number, string]>
    ): Promise<AlgorandPlugin.ClaimTokenResponse> {
        await this.limiterQueue.removeTokens(1);

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
                const { tokens: senderBalance } = await this.getTokenOptInStatus(
                    senderAddress,
                    optInAssetId
                );
                if (senderBalance < amount) {
                    const errorMsg = {
                        'pool-error': 'Insufficient Funds',
                    } as AlgorandPlugin.PendingTransactionResponse;
                    return { status: errorMsg };
                }
                if (receiverAddress === 'clawback') {
                    receiverAddress = clawbackAccount.addr;
                }
                signTxnAccount = clawbackAccount.sk;
            }
            // Check if the receiver address is an array of addresses
            let rawTxn: { txId: string };
            if (!atomicTransfer || atomicTransfer?.length === 1) {
                if (atomicTransfer?.length === 1) {
                    receiverAddress = atomicTransfer[0][0].address;
                    amount = atomicTransfer[0][1];
                }
                const singleTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(
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
                const rawMultiTxn: Array<algosdk.Transaction> = [];
                for (const address of atomicTransfer) {
                    rawMultiTxn.push(
                        algosdk.makeAssetTransferTxnWithSuggestedParams(
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
                algosdk.assignGroupID(rawMultiTxn);
                // Sign the multi signed transaction
                const rawMultiSignedTxn = rawMultiTxn.map(txn => txn.signTxn(signTxnAccount));
                rawTxn = await this.algodClient.sendRawTransaction(rawMultiSignedTxn).do();
            }
            const confirmationStatus = (await waitForConfirmation(
                this.algodClient,
                rawTxn.txId,
                5
            )) as AlgorandPlugin.PendingTransactionResponse;
            return { txId: rawTxn?.txId, status: confirmationStatus };
        } catch (error) {
            logger.error('Failed the asset Transfer');
            logger.error(error.stack);
            const errorMsg = {
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
    ): Promise<Array<AlgorandPlugin.AssetHolding>> {
        return await this.executePaginatedRequest(
            (response: AlgorandPlugin.AssetsLookupResult) => response.assets,
            nextToken => {
                const s = this.indexerClient
                    .lookupAccountAssets(address)
                    .includeAll(includeAll)
                    .limit(this.algoApiDefaults.max_api_resources);
                if (nextToken) {
                    return s.nextToken(nextToken);
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
    @Retryable({ maxAttempts: 5 })
    async getTokenOptInStatus(
        walletAddress: string,
        optInAssetId: number
    ): Promise<{ optedIn: boolean; tokens: number | bigint }> {
        let tokens: number | bigint = 0;
        let optedInRound: number | undefined;
        await this.limiterQueue.removeTokens(1);
        const accountInfo = (await this.indexerClient
            .lookupAccountAssets(walletAddress)
            .assetId(optInAssetId)
            .do()) as AlgorandPlugin.AssetsLookupResult;
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
        const em = container.resolve(MikroORM).em.fork();
        const algoNFTAssetRepo = em.getRepository(AlgoNFTAsset);
        const assets = await algoNFTAssetRepo.getAllPlayerAssets();
        const newAss: Array<AlgoNFTAsset> = [];
        const percentInc = Math.floor(assets.length / 6);
        let count = 0;
        logger.info('Updating Asset Metadata');
        // Chunk the requests to prevent overloading the database
        for (const chunk of ObjectUtil.chunkArray(assets, 100)) {
            await Promise.all(
                chunk.map(async ea => {
                    const asset = await this.getAssetArc69Metadata(ea.id);
                    ea.arc69 = asset;
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
    async getCreatedAssets(walletAddress: string): Promise<Array<AlgorandPlugin.AssetResult>> {
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
    ): Promise<Array<AlgorandPlugin.AssetResult>> {
        return await this.executePaginatedRequest(
            (response: AlgorandPlugin.AssetsCreatedLookupResult | { message: string }) => {
                if ('message' in response) {
                    throw { status: 404, ...response };
                }
                return response.assets;
            },
            nextToken => {
                const s = this.indexerClient
                    .lookupAccountCreatedAssets(address)
                    .includeAll(getAll)
                    .limit(this.algoApiDefaults.max_api_resources);
                if (nextToken) {
                    return s.nextToken(nextToken);
                }
                return s;
            }
        );
    }

    // https://developer.algorand.org/docs/get-details/indexer/#paginated-results
    async executePaginatedRequest<TResult, TRequest extends { do: () => Promise<any> }>(
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
    createFakeWallet(): string {
        const account = algosdk.generateAccount();
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
        if (!validString(mnemonic)) {
            return;
        }
        const cleanedMnemonic = mnemonic
            .replace(/\W/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trimEnd()
            .trimStart();
        return algosdk.mnemonicToSecretKey(cleanedMnemonic);
    }
}
