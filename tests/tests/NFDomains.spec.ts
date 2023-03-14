import mockAxios from 'axios';

import { NFDomainsManager } from '../../src/model/framework/manager/NFDomains.js';
import { NFDRecordsByWallet } from '../../src/model/types/NFDomain.js';
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

describe('NFDomainsManager', () => {
    let manager: NFDomainsManager;
    let mockRequest: jest.Mock;
    let expectedWalletRecords: NFDRecordsByWallet;
    let expectedData: Record<string, NFDRecordsByWallet>;
    beforeAll(() => {
        mockRequest = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockAxios as any).get = mockRequest;
    });
    beforeEach(() => {
        manager = new NFDomainsManager();

        expectedWalletRecords = createNFDWalletRecords(wallet, nfdName, discordID);
        expectedData = { data: expectedWalletRecords };
    });
    afterAll(() => {
        jest.clearAllMocks();
    });

    describe('getFullOwnedByWallet -- And items relying on it', () => {
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

                expect(records).toEqual('');
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
            it('should return an empty array because the response is empty', async () => {
                mockRequest.mockResolvedValueOnce({ data: { [wallet]: null } });

                const domainNames = await manager.getWalletDomainNamesFromWallet(wallet);

                expect(domainNames).toEqual([]);
            });
            it('should handle a wallet that does not own any domains', async () => {
                mockRequest.mockResolvedValueOnce(mockNoNFDWalletData);
                const domainNames = await manager.getWalletDomainNamesFromWallet(wallet);
                expect(domainNames).toEqual([]);
            });
            it('should return an empty array if the wallet is not a valid address', async () => {
                expectedWalletRecords[wallet][0].depositAccount = generateAlgoWalletAddress();
                expectedWalletRecords[wallet][0].owner = generateAlgoWalletAddress();
                expectedWalletRecords[wallet][0].caAlgo = [generateAlgoWalletAddress()];
                expectedWalletRecords[wallet][0].unverifiedCaAlgo = [wallet];

                const expectedData = { data: expectedWalletRecords };

                mockRequest.mockResolvedValueOnce(expectedData);

                const domainNames = await manager.getWalletDomainNamesFromWallet(wallet);
                expect(domainNames).toEqual([]);
            });
        });
        describe('validateWalletFromDiscordID', () => {
            it('should return false if wallet is owned by the specified discord ID', async () => {
                mockRequest.mockResolvedValueOnce(expectedData);

                const result = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);

                expect(result).toBeFalsy();
            });

            it('should return false if the wallet does not have any discord ID', async () => {
                const expectedData = createNFDWalletRecords(wallet, nfdName);
                mockRequest.mockResolvedValue({ data: expectedData });

                const result = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);

                expect(result).toBeFalsy();
            });

            it('should return true if wallet is owned by a different discord ID', async () => {
                mockRequest.mockResolvedValueOnce(expectedData);

                const result = await manager.isWalletOwnedByOtherDiscordID(
                    generateDiscordId(),
                    wallet
                );

                expect(result).toBeTruthy();
            });
            it('should handle a wallet that does not own any domains', async () => {
                mockRequest.mockResolvedValueOnce(mockNoNFDWalletData);
                const domainNames = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);
                expect(domainNames).toBeFalsy();
            });
            it('should return false if the wallet is not a valid address', async () => {
                expectedWalletRecords[wallet][0].depositAccount = generateAlgoWalletAddress();
                expectedWalletRecords[wallet][0].owner = generateAlgoWalletAddress();
                expectedWalletRecords[wallet][0].caAlgo = [generateAlgoWalletAddress()];
                expectedWalletRecords[wallet][0].unverifiedCaAlgo = [wallet];

                const expectedData = { data: expectedWalletRecords };

                mockRequest.mockResolvedValueOnce(expectedData);

                const result = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);
                expect(result).toBeFalsy();
            });
            it('should handle nfdRecord with missing verified.discord property', async () => {
                const expectedWalletRecords = createNFDWalletRecords(wallet, nfdName, discordID);
                // Modify one of the wallet records to have a missing discord property
                delete expectedWalletRecords[wallet][0].properties?.verified?.discord;

                const expectedData = { data: expectedWalletRecords };
                mockRequest.mockResolvedValueOnce(expectedData);

                const result = await manager.isWalletOwnedByOtherDiscordID(discordID, wallet);

                expect(result).toBe(false); // Assuming the other wallet records still have the correct discordID
            });
        });
    });
    describe('checkIfWalletIsVerified', () => {
        it('should return false because the nfdRecords are empty', () => {
            const result = manager.isNFDWalletVerified(wallet, undefined);
            expect(result).toBeFalsy();
        });
        it('should return true because the wallet is verified', async () => {
            const expectedData = { data: expectedWalletRecords };

            mockRequest.mockResolvedValueOnce(expectedData);

            const records = await manager.getNFDRecordsOwnedByWallet(wallet);
            const result = manager.isNFDWalletVerified(wallet, records);

            expect(result).toBeTruthy();
        });
        it('should return true because the wallet is not the owner or a deposit account but is verified', async () => {
            expectedWalletRecords[wallet][0].owner = generateAlgoWalletAddress();
            expectedWalletRecords[wallet][0].depositAccount = generateAlgoWalletAddress();
            const expectedData = { data: expectedWalletRecords };

            mockRequest.mockResolvedValueOnce(expectedData);

            const records = await manager.getNFDRecordsOwnedByWallet(wallet);
            const result = manager.isNFDWalletVerified(wallet, records);

            expect(result).toBeTruthy();
        });
        it('should return true because the wallet has an owner', async () => {
            expectedWalletRecords[wallet][0].depositAccount = generateAlgoWalletAddress();
            expectedWalletRecords[wallet][0].caAlgo = [generateAlgoWalletAddress()];
            const expectedData = { data: expectedWalletRecords };

            mockRequest.mockResolvedValueOnce(expectedData);

            const records = await manager.getNFDRecordsOwnedByWallet(wallet);
            const result = manager.isNFDWalletVerified(wallet, records);

            expect(result).toBeTruthy();
        });

        it('should return false because the wallet is not verified', async () => {
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
