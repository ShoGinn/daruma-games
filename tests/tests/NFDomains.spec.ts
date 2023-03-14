import mockAxios from 'axios';

import { NFDomainsManager } from '../../src/model/framework/manager/NFDomains.js';
import {
    createNFDWalletRecords,
    generateRandomNFDName,
    mockNoNFDWalletData,
} from '../mocks/mockNFDData.js';
import { generateAlgoWalletAddress, generateDiscordId } from '../utils/testFuncs.js';
jest.mock('axios');

const discordID = generateDiscordId();
const wallet = generateAlgoWalletAddress();
const nfdName = generateRandomNFDName();
const expectedWalletRecords = createNFDWalletRecords(wallet, nfdName, discordID);

describe('NFDomainsManager', () => {
    let manager: NFDomainsManager;
    let mockRequest: jest.Mock;

    beforeEach(() => {
        manager = new NFDomainsManager();
        mockRequest = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockAxios as any).get = mockRequest;
    });
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getFullOwnedByWallet -- And items relying on it', () => {
        const expectedData = { data: expectedWalletRecords };
        const expectedParams = {
            params: {
                limit: 200,
                address: wallet,
                view: 'full',
            },
        };

        describe('getNFDRecordsOwnedByWallet', () => {
            it('should fetch full NFD records for a wallet', async () => {
                mockRequest.mockResolvedValueOnce(expectedData);

                const records = await manager.getNFDRecordsOwnedByWallet(wallet);

                expect(records).toEqual(expectedData.data);
            });
            it('should call apiFetch with correct params', async () => {
                mockRequest.mockResolvedValueOnce(expectedData);

                await manager.getNFDRecordsOwnedByWallet(wallet);
                expect(mockRequest).toHaveBeenCalledWith('nfd/v2/address', expectedParams);
            });
            it('should respond correctly to a 404 error', async () => {
                mockRequest.mockResolvedValueOnce(mockNoNFDWalletData);
                const records = await manager.getNFDRecordsOwnedByWallet(wallet);

                expect(records).toBe('');
            });
            it('should handle errors', async () => {
                manager['rateLimitedRequest'] = mockRequest;

                mockRequest.mockRejectedValue(new Error('Server error'));
                const error = await manager.getNFDRecordsOwnedByWallet(wallet).catch(e => e);

                expect(error).toEqual(new Error('Server error'));
            });
            it('should throw an error if the wallet is not a valid address', async () => {
                const error = await manager.getNFDRecordsOwnedByWallet('invalid').catch(e => e);

                expect(error).toEqual(new Error('Invalid Algorand wallet address: invalid'));
            });
        });
        describe('getWalletDomainNamesFromWallet', () => {
            it('should fetch and return domain names for a wallet', async () => {
                mockRequest.mockResolvedValueOnce(expectedData);

                const domainNames = await manager.getWalletDomainNamesFromWallet(wallet);

                expect(domainNames).toEqual([nfdName]);
            });

            it('should handle errors', async () => {
                manager['rateLimitedRequest'] = mockRequest;

                mockRequest.mockRejectedValue(new Error('Server error'));
                const error = await manager.getWalletDomainNamesFromWallet(wallet).catch(e => e);

                expect(error).toEqual(new Error('Server error'));
            });
            it('should handle a wallet that does not own any domains', async () => {
                mockRequest.mockResolvedValueOnce(mockNoNFDWalletData);
                const domainNames = await manager.getWalletDomainNamesFromWallet(wallet);
                expect(domainNames).toEqual([]);
            });
        });
        describe('validateWalletFromDiscordID', () => {
            it('should return false if wallet is owned by the specified discord ID', async () => {
                mockRequest.mockResolvedValueOnce(expectedData);

                const result = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);

                expect(result).toBe(false);
            });

            it('should return false if the wallet does not have any discord ID', async () => {
                const expectedData = createNFDWalletRecords(wallet, nfdName);
                mockRequest.mockResolvedValue({ data: expectedData });

                const result = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);

                expect(result).toBe(false);
            });

            it('should return true if wallet is owned by a different discord ID', async () => {
                mockRequest.mockResolvedValueOnce(expectedData);

                const result = await manager.isWalletOwnedByOtherDiscordID(
                    generateDiscordId(),
                    wallet
                );

                expect(result).toBe(true);
            });
            it('should handle a wallet that does not own any domains', async () => {
                mockRequest.mockResolvedValueOnce(mockNoNFDWalletData);
                const domainNames = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);
                expect(domainNames).toBeFalsy();
            });
        });
    });
});
