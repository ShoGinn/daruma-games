import type { NFDRecord } from '../../src/model/types/NFDomain.js';

import { NFDomainsManager } from '../../src/model/framework/manager/NFDomains.js';

describe('NFDomainsManager', () => {
    let manager: NFDomainsManager;
    let mockRequest: jest.Mock;

    beforeEach(() => {
        manager = new NFDomainsManager();
        mockRequest = jest.fn();
    });
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getWalletFromDiscordID -- And items relying on it', () => {
        const discordID = '123456789';
        const expectedRecords: Array<NFDRecord> = [
            {
                appID: 765898422,
                asaID: 765898428,
                depositAccount: 'PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE',
                nfdAccount: 'HXTLC3FBRUVKSO667VAJKGO736GG3CPL6ND2TNWG7CK25A3ZEAEWRC75WY',
                name: 'algodaruma.algo',
                owner: 'PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE',
                metaTags: ['10+_letters', 'pristine'],
                properties: {
                    userDefined: {
                        avatar: 'https://images.nf.domains/avatar/3cdc039f-b7d7-4389-9857-93863ac756f1',
                        url: 'https://app.nf.domains/name/algodaruma.algo?view=gallery',
                    },
                },
                caAlgo: ['PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE'],
                unverifiedCaAlgo: [
                    '5EQXO5KQLKBET3G5CRA3SU3FBA5EUV5ZXYQ4V2LHLU4RUCKUP7AYBIOMME',
                    'KRMAMIEHH54YZAUG53K6DVF3UO7DB5PFLXP7KRZDVUUJWWXSDKOJC6ZJD4',
                ],
            },
        ];
        const expectedData = { data: expectedRecords };
        const expectedParams = {
            params: {
                vproperty: 'discord',
                vvalue: discordID,
            },
        };

        beforeEach(() => {
            manager['apiFetch'] = jest.fn().mockResolvedValue(expectedData);
        });

        it('should fetch NFD records for a Discord ID', async () => {
            const records = await manager.getNFDRecordsOwnedByDiscordID(discordID);
            expect(records).toEqual(expectedRecords);
        });
        it('should call apiFetch with correct params', async () => {
            await manager.getNFDRecordsOwnedByDiscordID(discordID);
            expect(manager['apiFetch']).toHaveBeenCalledWith('nfd/browse', expectedParams);
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

                expect(result).toEqual([
                    'PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE',
                ]);
            });

            it('should return an empty array if no NFD records are found for the specified discord ID', async () => {
                // copy expectedData and set caAlgo to an empty array
                const newData = JSON.parse(JSON.stringify(expectedData));
                newData.data[0].caAlgo = [];

                manager['apiFetch'] = jest.fn().mockResolvedValue(newData);

                const result = await manager.getAllOwnerWalletsFromDiscordID(discordID);

                expect(result).toEqual([]);
            });
            it('should return an empty array if NFD records are undefined for the specified discord ID', async () => {
                // copy expectedData and set caAlgo to an empty array
                const newData = JSON.parse(JSON.stringify(expectedData));
                newData.data[0].caAlgo = undefined;

                manager['apiFetch'] = jest.fn().mockResolvedValue(newData);

                const result = await manager.getAllOwnerWalletsFromDiscordID(discordID);

                expect(result).toEqual([]);
            });
        });
    });
    describe('getFullOwnedByWallet -- And items relying on it', () => {
        const discordID = '123456789';
        const wallet = 'PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE';
        const expectedRecords: Array<NFDRecord> = [
            {
                appID: 765898422,
                asaID: 765898428,
                timeCreated: new Date(),
                timeChanged: new Date(),
                timePurchased: new Date(),
                currentAsOfBlock: 25919394,
                depositAccount: 'PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE',
                nfdAccount: 'HXTLC3FBRUVKSO667VAJKGO736GG3CPL6ND2TNWG7CK25A3ZEAEWRC75WY',
                name: 'algodaruma.algo',
                owner: 'PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE',
                seller: 'PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE',
                metaTags: ['10+_letters', 'pristine'],
                properties: {
                    internal: {
                        asaid: '765898428',
                        category: 'common',
                        commission1: '50',
                        commission1Agent:
                            'RSV2YCHXA7MWGFTX3WYI7TVGAS5W5XH5M7ZQVXPPRQ7DNTNW36OW2TRR6I',
                        contractLocked: '0',
                        highestSoldAmt: '46500000',
                        name: 'algodaruma.algo',
                        owner: 'PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE',
                        saleType: 'buyItNow',
                        seller: 'PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE',
                        timeChanged: '1672433269',
                        timeCreated: '1654377215',
                        timePurchased: '1654377379',
                        ver: '1.08',
                    },
                    userDefined: {
                        avatar: 'https://images.nf.domains/avatar/3cdc039f-b7d7-4389-9857-93863ac756f1',
                        banner: 'https://images.nf.domains/banner/050cf7b3-5601-4ab9-a6d2-e3b65073539c',
                        bio: 'What do you get when you combine the love Algorand technology and the love of Japanese culture? You get ALGODARUMA! The iconic Japanese idol that wishes are made yearly in the hopes of achieving them at the end of the year. If that wish is not fulfilled, the doll is then burned! Don’t fret, your digital AlgoDaruma’s wont be burned.',
                        caalgo: '5EQXO5KQLKBET3G5CRA3SU3FBA5EUV5ZXYQ4V2LHLU4RUCKUP7AYBIOMME,KRMAMIEHH54YZAUG53K6DVF3UO7DB5PFLXP7KRZDVUUJWWXSDKOJC6ZJD4',
                        domain: 'algodaruma.com',
                        name: 'AlgoDaruma',
                        url: 'https://app.nf.domains/name/algodaruma.algo?view=gallery',
                        website: 'https://www.algodaruma.com',
                    },
                    verified: {
                        caAlgo: 'PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE',
                        discord: '827317035670700042',
                        email: 'admin@algodaruma.com',
                        twitter: '@algodaruma',
                    },
                },
                caAlgo: ['PJZZK5XLDUGMNBKQIEGFERO6TLSB4M3ZC6G32WPOLDIOCPUTVUMH4S52GE'],
                unverifiedCaAlgo: [
                    '5EQXO5KQLKBET3G5CRA3SU3FBA5EUV5ZXYQ4V2LHLU4RUCKUP7AYBIOMME',
                    'KRMAMIEHH54YZAUG53K6DVF3UO7DB5PFLXP7KRZDVUUJWWXSDKOJC6ZJD4',
                ],
            },
        ];
        const expectedData = { data: expectedRecords };
        const expectedParams = {
            params: {
                limit: 200,
                owner: wallet,
                view: 'full',
            },
        };

        beforeEach(() => {
            manager['apiFetch'] = jest.fn().mockResolvedValue(expectedData);
        });

        it('should fetch full NFD records for a wallet', async () => {
            const records = await manager.getNFDRecordsOwnedByWallet(wallet);

            expect(records).toEqual(expectedRecords);
        });
        it('should call apiFetch with correct params', async () => {
            await manager.getNFDRecordsOwnedByWallet(wallet);
            expect(manager['apiFetch']).toHaveBeenCalledWith('nfd/browse', expectedParams);
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

                expect(domainNames).toEqual(['algodaruma.algo']);
            });

            it('should handle errors', async () => {
                manager['rateLimitedRequest'] = mockRequest;

                mockRequest.mockRejectedValue(new Error('Server error'));
                const error = await manager.getWalletDomainNamesFromWallet(wallet).catch(e => e);

                expect(error).toEqual(new Error('Server error'));
            });
        });
        describe('validateWalletFromDiscordID', () => {
            it('should return true if wallet is owned by the specified discord ID', async () => {
                const result = await manager.checkWalletOwnershipFromDiscordID(
                    '827317035670700042',
                    wallet
                );

                expect(result).toBe(true);
            });

            it('should return true if the wallet does not have any discord ID', async () => {
                // copy the expected data and remove verified discord ID
                const expectedData = {
                    data: [
                        {
                            ...expectedRecords[0],
                            properties: {
                                ...expectedRecords[0].properties,
                                verified: {},
                            },
                        },
                    ],
                };
                manager['apiFetch'] = jest.fn().mockResolvedValue(expectedData);
                const result = await manager.checkWalletOwnershipFromDiscordID(discordID, wallet);

                expect(result).toBe(true);
            });

            it('should return false if wallet is owned by a different discord ID', async () => {
                const result = await manager.checkWalletOwnershipFromDiscordID(discordID, wallet);

                expect(result).toBe(false);
            });
        });
    });
});
