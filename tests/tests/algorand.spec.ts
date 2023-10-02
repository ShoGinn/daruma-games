/* eslint-disable @typescript-eslint/no-explicit-any */
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { generateAccount, secretKeyToMnemonic } from 'algosdk';
import { FetchMock } from 'jest-fetch-mock';
import { container } from 'tsyringe';

import { getConfig } from '../../src/config/config.js';
import { AlgoStdAsset } from '../../src/entities/algo-std-asset.entity.js';
import { AlgoWallet } from '../../src/entities/algo-wallet.entity.js';
import { Algorand } from '../../src/services/algorand.js';
import { mockCustomCache } from '../mocks/mock-custom-cache.js';
import { initORM } from '../utils/bootstrap.js';
import { createRandomASA, createRandomUserWithWalletAndAsset } from '../utils/test-funcs.js';

jest.mock('../../src/services/custom-cache.js', () => ({
    CustomCache: jest.fn().mockImplementation(() => mockCustomCache),
}));
const arc69Example = {
    standard: 'arc69',
    description: 'AlgoDaruma #1 Giveaway!',
    mime_type: 'image/png',
    properties: {
        'Accessory (Back)': 'Common - Good Luck Stick',
        'Accessory (Head)': 'Common - Horn',
        'Background (BG)': 'Uncommon - BG + BG Design',
        'Body Design': 'Uncommon - Gold Design',
        'Eye Accessories': 'Epic - Mummy Wrap/Eye',
        'Face Color': 'Rare - Gold Face',
    },
};
const config = getConfig();
function encodeArc69Metadata(metadata: any): string {
    return Buffer.from(JSON.stringify(metadata), 'utf8').toString('base64');
}
describe('Algorand service tests', () => {
    const mockFetch = fetch as FetchMock;
    let algorand: Algorand;

    beforeAll(() => {
        config.set('clawbackTokenMnemonic', 'test');
        algorand = container.resolve(Algorand);
    });
    beforeEach(() => {
        mockFetch.resetMocks();
    });
    afterEach(() => {
        config.set('clawbackTokenMnemonic', '');
        config.set('claimTokenMnemonic', '');
    });

    describe('noteToArc69Payload', () => {
        it('should return undefined if note is null or undefined', () => {
            let arc69 = algorand.noteToArc69Payload(null);
            expect(arc69).toBeUndefined();
            arc69 = algorand.noteToArc69Payload();
            expect(arc69).toBeUndefined();
        });
        it('should convert note to arc69 payload', () => {
            const assetNote = {
                note: encodeArc69Metadata(arc69Example),
            };
            const arc69 = algorand.noteToArc69Payload(assetNote.note);
            expect(arc69).toEqual(arc69Example);
        });
        it('should return undefined if note is not a valid arc69 payload', () => {
            const encoded: string = Buffer.from('test string', 'utf8').toString('base64');
            const arc69 = algorand.noteToArc69Payload(encoded);
            expect(arc69).toBeUndefined();
        });
    });
    describe('validateWalletAddress / generateWalletAccount', () => {
        it('should return false because the wallet is invalid', () => {
            const valid = algorand.validateWalletAddress('test');
            expect(valid).toBeFalsy();
        });
        it('should create a fake wallet return true because the wallet is valid', () => {
            const validWallet = algorand.generateWalletAccount();
            const valid = algorand.validateWalletAddress(validWallet);
            expect(valid).toBeTruthy();
        });
    });
    describe('getAccountFromMnemonic', () => {
        it('should return undefined if the string is not valid', () => {
            const account = algorand.getAccountFromMnemonic(' ');
            expect(account).toBeUndefined();
        });
        it('should return undefined if the mnemonic is invalid', () => {
            const acct = algorand.getAccountFromMnemonic('test');
            expect(acct).toBeUndefined();
        });
        it('should return undefined if the mnemonic is not a string', () => {
            const acct = algorand.getAccountFromMnemonic(1 as unknown as string);
            expect(acct).toBeUndefined();
        });
        it('should return an account if the mnemonic is valid', () => {
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            const account = algorand.getAccountFromMnemonic(mnemonic);
            expect(account).toHaveProperty('addr', acct.addr);
        });
        it('should clean up the mnemonic before returning the account', () => {
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            // replaced spaced with commas
            let modifiedMnemonic = mnemonic.replaceAll(' ', ',');
            let checkedAcct = algorand.getAccountFromMnemonic(modifiedMnemonic);
            expect(checkedAcct).toHaveProperty('addr', acct.addr);
            // replace one space with two spaces in mnemonic
            modifiedMnemonic = mnemonic.replaceAll(' ', '  ');
            checkedAcct = algorand.getAccountFromMnemonic(modifiedMnemonic);
            expect(checkedAcct).toHaveProperty('addr', acct.addr);
        });
    });
    describe('getMnemonicAccounts', () => {
        it('should throw an error if either mnemonic is invalid', () => {
            expect.assertions(3);
            try {
                algorand.getMnemonicAccounts();
            } catch (error) {
                expect(error).toHaveProperty('message', 'Failed to get accounts from mnemonics');
            }
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            config.set('clawbackTokenMnemonic', mnemonic);
            config.set('claimTokenMnemonic', 'test');
            try {
                algorand.getMnemonicAccounts();
            } catch (error) {
                expect(error).toHaveProperty('message', 'Failed to get accounts from mnemonics');
            }
            config.set('claimTokenMnemonic', mnemonic);
            config.set('clawbackTokenMnemonic', 'test');

            try {
                algorand.getMnemonicAccounts();
            } catch (error) {
                expect(error).toHaveProperty('message', 'Failed to get accounts from mnemonics');
            }
        });
        it('should return the clawback account because the claim account is not set', () => {
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            config.set('clawbackTokenMnemonic', mnemonic);
            const accounts = algorand.getMnemonicAccounts();
            expect(accounts.clawback).toStrictEqual(acct);
            expect(accounts.token).toStrictEqual(acct);
        });
        it('should return the individual accounts', () => {
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            config.set('claimTokenMnemonic', mnemonic);
            const acct2 = generateAccount();
            const mnemonic2 = secretKeyToMnemonic(acct2.sk);
            config.set('clawbackTokenMnemonic', mnemonic2);
            const accounts = algorand.getMnemonicAccounts();
            expect(accounts.clawback).toStrictEqual(acct2);
            expect(accounts.token).toStrictEqual(acct);
        });
        it('should return the same account for both', () => {
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            config.set('claimTokenMnemonic', mnemonic);
            config.set('clawbackTokenMnemonic', mnemonic);
            const accounts = algorand.getMnemonicAccounts();
            expect(accounts.clawback).toStrictEqual(acct);
            expect(accounts.token).toStrictEqual(acct);
        });
    });
    describe('getAccountAssets', () => {
        it('should return an empty array if there are no asset holdings', async () => {
            fetchMock.mockResponseOnce(JSON.stringify({ assets: [] }));
            const assets = await algorand.getAccountAssets('test-address', 'assets');
            expect(assets).toEqual([]);
        });

        it('should return an empty array if there are no created assets', async () => {
            fetchMock.mockResponseOnce(JSON.stringify({ 'created-assets': [] }));
            const assets = await algorand.getAccountAssets('test-address', 'created-assets');
            expect(assets).toEqual([]);
        });

        it('should return cached asset holdings if they exist', async () => {
            const cachedAssets = [{ assetId: 1, amount: 100 }];
            mockCustomCache.get = jest.fn().mockReturnValueOnce({ assets: cachedAssets });
            const assets = await algorand.getAccountAssets('testaddress', 'assets');
            expect(fetchMock).not.toHaveBeenCalled();
            expect(assets).toEqual({ assets: cachedAssets });
        });
    });
    describe('lookupAssetsOwnedByAccount', () => {
        it('should retrieve the assets owned by an account', async () => {
            const walletAddress = 'valid wallet address';
            const assets = [{ assetId: 1, amount: 100 }];
            fetchMock.mockResponseOnce(JSON.stringify({ assets: assets }));

            const assetsOwnedByAccount = await algorand.lookupAssetsOwnedByAccount(walletAddress);
            expect(assetsOwnedByAccount).toBeDefined();
        });
    });

    describe('getCreatedAssets', () => {
        it('should retrieve the assets created by an account', async () => {
            const walletAddress = 'valid wallet address';
            const assets = [{ assetId: 1, amount: 100 }];
            fetchMock.mockResponseOnce(JSON.stringify({ 'created-assets': assets }));

            const createdAssets = await algorand.getCreatedAssets(walletAddress);
            expect(createdAssets).toBeDefined();
        });
    });
    describe('getTokenOptInStatus', () => {
        test('should return optedIn as true and tokens as asset amount when asset is found', async () => {
            // Arrange
            const walletAddress = 'exampleWalletAddress';
            const optInAssetId = 123;
            const accountAssets = [
                { 'asset-id': 123, amount: 100 },
                { 'asset-id': 456, amount: 200 },
            ];
            fetchMock.mockResponseOnce(JSON.stringify({ assets: accountAssets }));

            // Act
            const result = await algorand.getTokenOptInStatus(walletAddress, optInAssetId);

            // Assert
            expect(result).toEqual({ optedIn: true, tokens: 100 });
            // expect(algorand.getAccountAssets).toHaveBeenCalledWith(walletAddress, 'assets');
        });

        test('should return optedIn as false and tokens as 0 when asset is not found', async () => {
            // Arrange
            const walletAddress = 'exampleWalletAddress';
            const optInAssetId = 123;
            const accountAssets = [
                { 'asset-id': 456, amount: 200 },
                { 'asset-id': 789, amount: 300 },
            ];
            fetchMock.mockResponseOnce(JSON.stringify({ assets: accountAssets }));

            // Act
            const result = await algorand.getTokenOptInStatus(walletAddress, optInAssetId);

            // Assert
            expect(result).toEqual({ optedIn: false, tokens: 0 });
            // expect(algorand.getAccountAssets).toHaveBeenCalledWith(walletAddress, 'assets');
        });

        test('should return optedIn as false and tokens as 0 when account assets is empty', async () => {
            // Arrange
            const walletAddress = 'exampleWalletAddress';
            const optInAssetId = 123;
            const accountAssets: any[] = [];
            fetchMock.mockResponseOnce(JSON.stringify({ assets: accountAssets }));

            // Act
            const result = await algorand.getTokenOptInStatus(walletAddress, optInAssetId);

            // Assert
            expect(result).toEqual({ optedIn: false, tokens: 0 });
            // expect(algorand.getAccountAssets).toHaveBeenCalledWith(walletAddress, 'assets');
        });
    });
    describe('lookupAssetByIndex', () => {
        test('should return asset lookup result', async () => {
            // Arrange
            const index = 123;
            const getAll = true;
            const expectedAssetLookupResult = { assetId: 123, name: 'Asset 123' };
            fetchMock.mockResponseOnce(JSON.stringify(expectedAssetLookupResult));

            // Act
            const result = await algorand.lookupAssetByIndex(index, getAll);

            // Assert
            expect(result).toEqual(expectedAssetLookupResult);
        });

        test('should return asset lookup result with default getAll value', async () => {
            // Arrange
            const index = 123;
            const expectedAssetLookupResult = { assetId: 123, name: 'Asset 123' };
            fetchMock.mockResponseOnce(JSON.stringify(expectedAssetLookupResult));

            // Act
            const result = await algorand.lookupAssetByIndex(index);

            // Assert
            expect(result).toEqual(expectedAssetLookupResult);
        });
    });
    describe('searchTransactions', () => {
        test('should return transaction search results', async () => {
            // Arrange
            const expectedTransactionSearchResults = {
                transactions: [{ id: '123', type: 'payment' }],
            };
            fetchMock.mockResponseOnce(JSON.stringify(expectedTransactionSearchResults));
            // Act
            const result = await algorand.searchTransactions(s => s.assetID('123').txType('acfg'));

            // Assert
            expect(result).toEqual(expectedTransactionSearchResults);
        });
    });
    describe('getAssetArc69Metadata', () => {
        test('should return asset arc69 metadata', async () => {
            const expectedAssetArc69Metadata = {
                ...arc69Example,
                description: 'AlgoDaruma #2 Giveaway!',
            }; // encode the asset arc69 metadata to base64
            const transactions = {
                transactions: [
                    { 'confirmed-round': 123, note: encodeArc69Metadata(arc69Example) },
                    {
                        'confirmed-round': 124,
                        note: encodeArc69Metadata(expectedAssetArc69Metadata),
                    },
                    {},
                    {},
                ],
            };
            fetchMock.mockResponseOnce(JSON.stringify(transactions));
            // Act
            const result = await algorand.getAssetArc69Metadata(123);
            // Assert
            expect(result).toEqual(expectedAssetArc69Metadata);
        });
        test('fetch should return an error', async () => {
            fetchMock.mockRejectOnce(new Error('test error'));
            // Act
            const result = await algorand.getAssetArc69Metadata(123);
            // Assert
            expect(result).toBeUndefined();
        });
    });
    describe('getBulkAssetArc69Metadata', () => {
        test('should return arc69 metadata for all assets', async () => {
            const expectedAssetArc69Metadata = {
                ...arc69Example,
                description: 'AlgoDaruma #2 Giveaway!',
            }; // encode the asset arc69 metadata to base64
            const transactions = {
                transactions: [
                    { 'confirmed-round': 123, note: encodeArc69Metadata(arc69Example) },
                    {
                        'confirmed-round': 124,
                        note: encodeArc69Metadata(expectedAssetArc69Metadata),
                    },
                ],
            };
            fetchMock.mockResponse(JSON.stringify(transactions));
            // Act
            const result = await algorand.getBulkAssetArc69Metadata([123, 124]);
            // Assert
            expect(result).toEqual([
                { id: 123, arc69: expectedAssetArc69Metadata },
                { id: 124, arc69: expectedAssetArc69Metadata },
            ]);
        });
    });

    describe('Algorand Functions that require a database connection', () => {
        let orm: MikroORM;
        let database: EntityManager;
        let wallet: AlgoWallet;
        let stdAsset: AlgoStdAsset;

        beforeAll(async () => {
            orm = await initORM();
            database = orm.em.fork();
        });
        afterAll(async () => {
            await orm.close(true);
        });
        beforeEach(async () => {
            await orm.schema.clearDatabase();
            database = orm.em.fork();
            const creatorWalletAndAssets = await createRandomUserWithWalletAndAsset(database);
            stdAsset = await createRandomASA(database);
            wallet = creatorWalletAndAssets.wallet;
        });
        describe('unclaimedGroupClaim', () => {
            it('should claim all unclaimed tokens for one wallet', async () => {
                // Arrange
                const chunk: Array<[AlgoWallet, number, string]> = [[wallet, 100, 'reason1']];
                algorand.groupClaimToken = jest.fn().mockResolvedValueOnce({ txId: '123' });

                // Act
                await algorand.unclaimedGroupClaim(chunk, stdAsset);
                expect(fetchMock).toHaveBeenCalledTimes(0);

                // Assert
            });
            it('should log an error if the claim failed', async () => {
                // Arrange
                const chunk: Array<[AlgoWallet, number, string]> = [[wallet, 100, 'reason1']];
                algorand.groupClaimToken = jest.fn().mockResolvedValueOnce({});

                // Act
                await algorand.unclaimedGroupClaim(chunk, stdAsset);
                expect(fetchMock).toHaveBeenCalledTimes(0);

                // Assert
            });

            it('should log an error if the claim fails', async () => {
                // Arrange
                const chunk: Array<[AlgoWallet, number, string]> = [[wallet, 100, 'reason1']];
                algorand.groupClaimToken = jest.fn().mockRejectedValueOnce(new Error('test error'));

                // Act
                await algorand.unclaimedGroupClaim(chunk, stdAsset);
                expect(fetchMock).toHaveBeenCalledTimes(0);

                // Assert
            });
        });
    });
});
