/* eslint-disable @typescript-eslint/unbound-method */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as algokit from '@algorandfoundation/algokit-utils';
import { AlgoConfig } from '@algorandfoundation/algokit-utils/types/network-client';
import { generateAccount, secretKeyToMnemonic, Transaction } from 'algosdk';
import { FetchMock } from 'jest-fetch-mock';
import { spy, verify } from 'ts-mockito';
import { Logger } from 'winston';

import { environmentResetFixture } from '../../tests/fixtures/environment-fixture.js';
import { arc69Example, transactionParameters } from '../../tests/mocks/mock-algorand-functions.js';
import { mockCustomCache } from '../../tests/mocks/mock-custom-cache.js';
import { getConfig } from '../config/config.js';
import {
  AlgorandTransaction,
  AssetHolding,
  AssetType,
  LookupAssetBalancesResponse,
  MiniAssetHolding,
} from '../types/algorand.js';
import { WalletAddress } from '../types/core.js';
import logger from '../utils/functions/logger-factory.js';

import { Algorand } from './algorand.js';

jest.mock('algosdk', () => {
  const originalModule = jest.requireActual('algosdk');
  return {
    ...originalModule,
    waitForConfirmation: jest.fn(),
  };
});

const config = getConfig();
function encodeArc69Metadata(metadata: any): string {
  return Buffer.from(JSON.stringify(metadata), 'utf8').toString('base64');
}

