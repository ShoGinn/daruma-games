import mockAxios from 'axios';

import { NFDomainsManager } from '../../src/model/framework/manager/NFDomains.js';
import {
    createNFDDiscordRecords,
    createNFDWalletRecords,
    generateRandomNFDName,
} from '../mocks/mockNFDData.js';
import { generateAlgoWalletAddress, generateDiscordId } from '../utils/testFuncs.js';
jest.mock('axios');

const discordID = generateDiscordId();
const wallet = generateAlgoWalletAddress();
const nfdName = generateRandomNFDName();
const expectedDiscordRecords = createNFDDiscordRecords(wallet, nfdName);
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

    describe('getWalletFromDiscordID -- And items relying on it', () => {
        const expectedData = { data: expectedDiscordRecords };
        const expectedParams = {
            params: {
                vproperty: 'discord',
                vvalue: discordID,
            },
        };

        beforeEach(() => {
            mockRequest.mockResolvedValue(expectedData);
        });

        it('should fetch NFD records for a Discord ID', async () => {
            const records = await manager.getNFDRecordsOwnedByDiscordID(discordID);
            expect(records).toEqual(expectedData.data);
        });
        it('should call apiFetch with correct params', async () => {
            await manager.getNFDRecordsOwnedByDiscordID(discordID);
            expect(mockRequest).toHaveBeenCalledWith('nfd/browse', expectedParams);
        });
        it('should handle errors', async () => {
            manager['rateLimitedRequest'] = mockRequest;

            mockRequest.mockRejectedValue(new Error('Server error'));
            const error = await manager.getNFDRecordsOwnedByDiscordID(discordID).catch(e => e);

            expect(error).toEqual(new Error('Server error'));
        });
        describe('getAllOwnerWalletsFromDiscordID', () => {
            it('should return all unique owner wallets for the specified discord ID', async () => {
                const result = await manager.getAllOwnerWalletsFromDiscordID(discordID);

                expect(result).toEqual([wallet]);
            });

            it('should return an empty array if no NFD records are found for the specified discord ID', async () => {
                // copy expectedData and set caAlgo to an empty array
                const newData = JSON.parse(JSON.stringify(expectedData));
                newData.data[0].caAlgo = [];

                mockRequest.mockResolvedValue(newData);

                const result = await manager.getAllOwnerWalletsFromDiscordID(discordID);

                expect(result).toEqual([]);
            });
            it('should return an empty array if NFD records are undefined for the specified discord ID', async () => {
                // copy expectedData and set caAlgo to an empty array
                const newData = JSON.parse(JSON.stringify(expectedData));
                newData.data[0].caAlgo = undefined;

                mockRequest.mockResolvedValue(newData);

                const result = await manager.getAllOwnerWalletsFromDiscordID(discordID);

                expect(result).toEqual([]);
            });
        });
    });
    describe('getFullOwnedByWallet -- And items relying on it', () => {
        const expectedData = { data: expectedWalletRecords };
        const expectedParams = {
            params: {
                limit: 200,
                owner: wallet,
                view: 'full',
            },
        };

        beforeEach(() => {
            mockRequest.mockResolvedValue(expectedData);
        });

        it('should fetch full NFD records for a wallet', async () => {
            const records = await manager.getNFDRecordsOwnedByWallet(wallet);

            expect(records).toEqual(expectedData.data);
        });
        it('should call apiFetch with correct params', async () => {
            await manager.getNFDRecordsOwnedByWallet(wallet);
            expect(mockRequest).toHaveBeenCalledWith('nfd/browse', expectedParams);
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

        describe('getWalletDomainNamesFromWallet', () => {
            it('should fetch and return domain names for a wallet', async () => {
                const domainNames = await manager.getWalletDomainNamesFromWallet(wallet);

                expect(domainNames).toEqual([nfdName]);
            });

            it('should handle errors', async () => {
                manager['rateLimitedRequest'] = mockRequest;

                mockRequest.mockRejectedValue(new Error('Server error'));
                const error = await manager.getWalletDomainNamesFromWallet(wallet).catch(e => e);

                expect(error).toEqual(new Error('Server error'));
            });
        });
        describe('validateWalletFromDiscordID', () => {
            it('should return false if wallet is owned by the specified discord ID', async () => {
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
                const result = await manager.isWalletOwnedByOtherDiscordID(
                    generateDiscordId(),
                    wallet
                );

                expect(result).toBe(true);
            });
        });
    });
});
