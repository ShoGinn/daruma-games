import mockAxios from 'axios';

import { NFDomainsManager } from '../../src/model/framework/manager/nf-domains.js';
import { NFDRecordsByWallet } from '../../src/model/types/nf-domains.js';
import {
  createNFDWalletRecords,
  generateRandomNFDName,
  mockNoNFDWalletData,
} from '../mocks/mock-nfd-data.js';
import { generateAlgoWalletAddress, generateDiscordId } from '../utils/test-funcs.js';

jest.mock('axios');

const discordID = generateDiscordId();
const wallet = generateAlgoWalletAddress();
const wallet2 = generateAlgoWalletAddress();

const nfdName = generateRandomNFDName();

describe('NFDomainsManager', () => {
  let manager: NFDomainsManager;
  let mockRequest: jest.Mock;
  let expectedWalletRecords: NFDRecordsByWallet;
  let expectedWalletRecords2: NFDRecordsByWallet;

  beforeAll(() => {
    mockRequest = jest.fn();
    mockAxios.get = mockRequest;
    expectedWalletRecords = createNFDWalletRecords(wallet, nfdName, discordID);
    expectedWalletRecords2 = createNFDWalletRecords(wallet2, nfdName, discordID);
    expectedWalletRecords2[wallet2][0].depositAccount = generateAlgoWalletAddress();
    expectedWalletRecords2[wallet2][0].owner = generateAlgoWalletAddress();
    expectedWalletRecords2[wallet2][0].caAlgo = [generateAlgoWalletAddress()];
    expectedWalletRecords2[wallet2][0].unverifiedCaAlgo = [wallet2];
  });
  beforeEach(() => {
    manager = new NFDomainsManager();
  });
  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('getFullOwnedByWallet -- And items relying on it', () => {
    const expectedParameters = {
      params: {
        limit: 200,
        address: wallet,
        view: 'full',
      },
    };

    describe('getNFDRecordsOwnedByWallet', () => {
      test('should fetch full NFD records for a wallet', async () => {
        mockRequest.mockResolvedValueOnce({ data: expectedWalletRecords });

        const records = await manager.getNFDRecordsOwnedByWallet(wallet);

        expect(records).toEqual(expectedWalletRecords);
      });
      test('should call apiFetch with correct params', async () => {
        mockRequest.mockResolvedValueOnce({ data: expectedWalletRecords });

        await manager.getNFDRecordsOwnedByWallet(wallet);
        expect(mockRequest).toHaveBeenCalledWith('nfd/v2/address', expectedParameters);
      });
      test('should respond correctly to a 404 error', async () => {
        mockRequest.mockResolvedValueOnce(mockNoNFDWalletData);
        const records = await manager.getNFDRecordsOwnedByWallet(wallet);

        expect(records).toBe('');
      });
      test('should handle errors', async () => {
        manager['rateLimitedRequest'] = mockRequest;

        mockRequest.mockRejectedValue(new Error('Server error'));
        const error = await manager.getNFDRecordsOwnedByWallet(wallet).catch((error_) => error_);

        expect(error).toEqual(new Error('Server error'));
      });
      test('should throw an error if the wallet is not a valid address', async () => {
        const error = await manager.getNFDRecordsOwnedByWallet('invalid').catch((error_) => error_);

        expect(error).toEqual(new Error('Invalid Algorand wallet address: invalid'));
      });
    });
    describe('getWalletDomainNamesFromWallet', () => {
      test('should fetch and return domain names for a wallet', async () => {
        mockRequest.mockResolvedValueOnce({ data: expectedWalletRecords });

        const domainNames = await manager.getWalletDomainNamesFromWallet(wallet);

        expect(domainNames).toEqual([nfdName]);
      });

      test('should handle errors', async () => {
        manager['rateLimitedRequest'] = mockRequest;

        mockRequest.mockRejectedValue(new Error('Server error'));
        const error = await manager
          .getWalletDomainNamesFromWallet(wallet)
          .catch((error_) => error_);

        expect(error).toEqual(new Error('Server error'));
      });
      test('should return an empty array because the response is empty', async () => {
        mockRequest.mockResolvedValueOnce({ data: { [wallet]: null } });

        const domainNames = await manager.getWalletDomainNamesFromWallet(wallet);

        expect(domainNames).toEqual([]);
      });
      test('should handle a wallet that does not own any domains', async () => {
        mockRequest.mockResolvedValueOnce(mockNoNFDWalletData);
        const domainNames = await manager.getWalletDomainNamesFromWallet(wallet);
        expect(domainNames).toEqual([]);
      });
      test('should return an empty array if the wallet is not a valid address', async () => {
        mockRequest.mockResolvedValueOnce({ data: expectedWalletRecords2 });

        const domainNames = await manager.getWalletDomainNamesFromWallet(wallet2);
        expect(domainNames).toEqual([]);
      });
    });
    describe('validateWalletFromDiscordID', () => {
      test('should return false if wallet is owned by the specified discord ID', async () => {
        mockRequest.mockResolvedValueOnce({ data: expectedWalletRecords });

        const result = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);

        expect(result).toBeFalsy();
      });

      test('should return false if the wallet does not have any discord ID', async () => {
        mockRequest.mockResolvedValue({ data: expectedWalletRecords });

        const result = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);

        expect(result).toBeFalsy();
      });

      test('should return true if wallet is owned by a different discord ID', async () => {
        mockRequest.mockResolvedValueOnce({ data: expectedWalletRecords });

        const result = await manager.isWalletOwnedByOtherDiscordID(generateDiscordId(), wallet);

        expect(result).toBeTruthy();
      });
      test('should handle a wallet that does not own any domains', async () => {
        mockRequest.mockResolvedValueOnce(mockNoNFDWalletData);
        const domainNames = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);
        expect(domainNames).toBeFalsy();
      });
      test('should return false if the wallet is not a valid address', async () => {
        mockRequest.mockResolvedValueOnce({ data: expectedWalletRecords2 });

        const result = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet2);
        expect(result).toBeFalsy();
      });
      test('should handle nfdRecord with missing verified.discord property', async () => {
        const expectedWalletRecords = createNFDWalletRecords(wallet, nfdName, discordID);
        // Modify one of the wallet records to have a missing discord property
        // sourcery skip: only-delete-object-properties
        delete expectedWalletRecords[wallet][0].properties?.verified?.['discord'];

        const expectedData = { data: expectedWalletRecords };
        mockRequest.mockResolvedValueOnce(expectedData);

        const result = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);

        expect(result).toBe(false); // Assuming the other wallet records still have the correct discordID
      });
    });
  });
  describe('checkIfWalletIsVerified', () => {
    test('should return false because the nfdRecords are empty', () => {
      const result = manager.isNFDWalletVerified(wallet);
      expect(result).toBeFalsy();
    });
    test('should return true because the wallet is verified', async () => {
      mockRequest.mockResolvedValueOnce({ data: expectedWalletRecords });

      const records = await manager.getNFDRecordsOwnedByWallet(wallet);
      const result = manager.isNFDWalletVerified(wallet, records);

      expect(result).toBeTruthy();
    });
    test('should return true because the wallet is not the owner or a deposit account but is verified', async () => {
      expectedWalletRecords[wallet][0].owner = generateAlgoWalletAddress();
      expectedWalletRecords[wallet][0].depositAccount = generateAlgoWalletAddress();
      const expectedData = { data: expectedWalletRecords };

      mockRequest.mockResolvedValueOnce(expectedData);

      const records = await manager.getNFDRecordsOwnedByWallet(wallet);
      const result = manager.isNFDWalletVerified(wallet, records);

      expect(result).toBeTruthy();
    });
    test('should return true because the wallet has an owner', async () => {
      expectedWalletRecords[wallet][0].depositAccount = generateAlgoWalletAddress();
      expectedWalletRecords[wallet][0].caAlgo = [generateAlgoWalletAddress()];
      const expectedData = { data: expectedWalletRecords };

      mockRequest.mockResolvedValueOnce(expectedData);

      const records = await manager.getNFDRecordsOwnedByWallet(wallet);
      const result = manager.isNFDWalletVerified(wallet, records);

      expect(result).toBeTruthy();
    });

    test('should return false because the wallet is not verified', async () => {
      expectedWalletRecords[wallet][0].depositAccount = generateAlgoWalletAddress();
      expectedWalletRecords[wallet][0].owner = generateAlgoWalletAddress();
      expectedWalletRecords[wallet][0].caAlgo = [generateAlgoWalletAddress()];
      expectedWalletRecords[wallet][0].unverifiedCaAlgo = [wallet];

      const expectedData = { data: expectedWalletRecords };

      mockRequest.mockResolvedValueOnce(expectedData);

      const records = await manager.getNFDRecordsOwnedByWallet(wallet);
      const result = manager.isNFDWalletVerified(wallet, records);

      expect(result).toBeFalsy();
    });
  });
});