const mockedWalletAddress = 'test' as WalletAddress;
describe('Algorand service tests', () => {
  environmentResetFixture();

  const algoKitLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };
  algokit.Config.configure({ logger: algoKitLogger });
  let loggerErrorSpy: jest.SpyInstance<Logger, [infoObject: object], any>;
  let loggerInfoSpy: jest.SpyInstance<Logger, [infoObject: object], any>;

  const mockFetch = fetch as FetchMock;
  const clawbackAccount = generateAccount();
  const claimTokenAccount = generateAccount();
  const testAccount = generateAccount();
  const testAccount2 = generateAccount();
  const clawbackMnemonic = secretKeyToMnemonic(clawbackAccount.sk);
  const claimTokenMnemonic = secretKeyToMnemonic(claimTokenAccount.sk);
  let algorand: Algorand;

  beforeEach(() => {
    algorand = new Algorand(mockCustomCache);

    loggerErrorSpy = jest.spyOn(logger, 'error');
    loggerInfoSpy = jest.spyOn(logger, 'info');
    mockFetch.resetMocks();
  });
  afterEach(() => {
    loggerErrorSpy.mockClear();
    loggerInfoSpy.mockClear();
  });
  describe('create a new instance of the algorand service', () => {
    test('should create a new instance of the algorand service', () => {
      const newAlgorand = new Algorand(mockCustomCache);
      expect(newAlgorand).toBeDefined();
    });
  });
  describe('setupClients', () => {
    test('should setup the clients with defaults', () => {
      const newAlgorand = new Algorand(mockCustomCache);
      newAlgorand.setupClients();
      expect(newAlgorand.algodClient).toBeDefined();
      expect(newAlgorand.indexerClient).toBeDefined();
    });
    test('should setup the clients with the algodClient and indexerClient', () => {
      const newAlgorand = new Algorand(mockCustomCache);
      const algoConfig = {
        algodConfig: {
          server: 'http://test.com',
          port: 123,
          token: 'test',
        },
        indexerConfig: {
          server: 'http://test.com',
          port: 123,
          token: 'test',
        },
      } as unknown as AlgoConfig;
      newAlgorand.setupClients(algoConfig);
      expect(newAlgorand.algodClient).toBeDefined();
      expect(newAlgorand.indexerClient).toBeDefined();
    });
    test('should use algonode when in production', () => {
      const newAlgorand = new Algorand(mockCustomCache);
      const before = config.get('nodeEnv');
      config.set('nodeEnv', 'production');
      newAlgorand.setupClients();
      expect(newAlgorand.algodClient).toBeDefined();
      expect(newAlgorand.indexerClient).toBeDefined();
      config.set('nodeEnv', before);
    });
  });
  describe('noteToArc69Payload', () => {
    test('should return undefined if note is null or undefined', () => {
      let arc69 = algorand.noteToArc69Payload(null);
      expect(arc69).toBeUndefined();
      arc69 = algorand.noteToArc69Payload();
      expect(arc69).toBeUndefined();
    });
    test('should convert note to arc69 payload', () => {
      const assetNote = {
        note: encodeArc69Metadata(arc69Example),
      };
      const arc69 = algorand.noteToArc69Payload(assetNote.note);
      expect(arc69).toEqual(arc69Example);
    });
    test('should return undefined if note is not a valid arc69 payload', () => {
      const encoded: string = Buffer.from('test string', 'utf8').toString('base64');
      const arc69 = algorand.noteToArc69Payload(encoded);
      expect(arc69).toBeUndefined();
    });
  });
  describe('initAccounts', () => {
    test('should initialize the accounts', async () => {
      const spyService = spy(algorand);
      process.env['CLAWBACK_TOKEN_MNEMONIC'] = clawbackMnemonic;
      process.env['CLAIM_TOKEN_MNEMONIC'] = claimTokenMnemonic;
      const result = await algorand.initAccounts();
      expect(result).toBeUndefined();
      expect(algorand.claimTokenAccount).toStrictEqual(claimTokenAccount);
      expect(algorand.clawbackAccount).toStrictEqual(clawbackAccount);
      await algorand.initAccounts();
      verify(spyService.getMnemonicAccounts()).once();
    });
    test('should throw an error because the clawback token is not set', async () => {
      expect.assertions(1);
      process.env['CLAIM_TOKEN_MNEMONIC'] = claimTokenMnemonic;
      process.env['CLAWBACK_TOKEN_MNEMONIC'] = '';
      await expect(() => algorand.initAccounts()).rejects.toThrow('Clawback Token not set');
    });
    test('algorand claimToken get fails', () => {
      expect(() => algorand.claimTokenAccount).toThrow('Claim Token Account not set');
    });
    test('algorand clawbackToken get fails', () => {
      expect(() => algorand.clawbackAccount).toThrow('Clawback Account not set');
    });
  });
  describe('getMnemonicAccounts', () => {
    beforeEach(() => {
      fetchMock.mockResponseOnce(JSON.stringify({}));
      fetchMock.mockResponseOnce(JSON.stringify({}));
    });
    describe('getMnemonicAccounts', () => {
      test('should throw an error because both mnemonics are not set', async () => {
        process.env['CLAIM_TOKEN_MNEMONIC'] = '';
        process.env['CLAWBACK_TOKEN_MNEMONIC'] = '';
        expect.assertions(1);
        await expect(() => algorand.getMnemonicAccounts()).rejects.toThrow(
          'Clawback Token not set',
        );
      });
      test('should not throw an error because the claim token is invalid', async () => {
        expect.assertions(2);
        process.env['CLAWBACK_TOKEN_MNEMONIC'] = clawbackMnemonic;
        process.env['CLAIM_TOKEN_MNEMONIC'] = 'test';
        const result = await algorand.getMnemonicAccounts();
        expect(result.clawback).toStrictEqual(clawbackAccount);
        expect(result.token).toStrictEqual(clawbackAccount);
      });
      test('should throw an error because the clawback token is invalid', async () => {
        expect.assertions(1);
        process.env['CLAIM_TOKEN_MNEMONIC'] = clawbackMnemonic;
        process.env['CLAWBACK_TOKEN_MNEMONIC'] = 'test';
        await expect(() => algorand.getMnemonicAccounts()).rejects.toThrow(
          'Clawback Token not set',
        );
      });
    });

    test('should return the clawback account because the claim account is not set', async () => {
      process.env['CLAWBACK_TOKEN_MNEMONIC'] = clawbackMnemonic;
      const accounts = await algorand.getMnemonicAccounts();
      expect(accounts.clawback).toStrictEqual(clawbackAccount);
      expect(accounts.token).toStrictEqual(clawbackAccount);
    });
    test('should return the individual accounts', async () => {
      process.env['CLAIM_TOKEN_MNEMONIC'] = claimTokenMnemonic;

      process.env['CLAWBACK_TOKEN_MNEMONIC'] = clawbackMnemonic;
      const accounts = await algorand.getMnemonicAccounts();
      expect(accounts.clawback).toStrictEqual(clawbackAccount);
      expect(accounts.token).toStrictEqual(claimTokenAccount);
    });
    test('should return the same account for both', async () => {
      process.env['CLAIM_TOKEN_MNEMONIC'] = clawbackMnemonic;
      process.env['CLAWBACK_TOKEN_MNEMONIC'] = clawbackMnemonic;
      const accounts = await algorand.getMnemonicAccounts();
      expect(accounts.clawback).toStrictEqual(clawbackAccount);
      expect(accounts.token).toStrictEqual(clawbackAccount);
    });
  });
  describe('getAccountAssets', () => {
    test('should return an empty array if there are no asset holdings', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ assets: [] }));
      const assets = await algorand.getAccountAssets(mockedWalletAddress, AssetType.Assets);
      expect(assets).toEqual([]);
    });

    test('should return an empty array if there are no created assets', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ 'created-assets': [] }));
      const assets = await algorand.getAccountAssets(mockedWalletAddress, AssetType.CreatedAssets);
      expect(assets).toEqual([]);
    });

    test('should return cached asset holdings if they exist', async () => {
      const cachedAssets = [{ assetId: 1, amount: 100 }];
      mockCustomCache.get = jest.fn().mockReturnValueOnce({ assets: cachedAssets });
      const assets = await algorand.getAccountAssets(mockedWalletAddress, AssetType.Assets);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(assets).toEqual(cachedAssets);
    });
  });
  describe('getHeldAssetFromAccount', () => {
    it('should get asset holdings for a given wallet address and asset index', async () => {
      const assetIndex = 123;
      const expectedAssetHolding = { amount: 1000 }; // Update with your actual AssetHolding structure

      // Mock the fetch response
      fetchMock.mockResponseOnce(JSON.stringify({ 'asset-holding': expectedAssetHolding }));

      const result = await algorand.getHeldAssetFromAccount(mockedWalletAddress, assetIndex);

      expect(result).toEqual(expectedAssetHolding);
    });
    it('should throw a 404 error if the asset is not found', async () => {
      const assetIndex = 123;

      // Mock the fetch response
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 404 });
      const result = await algorand.getHeldAssetFromAccount(mockedWalletAddress, assetIndex);

      expect(result).toBeUndefined();
      expect(loggerErrorSpy).toHaveBeenCalledTimes(0);
    });
    it('should throw a 503 error and not return anything', async () => {
      jest.spyOn(global, 'setTimeout').mockImplementation((callback, _delay) => {
        callback();
        return {} as any;
      });

      const assetIndex = 123;
      // Mock the fetch response
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 503 });
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 503 });
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 503 });
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 503 });
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: 503 });

      const result = await algorand.getHeldAssetFromAccount(mockedWalletAddress, assetIndex);
      expect(result).toBeUndefined();
      expect(loggerErrorSpy).toHaveBeenCalledTimes(2);
      expect(algoKitLogger.warn).toHaveBeenCalledTimes(4);
      jest.spyOn(global, 'setTimeout').mockRestore();
    });
  });
  describe('lookupAssetsOwnedByAccount', () => {
    test('should retrieve the assets owned by an account', async () => {
      const assets = [{ assetId: 1, amount: 100 }];
      fetchMock.mockResponseOnce(JSON.stringify({ assets: assets }));

      const assetsOwnedByAccount = await algorand.lookupAssetsOwnedByAccount(mockedWalletAddress);
      expect(assetsOwnedByAccount).toBeDefined();
    });
  });

  describe('getCreatedAssets', () => {
    test('should retrieve the assets created by an account', async () => {
      const assets = [{ assetId: 1, amount: 100 }];
      fetchMock.mockResponseOnce(JSON.stringify({ 'created-assets': assets }));

      const createdAssets = await algorand.getCreatedAssets(mockedWalletAddress);
      expect(createdAssets).toBeDefined();
    });
  });
  describe('getTokenOptInStatus', () => {
    const optInAssetId = 123;

    test('should return optedIn as true and tokens as asset amount when asset is found', async () => {
      const accountAssets: AssetHolding = {
        'asset-id': 123,
        amount: 100,
        'is-frozen': false,
      };

      // Arrange
      fetchMock.mockResponseOnce(JSON.stringify({ 'asset-holding': accountAssets }));

      // Act
      const result = await algorand.getTokenOptInStatus(mockedWalletAddress, optInAssetId);

      // Assert
      expect(result).toEqual({ optedIn: true, tokens: 100 });
      // expect(algorand.getAccountAssets).toHaveBeenCalledWith(mockedWalletAddress, 'assets');
    });

    test('should return optedIn as false and tokens as 0 when asset is not found', async () => {
      // Arrange
      const accountAssets = {};
      fetchMock.mockResponseOnce(JSON.stringify({ assets: accountAssets }));

      // Act
      const result = await algorand.getTokenOptInStatus(mockedWalletAddress, optInAssetId);

      // Assert
      expect(result).toEqual({ optedIn: false, tokens: 0 });
      // expect(algorand.getAccountAssets).toHaveBeenCalledWith(mockedWalletAddress, 'assets');
    });

    test('should return optedIn as false and tokens as 0 when account assets is empty', async () => {
      // Arrange
      const accountAssets: any[] = [];
      fetchMock.mockResponseOnce(JSON.stringify({ assets: accountAssets }));

      // Act
      const result = await algorand.getTokenOptInStatus(mockedWalletAddress, optInAssetId);

      // Assert
      expect(result).toEqual({ optedIn: false, tokens: 0 });
      // expect(algorand.getAccountAssets).toHaveBeenCalledWith(mockedWalletAddress, 'assets');
    });
  });
  describe('lookupAssetBalances', () => {
    const assetIndex = 123;
    const expectedAssetBalances: LookupAssetBalancesResponse = {
      balances: [{ address: 'test', amount: 1000, 'is-frozen': false }],
      'current-round': 123,
    }; // Update with your actual AssetBalances structure
    const expectedResponse: MiniAssetHolding[] = [
      {
        address: 'test',
        amount: 1000,
        'is-frozen': false,
      },
    ];
    test('should return asset balances', async () => {
      // Arrange
      fetchMock.mockResponseOnce(JSON.stringify(expectedAssetBalances));

      // Act
      const result = await algorand.lookupAssetBalances(assetIndex);

      // Assert
      expect(result).toEqual(expectedResponse);
    });
    test('should return a empty array if the asset is not found', async () => {
      // Arrange
      fetchMock.mockResponseOnce(
        JSON.stringify({
          balances: [],
          'current-round': 33_781_467,
        }),
        { status: 200 },
      );

      // Act
      const result = await algorand.lookupAssetBalances(assetIndex);

      // Assert
      expect(result).toEqual([]);
    });
    test('should return an empty array when the asset balance is undefined', async () => {
      // Arrange
      fetchMock.mockResponseOnce(
        JSON.stringify({
          balances: undefined,
          'current-round': 33_781_467,
        }),
        { status: 200 },
      );

      // Act
      const result = await algorand.lookupAssetBalances(assetIndex);

      // Assert
      expect(result).toEqual([]);
    });
    test('should return multiple assets when there is a next-token', async () => {
      // Arrange
      const expectedAssetBalancesWithNextToken = {
        ...expectedAssetBalances,
        'next-token': 'test',
      };
      const doubleExpectedResponse = [...expectedResponse, ...expectedResponse];
      fetchMock.mockResponseOnce(JSON.stringify(expectedAssetBalancesWithNextToken));
      fetchMock.mockResponseOnce(JSON.stringify(expectedAssetBalances));

      // Act
      const result = await algorand.lookupAssetBalances(assetIndex);

      // Assert
      expect(result).toEqual(doubleExpectedResponse);
    });
  });
  describe('lookupAssetByIndex', () => {
    const index = 123;
    const expectedAssetLookupResult = { assetId: 123, name: 'Asset 123' };

    test('should return asset lookup result', async () => {
      // Arrange
      const getAll = true;
      fetchMock.mockResponseOnce(JSON.stringify(expectedAssetLookupResult));

      // Act
      const result = await algorand.lookupAssetByIndex(index, getAll);

      // Assert
      expect(result).toEqual(expectedAssetLookupResult);
    });

    test('should return asset lookup result with default getAll value', async () => {
      // Arrange
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
        transactions: [{ id: 123, type: 'payment' }],
      };
      fetchMock.mockResponseOnce(JSON.stringify(expectedTransactionSearchResults));
      // Act
      const result = await algorand.searchTransactions((s) => s.assetID(123).txType('acfg'));

      // Assert
      expect(result).toEqual(expectedTransactionSearchResults);
    });
  });
  describe('arc69 utilities', () => {
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

    describe('getAssetArc69Metadata', () => {
      test('should return asset arc69 metadata', async () => {
        fetchMock.mockResponseOnce(JSON.stringify(transactions));
        // Act
        const result = await algorand.getAssetArc69Metadata(123);
        // Assert
        expect(result).toEqual(expectedAssetArc69Metadata);
      });
      test('should return undefined if there is no note', async () => {
        fetchMock.mockResponseOnce(JSON.stringify({ transactions: [{}, {}] }));
        // Act
        const result = await algorand.getAssetArc69Metadata(123);
        // Assert
        expect(result).toBeUndefined();
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
        fetchMock.mockResponse(JSON.stringify(transactions));
        // Act
        const result = await algorand.getBulkAssetArc69Metadata([123, 124]);
        // Assert
        expect(result).toEqual([
          { id: 123, arc69: expectedAssetArc69Metadata },
          { id: 124, arc69: expectedAssetArc69Metadata },
        ]);
      });
      test('should return . when no assets are found', async () => {
        fetchMock.mockResponse(JSON.stringify({ transactions: [] }));
        // Act
        const result = await algorand.getBulkAssetArc69Metadata([123, 124]);
        // Assert
        expect(result).toEqual([]);
      });
    });
  });
  describe('checkSenderBalance', () => {
    const optInAssetId = 123;
    const accountAssets: AssetHolding = {
      'asset-id': 123,
      amount: 100,
      'is-frozen': false,
    };

    test('should return the senders balance', async () => {
      // Arrange
      fetchMock.mockResponseOnce(JSON.stringify({ 'asset-holding': accountAssets }));

      // Act
      const result = await algorand.checkSenderBalance(mockedWalletAddress, optInAssetId, 10);

      // Assert
      expect(result).toBe(100);
    });
    test('should throw an error if the sender does not have enough balance', async () => {
      // Arrange
      fetchMock.mockResponseOnce(JSON.stringify({ 'asset-holding': accountAssets }));

      // Act & Assert
      await expect(
        algorand.checkSenderBalance(mockedWalletAddress, optInAssetId, 2000),
      ).rejects.toHaveProperty('message', 'Insufficient Funds to cover transaction');
    });
  });
  describe('getSuggestedParameters', () => {
    const mockReturn = {
      'consensus-version':
        'https://github.com/algorandfoundation/specs/tree/abd3d4823c6f77349fc04c3af7b1e99fe4df699f',
      fee: 0,
      'genesis-hash': 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
      'genesis-id': 'mainnet-v1.0',
      'last-round': 33_035_753,
      'min-fee': 1000,
    };
    test('should return the suggested parameters', async () => {
      // Arrange
      fetchMock.mockResponseOnce(JSON.stringify(mockReturn));

      // Act
      const result = await algorand.getSuggestedParameters();

      // Assert
      expect(result).toEqual(transactionParameters);
    });
  });
  describe('should test the asset transfer functions', () => {
    beforeEach(() => {
      process.env['CLAWBACK_TOKEN_MNEMONIC'] = clawbackMnemonic;
    });
    describe('claimErrorProcessor', () => {
      test('should return the error message', () => {
        // Arrange
        const error = 'test error';
        // Act
        const result = algorand.claimErrorProcessor(new Error('test'), error);
        // Assert
        expect(result).toEqual({ error: `${error}: test` });
      });
      test('should only return the message', () => {
        // Arrange
        const error = 'test error';
        // Act
        const result = algorand.claimErrorProcessor(undefined, error);
        // Assert
        expect(result).toEqual({ error });
      });
    });
    describe('transferOptionsProcessor', () => {
      describe('check the sender balance', () => {
        test('succeed', async () => {
          // Arrange
          jest
            .spyOn(algorand, 'getTokenOptInStatus')
            .mockResolvedValueOnce({ tokens: 1000, optedIn: true });

          await algorand.initAccounts();
          algorand.getSuggestedParameters = jest.fn().mockResolvedValueOnce(transactionParameters);
          fetchMock.mockResponseOnce(JSON.stringify({ txId: '123' }));
          fetchMock.mockResponseOnce(JSON.stringify({ txId: '123' }));

          // Act
          const result = await algorand.transferOptionsProcessor({
            assetIndex: 123,
            amount: 100,
            receiverAddress: testAccount.addr,
            senderAddress: testAccount2.addr,
          });
          // Assert
          expect(mockFetch).toHaveBeenCalledTimes(2);
          expect(result).toEqual({ txId: '123' });
        });
        test('fail', async () => {
          // Arrange
          jest
            .spyOn(algorand, 'getTokenOptInStatus')
            .mockResolvedValueOnce({ tokens: 10, optedIn: true });
          algorand.getSuggestedParameters = jest.fn().mockResolvedValueOnce(transactionParameters);
          fetchMock.mockResponseOnce(JSON.stringify({ txId: '123' }));
          // Act
          const result = await algorand.transferOptionsProcessor({
            assetIndex: 123,
            amount: 100,
            receiverAddress: testAccount.addr,
            senderAddress: testAccount2.addr,
          });
          // Assert
          expect(mockFetch).toHaveBeenCalledTimes(0);
          expect(result).toEqual({
            error: 'Failed the Token transfer: Insufficient Funds to cover transaction',
          });
        });
      });
      test('should fail with a downstream error when the wallet is malformed', async () => {
        // Arrange
        await algorand.initAccounts();
        algorand.getSuggestedParameters = jest.fn().mockResolvedValueOnce(transactionParameters);
        fetchMock.mockResponseOnce(JSON.stringify({ txId: '123' }));
        fetchMock.mockResponseOnce(JSON.stringify({ txId: '123' }));
        // Act
        const result = await algorand.transferOptionsProcessor({
          assetIndex: 123,
          amount: 100,
          receiverAddress: 'failed address',
        });
        // Assert
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
          error: 'Failed the Token transfer: address seems to be malformed',
        });
      });
    });
    describe('transaction functions', () => {
      let spySingleTransfer: jest.SpyInstance<Transaction, [options: AlgorandTransaction], any>;
      beforeEach(() => {
        spySingleTransfer = jest.spyOn(algorand, 'makeSingleAssetTransferTransaction');
      });
      afterEach(() => {
        spySingleTransfer.mockClear();
      });

      describe('claimToken', () => {
        const assetIndex = 123;
        const amount = 100;
        const expectedTokenResponse = { txId: '123' };

        test('should return the claim token ClaimTokenResponse', async () => {
          // Arrange
          await algorand.initAccounts();
          algorand.getSuggestedParameters = jest.fn().mockResolvedValueOnce(transactionParameters);
          fetchMock.mockResponseOnce(JSON.stringify(expectedTokenResponse));
          fetchMock.mockResponseOnce(JSON.stringify(expectedTokenResponse));
          // Act
          const result = await algorand.claimToken({
            assetIndex,
            amount,
            receiverAddress: testAccount.addr,
          });
          // Assert
          expect(mockFetch).toHaveBeenCalledTimes(2);
          expect(result).toEqual(expectedTokenResponse);
          expect(spySingleTransfer).toHaveBeenCalledWith({
            assetIndex,
            amount,
            to: testAccount.addr,
            from: clawbackAccount.addr,
            suggestedParams: transactionParameters,
          });
        });
      });

      describe('tipToken', () => {
        const assetIndex = 123;
        const amount = 100;
        const expectedTokenResponse = { txId: '123' };
        beforeEach(() => {
          algorand.checkSenderBalance = jest.fn().mockResolvedValueOnce(1000);
        });
        test('should return the transaction id', async () => {
          // Arrange
          await algorand.initAccounts();
          algorand.getSuggestedParameters = jest.fn().mockResolvedValueOnce(transactionParameters);
          fetchMock.mockResponseOnce(JSON.stringify(expectedTokenResponse));
          fetchMock.mockResponseOnce(JSON.stringify(expectedTokenResponse));
          // Act
          const result = await algorand.tipToken({
            assetIndex,
            amount,
            receiverAddress: testAccount.addr,
            senderAddress: testAccount2.addr,
          });
          // Assert
          expect(mockFetch).toHaveBeenCalledTimes(2);
          expect(result).toEqual(expectedTokenResponse);
          expect(spySingleTransfer).toHaveBeenCalledWith({
            assetIndex,
            amount,
            to: testAccount.addr,
            from: clawbackAccount.addr,
            revocationTarget: testAccount2.addr,
            suggestedParams: transactionParameters,
          });
        });
      });
      describe('purchaseItem', () => {
        const assetIndex = 123;
        const amount = 100;
        const expectedTokenResponse = { txId: '123' };
        beforeEach(() => {
          algorand.checkSenderBalance = jest.fn().mockResolvedValueOnce(1000);
        });
        test('should return the transaction id', async () => {
          // Arrange
          await algorand.initAccounts();

          const spySingleTransfer = jest.spyOn(algorand, 'makeSingleAssetTransferTransaction');
          algorand.getSuggestedParameters = jest.fn().mockResolvedValueOnce(transactionParameters);
          fetchMock.mockResponseOnce(JSON.stringify(expectedTokenResponse));
          fetchMock.mockResponseOnce(JSON.stringify(expectedTokenResponse));
          // Act
          const result = await algorand.purchaseItem({
            assetIndex,
            amount,
            senderAddress: testAccount.addr,
          });
          // Assert
          expect(mockFetch).toHaveBeenCalledTimes(2);
          expect(result).toEqual(expectedTokenResponse);
          expect(spySingleTransfer).toHaveBeenCalledWith({
            assetIndex,
            amount,
            to: clawbackAccount.addr,
            from: clawbackAccount.addr,
            revocationTarget: testAccount.addr,
            suggestedParams: transactionParameters,
          });
        });
      });
    });
  });
});
