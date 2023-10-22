/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { faker } from '@faker-js/faker';
import { AtomicTransactionComposer, generateAccount, secretKeyToMnemonic } from 'algosdk';
import { FetchMock } from 'jest-fetch-mock';
import { chunk } from 'lodash';
import { anything, instance, mock, verify, when } from 'ts-mockito';

import { getConfig } from '../../src/config/config.js';
import { UnclaimedAsset, WalletWithUnclaimedAssets } from '../../src/model/types/algorand.js';
import { AlgorandRepository } from '../../src/repositories/algorand-repository.js';
import { Algorand } from '../../src/services/algorand.js';
import logger from '../../src/utils/functions/logger-factory.js';
import { transactionParameters } from '../mocks/mock-algorand-functions.js';
import { mockCustomCache } from '../mocks/mock-custom-cache.js';
import { initORMBasic } from '../utils/bootstrap.js';
const chunkArray = chunk;
jest.mock('algosdk', () => {
  const originalModule = jest.requireActual('algosdk');
  return {
    ...originalModule,
    waitForConfirmation: jest.fn(),
  };
});
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
  let loggerErrorSpy;
  let loggerInfoSpy;

  const mockFetch = fetch as FetchMock;
  const clawbackAccount = generateAccount();
  const claimTokenAccount = generateAccount();
  const testAccount = generateAccount();
  const testAccount2 = generateAccount();
  const clawbackMnemonic = secretKeyToMnemonic(clawbackAccount.sk);
  const claimTokenMnemonic = secretKeyToMnemonic(claimTokenAccount.sk);
  let algorand: Algorand;
  let mockAlgoRepo: AlgorandRepository;

  beforeAll(() => {
    initORMBasic();
    config.set('clawbackTokenMnemonic', 'test');
    mockAlgoRepo = mock(AlgorandRepository);
    algorand = new Algorand(instance(mockAlgoRepo));
    when(
      mockAlgoRepo.removeUnclaimedTokensFromMultipleWallets(anything(), anything()),
    ).thenResolve();
  });
  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(logger, 'error');
    loggerInfoSpy = jest.spyOn(logger, 'info');
    mockFetch.resetMocks();
  });
  afterEach(() => {
    config.set('clawbackTokenMnemonic', '');
    config.set('claimTokenMnemonic', '');
    loggerErrorSpy.mockClear();
    loggerInfoSpy.mockClear();
  });
  describe('create a new instance of the algorand service', () => {
    test('should create a new instance of the algorand service', () => {
      const newAlgorand = new Algorand();
      expect(newAlgorand).toBeDefined();
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
  describe('validateWalletAddress / generateWalletAccount', () => {
    test('should return false because the wallet is invalid', () => {
      const valid = algorand.validateWalletAddress('test');
      expect(valid).toBeFalsy();
    });
    test('should create a fake wallet return true because the wallet is valid', () => {
      const validWallet = algorand.generateWalletAccount();
      const valid = algorand.validateWalletAddress(validWallet);
      expect(valid).toBeTruthy();
    });
  });
  describe('getAccountFromMnemonic', () => {
    test('should return undefined if the string is not valid', () => {
      const account = algorand.getAccountFromMnemonic(' ');
      expect(account).toBeUndefined();
    });
    test('should return undefined if the mnemonic is invalid', () => {
      const acct = algorand.getAccountFromMnemonic('test');
      expect(acct).toBeUndefined();
    });
    test('should return undefined if the mnemonic is not a string', () => {
      const acct = algorand.getAccountFromMnemonic(1 as unknown as string);
      expect(acct).toBeUndefined();
    });
    test('should return an account if the mnemonic is valid', () => {
      const account = algorand.getAccountFromMnemonic(clawbackMnemonic);
      expect(account).toHaveProperty('addr', clawbackAccount.addr);
    });
    test('should clean up the mnemonic before returning the account', () => {
      // replaced spaced with commas
      let modifiedMnemonic = clawbackMnemonic.replaceAll(' ', ',');
      let checkedAcct = algorand.getAccountFromMnemonic(modifiedMnemonic);
      expect(checkedAcct).toHaveProperty('addr', clawbackAccount.addr);
      // replace one space with two spaces in mnemonic
      modifiedMnemonic = clawbackMnemonic.replaceAll(' ', '  ');
      checkedAcct = algorand.getAccountFromMnemonic(modifiedMnemonic);
      expect(checkedAcct).toHaveProperty('addr', clawbackAccount.addr);
    });
  });
  describe('getMnemonicAccounts', () => {
    test('should throw an error if either mnemonic is invalid', () => {
      expect.assertions(3);
      try {
        algorand.getMnemonicAccounts();
      } catch (error) {
        expect(error).toHaveProperty('message', 'Failed to get accounts from mnemonics');
      }

      config.set('clawbackTokenMnemonic', clawbackMnemonic);
      config.set('claimTokenMnemonic', 'test');
      try {
        algorand.getMnemonicAccounts();
      } catch (error) {
        expect(error).toHaveProperty('message', 'Failed to get accounts from mnemonics');
      }
      config.set('claimTokenMnemonic', clawbackMnemonic);
      config.set('clawbackTokenMnemonic', 'test');

      try {
        algorand.getMnemonicAccounts();
      } catch (error) {
        expect(error).toHaveProperty('message', 'Failed to get accounts from mnemonics');
      }
    });
    test('should return the clawback account because the claim account is not set', () => {
      config.set('clawbackTokenMnemonic', clawbackMnemonic);
      const accounts = algorand.getMnemonicAccounts();
      expect(accounts.clawback).toStrictEqual(clawbackAccount);
      expect(accounts.token).toStrictEqual(clawbackAccount);
    });
    test('should return the individual accounts', () => {
      config.set('claimTokenMnemonic', claimTokenMnemonic);

      config.set('clawbackTokenMnemonic', clawbackMnemonic);
      const accounts = algorand.getMnemonicAccounts();
      expect(accounts.clawback).toStrictEqual(clawbackAccount);
      expect(accounts.token).toStrictEqual(claimTokenAccount);
    });
    test('should return the same account for both', () => {
      config.set('claimTokenMnemonic', clawbackMnemonic);
      config.set('clawbackTokenMnemonic', clawbackMnemonic);
      const accounts = algorand.getMnemonicAccounts();
      expect(accounts.clawback).toStrictEqual(clawbackAccount);
      expect(accounts.token).toStrictEqual(clawbackAccount);
    });
  });
  describe('getAccountAssets', () => {
    test('should return an empty array if there are no asset holdings', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ assets: [] }));
      const assets = await algorand.getAccountAssets('test-address', 'assets');
      expect(assets).toEqual([]);
    });

    test('should return an empty array if there are no created assets', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ 'created-assets': [] }));
      const assets = await algorand.getAccountAssets('test-address', 'created-assets');
      expect(assets).toEqual([]);
    });

    test('should return cached asset holdings if they exist', async () => {
      const cachedAssets = [{ assetId: 1, amount: 100 }];
      mockCustomCache.get = jest.fn().mockReturnValueOnce({ assets: cachedAssets });
      const assets = await algorand.getAccountAssets('testaddress', 'assets');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(assets).toEqual({ assets: cachedAssets });
    });
  });
  describe('lookupAssetsOwnedByAccount', () => {
    test('should retrieve the assets owned by an account', async () => {
      const walletAddress = 'valid wallet address';
      const assets = [{ assetId: 1, amount: 100 }];
      fetchMock.mockResponseOnce(JSON.stringify({ assets: assets }));

      const assetsOwnedByAccount = await algorand.lookupAssetsOwnedByAccount(walletAddress);
      expect(assetsOwnedByAccount).toBeDefined();
    });
  });

  describe('getCreatedAssets', () => {
    test('should retrieve the assets created by an account', async () => {
      const walletAddress = 'valid wallet address';
      const assets = [{ assetId: 1, amount: 100 }];
      fetchMock.mockResponseOnce(JSON.stringify({ 'created-assets': assets }));

      const createdAssets = await algorand.getCreatedAssets(walletAddress);
      expect(createdAssets).toBeDefined();
    });
  });
  describe('getTokenOptInStatus', () => {
    const walletAddress = 'exampleWalletAddress';
    const optInAssetId = 123;

    test('should return optedIn as true and tokens as asset amount when asset is found', async () => {
      const accountAssets = [
        { 'asset-id': 123, amount: 100 },
        { 'asset-id': 456, amount: 200 },
      ];

      // Arrange
      fetchMock.mockResponseOnce(JSON.stringify({ assets: accountAssets }));

      // Act
      const result = await algorand.getTokenOptInStatus(walletAddress, optInAssetId);

      // Assert
      expect(result).toEqual({ optedIn: true, tokens: 100 });
      // expect(algorand.getAccountAssets).toHaveBeenCalledWith(walletAddress, 'assets');
    });

    test('should return optedIn as false and tokens as 0 when asset is not found', async () => {
      // Arrange
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
        transactions: [{ id: '123', type: 'payment' }],
      };
      fetchMock.mockResponseOnce(JSON.stringify(expectedTransactionSearchResults));
      // Act
      const result = await algorand.searchTransactions((s) => s.assetID('123').txType('acfg'));

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
    });
  });
  describe('Algorand Functions for asset claiming', () => {
    let walletAddress: string;
    let userId: string;
    let unclaimedAsset: UnclaimedAsset;
    let chunk: WalletWithUnclaimedAssets[];
    let walletWithUnclaimedAssets: WalletWithUnclaimedAssets;
    const amount = 100;

    beforeEach(() => {
      unclaimedAsset = { id: faker.number.int(), name: faker.lorem.word() };
      walletAddress = faker.lorem.word();
      userId = faker.person.firstName();
      walletWithUnclaimedAssets = {
        walletAddress,
        unclaimedTokens: amount,
        userId,
      };
      chunk = [walletWithUnclaimedAssets];
    });
    describe('batch and unclaimed groups', () => {
      describe('unclaimedAutomated', () => {
        let claimTokenMock;
        let batchTransActionProcessorMock;
        beforeEach(() => {
          claimTokenMock = jest.spyOn(algorand, 'claimToken');
          batchTransActionProcessorMock = jest.spyOn(algorand, 'batchTransActionProcessor');
        });
        afterEach(() => {
          claimTokenMock.mockClear();
          batchTransActionProcessorMock.mockClear();
        });
        test('should process one wallet', async () => {
          // Arrange
          when(mockAlgoRepo.fetchWalletsWithUnclaimedAssets(anything(), anything())).thenResolve([
            walletWithUnclaimedAssets,
          ]);
          // Act
          await algorand.unclaimedAutomated(1, unclaimedAsset);
          // Assert
          expect(claimTokenMock).toHaveBeenCalledTimes(1);
          expect(batchTransActionProcessorMock).toHaveBeenCalledTimes(0);
        });
        test('should process two wallets', async () => {
          // Arrange
          when(mockAlgoRepo.fetchWalletsWithUnclaimedAssets(anything(), anything())).thenResolve([
            walletWithUnclaimedAssets,
            walletWithUnclaimedAssets,
          ]);
          // Act
          await algorand.unclaimedAutomated(1, unclaimedAsset);
          // Assert
          expect(claimTokenMock).toHaveBeenCalledTimes(0);
          expect(batchTransActionProcessorMock).toHaveBeenCalledTimes(1);
        });
      });
      describe('batchTransActionProcessor', () => {
        let mockedUnclaimedGroupClaim;
        beforeEach(() => {
          mockedUnclaimedGroupClaim = jest
            .spyOn(algorand, 'unclaimedGroupClaim')
            .mockResolvedValueOnce();
        });
        afterEach(() => {
          mockedUnclaimedGroupClaim.mockClear();
        });
        test('should do nothing when the chunk is empty', async () => {
          // Arrange
          // Act
          await algorand.batchTransActionProcessor([], unclaimedAsset);
          // Assert
          expect(algorand.unclaimedGroupClaim).toHaveBeenCalledTimes(0);
          expect(mockedUnclaimedGroupClaim).toHaveBeenCalledTimes(0);
          expect(loggerInfoSpy).toHaveBeenCalledTimes(0);
        });
        test('should load up one chunk', async () => {
          // Arrange
          // Act
          await algorand.batchTransActionProcessor(chunk, unclaimedAsset);
          // Assert
          expect(algorand.unclaimedGroupClaim).toHaveBeenCalledWith(chunk, unclaimedAsset);
          expect(mockedUnclaimedGroupClaim).toHaveBeenCalledTimes(1);
          expect(loggerInfoSpy).toHaveBeenCalledTimes(2);
          expect(loggerInfoSpy).toHaveBeenNthCalledWith(
            1,
            `Claiming ${chunk.length} wallets with unclaimed ${unclaimedAsset.name}...`,
          );
          expect(loggerInfoSpy).toHaveBeenNthCalledWith(
            2,
            `For a total of ${amount * chunk.length} ${unclaimedAsset.name}`,
          );
        });
        test('should load up 15 chunks and only call unclaimed group claim 1 time', async () => {
          // Arrange
          for (let index = 0; index < 15; index++) {
            chunk.push(walletWithUnclaimedAssets);
          }
          // Act
          await algorand.batchTransActionProcessor(chunk, unclaimedAsset);
          // Assert
          expect(algorand.unclaimedGroupClaim).toHaveBeenCalledWith(chunk, unclaimedAsset);
          expect(mockedUnclaimedGroupClaim).toHaveBeenCalledTimes(1);
          expect(loggerInfoSpy).toHaveBeenCalledTimes(2);
          expect(loggerInfoSpy).toHaveBeenNthCalledWith(
            1,
            `Claiming ${chunk.length} wallets with unclaimed ${unclaimedAsset.name}...`,
          );
          expect(loggerInfoSpy).toHaveBeenNthCalledWith(
            2,
            `For a total of ${(amount * chunk.length).toLocaleString()} ${unclaimedAsset.name}`,
          );
        });
        test('should load up 25 chunks and call unclaimed group claim 2 time', async () => {
          // Arrange
          for (let index = 0; index < 25; index++) {
            chunk.push(walletWithUnclaimedAssets);
          }
          // Act
          await algorand.batchTransActionProcessor(chunk, unclaimedAsset);
          // Assert
          const mockChunk = chunkArray(chunk, AtomicTransactionComposer.MAX_GROUP_SIZE);
          expect(algorand.unclaimedGroupClaim).toHaveBeenCalledWith(mockChunk[0], unclaimedAsset);
          expect(algorand.unclaimedGroupClaim).toHaveBeenCalledWith(mockChunk[1], unclaimedAsset);
          expect(mockedUnclaimedGroupClaim).toHaveBeenCalledTimes(2);
          expect(loggerInfoSpy).toHaveBeenCalledTimes(2);
          expect(loggerInfoSpy).toHaveBeenNthCalledWith(
            1,
            `Claiming ${chunk.length} wallets with unclaimed ${unclaimedAsset.name}...`,
          );
          expect(loggerInfoSpy).toHaveBeenNthCalledWith(
            2,
            `For a total of ${(amount * chunk.length).toLocaleString()} ${unclaimedAsset.name}`,
          );
        });
      });
      describe('unclaimedGroupClaim', () => {
        let mockedGroupClaim;
        beforeEach(() => {
          mockedGroupClaim = jest.spyOn(algorand, 'groupClaimToken');
        });
        afterEach(() => {
          mockedGroupClaim.mockClear();
        });
        test('should claim all unclaimed tokens for one wallet', async () => {
          // Arrange
          mockedGroupClaim.mockResolvedValueOnce({
            txId: '123',
          });
          // Act
          await algorand.unclaimedGroupClaim(chunk, unclaimedAsset);
          expect(fetchMock).toHaveBeenCalledTimes(0);
          expect(mockedGroupClaim).toHaveBeenCalledWith({
            assetIndex: unclaimedAsset.id,
            groupTransfer: chunk,
          });
          verify(
            mockAlgoRepo.removeUnclaimedTokensFromMultipleWallets(chunk, unclaimedAsset),
          ).once();
          expect(loggerErrorSpy).toHaveBeenCalledTimes(0);

          // Assert
        });
        test('should log an error if the claim failed', async () => {
          // Arrange
          mockedGroupClaim.mockResolvedValueOnce({});

          // Act
          await algorand.unclaimedGroupClaim(chunk, unclaimedAsset);
          expect(fetchMock).toHaveBeenCalledTimes(0);
          expect(mockedGroupClaim).toHaveBeenCalledWith({
            assetIndex: unclaimedAsset.id,
            groupTransfer: chunk,
          });
          verify(
            mockAlgoRepo.removeUnclaimedTokensFromMultipleWallets(chunk, unclaimedAsset),
          ).never();
          expect(loggerErrorSpy).toHaveBeenCalledTimes(2);
          expect(loggerErrorSpy).toHaveBeenNthCalledWith(
            1,
            `Auto Claim Failed: Auto Claim Failed ${chunk.length} wallets with a total of ${amount} ${unclaimedAsset.name}`,
          );

          // Assert
        });

        test('should log an error if the claim fails', async () => {
          // Arrange
          mockedGroupClaim.mockRejectedValueOnce(new Error('test error'));
          // Act
          await algorand.unclaimedGroupClaim(chunk, unclaimedAsset);
          expect(fetchMock).toHaveBeenCalledTimes(0);
          expect(mockedGroupClaim).toHaveBeenCalledWith({
            assetIndex: unclaimedAsset.id,
            groupTransfer: chunk,
          });
          expect(loggerErrorSpy).toHaveBeenCalledTimes(2);
          expect(loggerErrorSpy).toHaveBeenNthCalledWith(1, `Auto Claim Failed: test error`);
          expect(loggerErrorSpy).toHaveBeenNthCalledWith(
            2,
            `${walletAddress} -- ${amount} -- ${userId}`,
          );
          // Assert
        });
      });
    });
  });
  describe('checkSenderBalance', () => {
    const walletAddress = 'exampleWalletAddress';
    const optInAssetId = 123;
    const accountAssets = [
      { 'asset-id': 123, amount: 100 },
      { 'asset-id': 456, amount: 200 },
    ];

    test('should return the senders balance', async () => {
      // Arrange
      fetchMock.mockResponseOnce(JSON.stringify({ assets: accountAssets }));

      // Act
      const result = await algorand.checkSenderBalance(walletAddress, optInAssetId, 10);

      // Assert
      expect(result).toEqual(100);
    });
    test('should throw an error if the sender does not have enough balance', async () => {
      // Arrange
      expect.assertions(1);
      fetchMock.mockResponseOnce(JSON.stringify({ assets: accountAssets }));

      // Act
      try {
        await algorand.checkSenderBalance(walletAddress, optInAssetId, 2000);
      } catch (error) {
        // Assert
        expect(error).toHaveProperty('message', 'Insufficient Funds to cover transaction');
      }
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
      config.set('clawbackTokenMnemonic', clawbackMnemonic);
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
          expect(mockFetch).toHaveBeenCalledTimes(1);
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
        algorand.getSuggestedParameters = jest.fn().mockResolvedValueOnce(transactionParameters);
        fetchMock.mockResponseOnce(JSON.stringify({ txId: '123' }));
        // Act
        const result = await algorand.transferOptionsProcessor({
          assetIndex: 123,
          amount: 100,
          receiverAddress: 'failed address',
        });
        // Assert
        expect(mockFetch).toHaveBeenCalledTimes(0);
        expect(result).toEqual({
          error: 'Failed the Token transfer: address seems to be malformed',
        });
      });
    });
    describe('transaction functions', () => {
      let spySingleTransfer;
      beforeEach(() => {
        spySingleTransfer = jest.spyOn(algorand, 'makeSingleAssetTransferTransaction');
      });
      afterEach(() => {
        spySingleTransfer.mockClear();
      });
      describe('groupTransfer stuff', () => {
        let userId: string;
        let unclaimedAsset: UnclaimedAsset;
        let chunk: WalletWithUnclaimedAssets[];
        let walletWithUnclaimedAssets: WalletWithUnclaimedAssets;
        const amount = 100;
        let algoTransactionOptions;
        beforeEach(() => {
          unclaimedAsset = { id: faker.number.int(), name: faker.lorem.word() };
          userId = faker.person.firstName();
          walletWithUnclaimedAssets = {
            walletAddress: testAccount.addr,
            unclaimedTokens: amount,
            userId,
          };
          chunk = [walletWithUnclaimedAssets];
          algoTransactionOptions = {
            from: clawbackAccount.addr,
            assetIndex: unclaimedAsset.id,
            suggestedParams: transactionParameters,
          };
        });
        describe('makeMultipleAssetTransferTransaction', () => {
          test('should send one transaction processed with groupID assigned and amount and address added', () => {
            // Arrange
            algorand.getSuggestedParameters = jest
              .fn()
              .mockResolvedValueOnce(transactionParameters);
            fetchMock.mockResponseOnce(JSON.stringify({ txId: '123' }));
            // Act
            const result = algorand.makeMultipleAssetTransferTransaction(
              algoTransactionOptions,
              chunk,
            );
            // Assert
            expect(mockFetch).toHaveBeenCalledTimes(0);
            expect(spySingleTransfer).toHaveBeenCalledTimes(1);
            expect(spySingleTransfer).toHaveBeenCalledWith({
              ...algoTransactionOptions,
              amount,
              to: testAccount.addr,
            });
            expect(result[0].group).toBeDefined();
          });
        });
      });
      describe('claimToken', () => {
        const assetIndex = 123;
        const amount = 100;
        const expectedTokenResponse = { txId: '123' };

        test('should return the claim token ClaimTokenResponse', async () => {
          // Arrange
          algorand.getSuggestedParameters = jest.fn().mockResolvedValueOnce(transactionParameters);
          fetchMock.mockResponseOnce(JSON.stringify(expectedTokenResponse));
          // Act
          const result = await algorand.claimToken({
            assetIndex,
            amount,
            receiverAddress: testAccount.addr,
          });
          // Assert
          expect(mockFetch).toHaveBeenCalledTimes(1);
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
      describe('groupClaimToken', () => {
        const assetIndex = 123;
        const amount = 100;
        const walletWithUnclaimedAssets = {
          walletAddress: testAccount.addr,
          unclaimedTokens: amount,
          userId: 'test',
        };
        const chunk = [walletWithUnclaimedAssets];
        test('should send one transaction processed with groupID assigned and amount and address added', async () => {
          // Arrange
          algorand.getSuggestedParameters = jest.fn().mockResolvedValueOnce(transactionParameters);
          fetchMock.mockResponseOnce(JSON.stringify({ txId: '123' }));
          // Act
          const result = await algorand.groupClaimToken({
            assetIndex: assetIndex,
            groupTransfer: chunk,
          });
          // Assert;
          expect(mockFetch).toHaveBeenCalledTimes(1);
          expect(spySingleTransfer).toHaveBeenCalledTimes(1);
          expect(result).toEqual({ txId: '123' });
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
          algorand.getSuggestedParameters = jest.fn().mockResolvedValueOnce(transactionParameters);

          fetchMock.mockResponseOnce(JSON.stringify(expectedTokenResponse));
          // Act
          const result = await algorand.tipToken({
            assetIndex,
            amount,
            receiverAddress: testAccount.addr,
            senderAddress: testAccount2.addr,
          });
          // Assert
          expect(mockFetch).toHaveBeenCalledTimes(1);
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
          const spySingleTransfer = jest.spyOn(algorand, 'makeSingleAssetTransferTransaction');
          algorand.getSuggestedParameters = jest.fn().mockResolvedValueOnce(transactionParameters);

          fetchMock.mockResponseOnce(JSON.stringify(expectedTokenResponse));
          // Act
          const result = await algorand.purchaseItem({
            assetIndex,
            amount,
            senderAddress: testAccount.addr,
          });
          // Assert
          expect(mockFetch).toHaveBeenCalledTimes(1);
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
