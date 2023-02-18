import { NFDomainsManager } from '../../src/model/framework/manager/NFDomains.js';

describe('NFDomainsManager', () => {
    let manager: NFDomainsManager;
    let mockRequest: jest.Mock;

    beforeEach(() => {
        manager = new NFDomainsManager();
        mockRequest = jest.fn();
        manager['rateLimitedRequest'] = mockRequest;
    });

    describe('getWalletFromDiscordID', () => {
        it('should fetch NFD records for a Discord ID', async () => {
            const discordID = '1234';
            const expectedRecords = [{ name: 'example.com' }];

            mockRequest.mockResolvedValue(expectedRecords);
            const records = await manager.getWalletFromDiscordID(discordID);

            expect(records).toEqual(expectedRecords);
            expect(mockRequest).toHaveBeenCalled();
        });

        it('should handle errors', async () => {
            const discordID = '1234';

            mockRequest.mockRejectedValue(new Error('Server error'));
            const error = await manager.getWalletFromDiscordID(discordID).catch(e => e);

            expect(error).toEqual(new Error('Server error'));
        });
    });
    describe('getFullOwnedByWallet', () => {
        it('should fetch full NFD records for a wallet', async () => {
            const wallet = '123456';
            const expectedRecords = [{ name: 'example.com' }];

            mockRequest.mockResolvedValue(expectedRecords);
            const records = await manager.getFullOwnedByWallet(wallet);

            expect(records).toEqual(expectedRecords);
            expect(mockRequest).toHaveBeenCalled();
            expect(mockRequest.mock.calls[0][0]).toBeInstanceOf(Function);

            // ensure the request function retrieves the correct data
            // const requestFn = mockRequest.mock.calls[0][0];
            // const data = await requestFn();
            // expect(data).toEqual(expectedRecords);
        });

        it('should handle errors', async () => {
            const wallet = '0x123456';

            mockRequest.mockRejectedValue(new Error('Server error'));
            const error = await manager.getFullOwnedByWallet(wallet).catch(e => e);

            expect(error).toEqual(new Error('Server error'));
        });
    });
    describe('getWalletDomainNamesFromWallet', () => {
        it('should fetch and return domain names for a wallet', async () => {
            const wallet = 'wallet-address';
            const expectedRecords = [
                { name: 'example.com' },
                { name: 'another-example.com' },
                { name: null },
            ];

            mockRequest.mockResolvedValue(expectedRecords);
            const domainNames = await manager.getWalletDomainNamesFromWallet(wallet);

            expect(domainNames).toEqual(['example.com', 'another-example.com']);
            expect(mockRequest).toHaveBeenCalled();
        });

        it('should handle errors', async () => {
            const wallet = 'wallet-address';

            mockRequest.mockRejectedValue(new Error('Server error'));
            const error = await manager.getWalletDomainNamesFromWallet(wallet).catch(e => e);

            expect(error).toEqual(new Error('Server error'));
        });
    });
    describe('validateWalletFromDiscordID', () => {
        it('should return true if wallet is owned by the specified discord ID', async () => {
            const discordID = '1234';
            const wallet = 'wallet123';
            const expectedRecords = [
                { name: 'example.com', properties: { verified: { discord: discordID } } },
                { name: 'example2.com', properties: { verified: { discord: '5678' } } },
            ];

            mockRequest.mockResolvedValue(expectedRecords);
            const result = await manager.validateWalletFromDiscordID(discordID, wallet);

            expect(result).toBe(true);
            expect(mockRequest).toHaveBeenCalled();
        });

        it('should return true if the wallet does not have any discord ID', async () => {
            const discordID = '1234';
            const wallet = 'wallet123';
            const expectedRecords = [
                { name: 'example.com', properties: { verified: {} } },
                { name: 'example2.com', properties: { verified: {} } },
            ];

            mockRequest.mockResolvedValue(expectedRecords);
            const result = await manager.validateWalletFromDiscordID(discordID, wallet);

            expect(result).toBe(true);
            expect(mockRequest).toHaveBeenCalled();
        });

        it('should return false if wallet is owned by a different discord ID', async () => {
            const discordID = '1234';
            const wallet = 'wallet123';
            const expectedRecords = [
                { name: 'example.com', properties: { verified: { discord: '5678' } } },
                { name: 'example2.com', properties: { verified: { discord: '9012' } } },
            ];

            mockRequest.mockResolvedValue(expectedRecords);
            const result = await manager.validateWalletFromDiscordID(discordID, wallet);

            expect(result).toBe(false);
            expect(mockRequest).toHaveBeenCalled();
        });
    });

    describe('getAllOwnerWalletsFromDiscordID', () => {
        it('should return all unique owner wallets for the specified discord ID', async () => {
            const discordID = '1234';
            const expectedRecords = [
                { name: 'example.com', caAlgo: ['wallet123'] },
                { name: 'example2.com', caAlgo: ['wallet123', 'wallet456'] },
            ];

            mockRequest.mockResolvedValue(expectedRecords);
            const result = await manager.getAllOwnerWalletsFromDiscordID(discordID);

            expect(result).toEqual(['wallet123', 'wallet456']);
            expect(mockRequest).toHaveBeenCalled();
        });

        it('should return an empty array if no NFD records are found for the specified discord ID', async () => {
            const discordID = '1234';

            mockRequest.mockResolvedValue([]);
            const result = await manager.getAllOwnerWalletsFromDiscordID(discordID);

            expect(result).toEqual([]);
            expect(mockRequest).toHaveBeenCalled();
        });
    });
});
