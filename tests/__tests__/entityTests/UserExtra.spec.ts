import { EntityManager, MikroORM } from '@mikro-orm/core';
import mockAxios from 'axios';
import { inlineCode } from 'discord.js';

import { AlgoStdToken } from '../../../src/entities/AlgoStdToken.entity.js';
import { AlgoWallet, AlgoWalletRepository } from '../../../src/entities/AlgoWallet.entity.js';
import { User, UserRepository } from '../../../src/entities/User.entity.js';
import { createNFDWalletRecords } from '../../mocks/mockNFDData.js';
import { initORM } from '../../utils/bootstrap.js';
import {
    addRandomAssetAndWalletToUser,
    createRandomASA,
    createRandomUser,
    createRandomUserWithRandomWallet,
    createRandomWallet,
    generateAlgoWalletAddress,
    generateDiscordId,
} from '../../utils/testFuncs.js';
jest.mock('axios');

describe('User tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let userRepo: UserRepository;
    let algoWalletRepo: AlgoWalletRepository;
    let user: User;
    let wallet: AlgoWallet;
    let mockRequest: jest.Mock;

    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
        jest.restoreAllMocks();
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        db = orm.em.fork();
        userRepo = db.getRepository(User);
        algoWalletRepo = db.getRepository(AlgoWallet);
        mockRequest = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockAxios as any).get = mockRequest;
        user = await createRandomUser(db);
        wallet = await createRandomWallet(db, user);
    });

    describe('walletOwnedByAnotherUser', () => {
        let isWalletOwnedByOtherDiscordID: boolean;
        let isWalletInvalid: boolean;
        describe('Wallet listed on the NFDomain and NOT owned by the discord user (invalid wallet)', () => {
            beforeEach(() => {
                isWalletOwnedByOtherDiscordID = true;
                isWalletInvalid = true;
                // Generate the mock NFDomain data
                const expectedData = createNFDWalletRecords(
                    wallet.address,
                    undefined,
                    generateDiscordId()
                );
                mockRequest.mockResolvedValueOnce({ data: expectedData });
            });
            it('should return null user because the wallet is not in the db', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(
                    user.id,
                    generateAlgoWalletAddress()
                );

                // assert
                expect(result.isWalletOwnedByOtherDiscordID).toBe(isWalletOwnedByOtherDiscordID);
                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).toBeNull();
            });
            it('should return user because the wallet is in the db', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, wallet.address);

                // assert
                expect(result.isWalletOwnedByOtherDiscordID).toBe(isWalletOwnedByOtherDiscordID);
                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).toBe(user);
            });
            it('should return other user because the wallets is in the db', async () => {
                const walletOwner = await createRandomUser(db);

                // act
                const result = await userRepo.walletOwnedByAnotherUser(
                    walletOwner.id,
                    wallet.address
                );

                // assert
                expect(result.isWalletOwnedByOtherDiscordID).toBe(isWalletOwnedByOtherDiscordID);
                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).not.toBe(walletOwner);
            });
        });
        describe('Wallet listed on the NFDomain and owned by the discord user or not owned at all (valid wallet)', () => {
            beforeEach(() => {
                isWalletOwnedByOtherDiscordID = false;
                isWalletInvalid = false;
                const expectedData = createNFDWalletRecords(wallet.address, undefined, user.id);
                mockRequest.mockResolvedValueOnce({ data: expectedData });
            });

            it('should return null user because the wallet is not in the db', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(
                    user.id,
                    generateAlgoWalletAddress()
                );

                // assert
                expect(result.isWalletOwnedByOtherDiscordID).toBe(isWalletOwnedByOtherDiscordID);
                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).toBeNull();
            });

            it('should return user because the wallet is in the db', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, wallet.address);

                // assert
                expect(result.isWalletOwnedByOtherDiscordID).toBe(isWalletOwnedByOtherDiscordID);
                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).toBe(user);
            });
            it('should return other user because the wallets is in the db (also should return isWalletInvalid: true', async () => {
                const walletOwner = await createRandomUser(db);

                // act
                const result = await userRepo.walletOwnedByAnotherUser(
                    walletOwner.id,
                    wallet.address
                );

                // assert
                expect(result.isWalletOwnedByOtherDiscordID).not.toBe(
                    isWalletOwnedByOtherDiscordID
                );

                expect(result.isWalletInvalid).not.toBe(isWalletInvalid);

                expect(result.walletOwner).not.toBe(walletOwner);
            });
        });
    });
    describe('addWalletToUser', () => {
        let isWalletInvalid: boolean;
        describe('Wallet listed on the NFDomain and NOT owned by the discord user (invalid wallet)', () => {
            beforeEach(() => {
                isWalletInvalid = true;
                const expectedData = createNFDWalletRecords(
                    wallet.address,
                    undefined,
                    generateDiscordId()
                );
                mockRequest.mockResolvedValueOnce({ data: expectedData });
            });
            it('should not add a wallet to a user because the user does not own the wallet that is registered in the NFD and the user does not exist on the server', async () => {
                // act
                const result = await userRepo.addNewWalletToUser(
                    user.id,
                    generateAlgoWalletAddress()
                );

                // assert
                expect(
                    result.walletOwnerMsg?.includes('has been registered to a NFT Domain.')
                ).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBeNull();
            });
            it('should not add a wallet to a user because the user does not own the wallet that is registered in the NFD', async () => {
                // act
                const result = await userRepo.addNewWalletToUser(user.id, wallet.address);

                // assert

                expect(
                    result.walletOwnerMsg?.includes('has been registered to a NFT Domain.')
                ).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).toBe(user);
            });
        });
        describe('Wallet listed on the NFDomain and owned by the discord user or not owned at all (valid wallet)', () => {
            beforeEach(() => {
                isWalletInvalid = false;
                mockRequest.mockResolvedValue({ data: [] });
            });
            it('should add the wallet', async () => {
                // act
                const result = await userRepo.addNewWalletToUser(
                    user.id,
                    generateAlgoWalletAddress()
                );

                // assert

                expect(result.walletOwnerMsg?.includes('Added.')).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBeNull();
            });
            it('adding multiple wallets should work as expected', async () => {
                // act
                expect(await algoWalletRepo.findAll()).toHaveLength(1);
                const result = await userRepo.addNewWalletToUser(user.id, wallet.address);
                const result2 = await userRepo.addNewWalletToUser(
                    user.id,
                    generateAlgoWalletAddress()
                );
                const result3 = await userRepo.addNewWalletToUser(
                    user.id,
                    generateAlgoWalletAddress()
                );

                // assert
                expect(result.walletOwnerMsg?.includes('refreshed.')).toBeTruthy();
                expect(result2.walletOwnerMsg?.includes('Added.')).toBeTruthy();
                expect(result3.walletOwnerMsg?.includes('Added.')).toBeTruthy();

                expect(result2.isWalletInvalid).toBe(isWalletInvalid);
                expect(result3.isWalletInvalid).toBe(isWalletInvalid);

                expect(result2.walletOwner).toBeNull();
                expect(result3.walletOwner).toBeNull();
                expect(await algoWalletRepo.findAll()).toHaveLength(3);
            });
            it('should not add the wallet', async () => {
                // act
                const result = await userRepo.addNewWalletToUser(user.id, wallet.address);

                // assert

                expect(result.walletOwnerMsg?.includes('has been refreshed.')).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBe(user);
            });
            it('should not add the wallet because the user is not found', async () => {
                // act
                expect.assertions(1);
                try {
                    await userRepo.addNewWalletToUser(
                        generateDiscordId(),
                        generateAlgoWalletAddress()
                    );
                } catch (error) {
                    expect(error).toHaveProperty('message', 'User not found.');
                }
            });

            it('should not add the wallet because its owned by another user', async () => {
                // act
                await userRepo.addNewWalletToUser(user.id, wallet.address);

                const newUser = await createRandomUser(db);
                const result = await userRepo.addNewWalletToUser(newUser.id, wallet.address);

                // assert

                expect(result.walletOwnerMsg?.includes('already owned by another')).toBeTruthy();

                expect(result.isWalletInvalid).not.toBe(isWalletInvalid);
                expect(result.walletOwner).toBe(user);
            });
        });
    });
    describe('removeWalletFromUser', () => {
        let wallet: AlgoWallet;
        let wallet2: AlgoWallet;
        beforeEach(async () => {
            const firstUser = await createRandomUserWithRandomWallet(db);
            user = firstUser.user;
            wallet = firstUser.wallet;
            const secondUser = await createRandomUserWithRandomWallet(db);
            wallet2 = secondUser.wallet;
            mockRequest.mockResolvedValue({ data: [] });
        });

        it('should not remove the wallet', async () => {
            // act
            let allWallets = await algoWalletRepo.findAll();
            expect(allWallets).toHaveLength(3);

            const result = await userRepo.removeWalletFromUser(user.id, wallet2.address);

            allWallets = await algoWalletRepo.findAll();
            expect(allWallets).toHaveLength(3);

            // assert
            expect(result.includes('You do not')).toBeTruthy();
        });
        it('should remove the wallet', async () => {
            let allWallets = await algoWalletRepo.findAll();
            expect(allWallets).toHaveLength(3);

            // act
            const result = await userRepo.removeWalletFromUser(user.id, wallet.address);

            allWallets = await algoWalletRepo.findAll();
            expect(allWallets).toHaveLength(2);

            // assert
            expect(result.includes('removed')).toBeTruthy();
        });
        it('should remove the wallet even if the user has multiple wallets', async () => {
            let ownerWallets = await userRepo.findByDiscordIDWithWallets(user.id);
            let allWallets = ownerWallets?.algoWallets.getItems();
            expect(allWallets).toHaveLength(1);

            const { wallet: userWallet2 } = await addRandomAssetAndWalletToUser(db, user);
            const { wallet: userWallet3 } = await addRandomAssetAndWalletToUser(db, user);

            let dbWallets = await algoWalletRepo.findAll();
            // its 6 because of the assets
            expect(dbWallets).toHaveLength(7);

            ownerWallets = await userRepo.findByDiscordIDWithWallets(user.id);
            allWallets = ownerWallets?.algoWallets.getItems();
            expect(allWallets).toHaveLength(3);

            // act
            const result = await userRepo.removeWalletFromUser(user.id, userWallet2.address);
            expect(result.includes('removed')).toBeTruthy();
            expect(result.includes(userWallet2.address)).toBeTruthy();
            dbWallets = await algoWalletRepo.findAll();
            // its 6 because of the assets
            expect(dbWallets).toHaveLength(6);
            db = orm.em.fork();
            userRepo = db.getRepository(User);
            algoWalletRepo = db.getRepository(AlgoWallet);

            ownerWallets = await userRepo.findByDiscordIDWithWallets(user.id);
            allWallets = ownerWallets?.algoWallets.getItems();
            // make sure that the correct wallet was removed

            expect(allWallets?.[0].address).toBe(wallet.address);
            expect(allWallets?.[1].address).toBe(userWallet3.address);
            expect(allWallets).toHaveLength(2);

            // assert
            expect(result.includes('removed')).toBeTruthy();
        });
        it('should not remove the wallet because the user is not found', async () => {
            try {
                await userRepo.removeWalletFromUser('12345', '11111');
            } catch (error) {
                expect(error).toHaveProperty(
                    'message',
                    `AlgoWallet not found ({ address: '11111' })`
                );
            }
        });
        it('should not remove the wallet if the user has unclaimed tokens', async () => {
            const randomASA = await createRandomASA(db);
            const algoStdTokenRepo = db.getRepository(AlgoStdToken);
            const getTokenFromAlgoNetwork = jest.spyOn(algoStdTokenRepo, 'getTokenFromAlgoNetwork');
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1000 });

            await algoStdTokenRepo.addAlgoStdToken(wallet, randomASA);
            await algoStdTokenRepo.addUnclaimedTokens(wallet, randomASA.id, 1000);
            const removed = await userRepo.removeWalletFromUser(user.id, wallet.address);
            expect(removed).toBe(
                'You have unclaimed tokens. Please check your wallet before removing it.'
            );
        });
    });
    describe('sync user wallets', () => {
        beforeEach(async () => {
            await createRandomWallet(db, user);
            await createRandomWallet(db, user);
            mockRequest.mockResolvedValue({ data: [] });
        });
        it('should not sync the wallets because the user is not found', async () => {
            // act
            const result = await userRepo.syncUserWallets('12345');
            // assert
            expect(result).toBe('User is not registered.');
        });
        it('should not sync the wallets because the user has no wallets', async () => {
            // act
            const user3 = await createRandomUser(db);
            const result = await userRepo.syncUserWallets(user3.id);
            // assert
            expect(result).toBe('No wallets found');
        });
        it('should sync the wallets', async () => {
            const addWalletAndSyncAssetsMock = jest.spyOn(userRepo, 'addWalletAndSyncAssets');
            addWalletAndSyncAssetsMock.mockResolvedValue('wallet synced');
            const result = await userRepo.syncUserWallets(user.id);
            // assert
            expect(result).toBe('wallet synced\nwallet synced\nwallet synced');
        });
    });
    describe('addWalletAndSyncAssets', () => {
        let wallet: AlgoWallet;
        beforeEach(async () => {
            wallet = await createRandomWallet(db, user);
            mockRequest.mockResolvedValue({ data: [] });
        });

        it('should refresh the wallet with the appropriate response', async () => {
            const response = {
                numberOfNFTAssetsAdded: 10,
                asaAssetsString: 'test',
            };
            const addAllAssetsToWalletMock = jest.spyOn(userRepo, 'addAllAssetsToWallet');
            addAllAssetsToWalletMock.mockResolvedValue(response);

            let result = await userRepo.addWalletAndSyncAssets(user, wallet.address);
            expect(result).toContain(inlineCode(wallet.address));
            expect(result).toContain('10');
            expect(result).toContain('test');
            expect(result).toContain('Synced');
            result = await userRepo.addWalletAndSyncAssets(user.id, wallet.address);
            expect(result).toContain(inlineCode(wallet.address));
            expect(result).toContain('10');
            expect(result).toContain('test');
            expect(result).toContain('Synced');
        });
        it('should return invalid because the NFDomain', async () => {
            const response = {
                numberOfNFTAssetsAdded: 10,
                asaAssetsString: 'test',
            };
            const expectedData = createNFDWalletRecords(
                wallet.address,
                undefined,
                generateDiscordId()
            );
            mockRequest.mockResolvedValueOnce({ data: expectedData });

            const addAllAssetsToWalletMock = jest.spyOn(userRepo, 'addAllAssetsToWallet');
            addAllAssetsToWalletMock.mockResolvedValue(response);
            const result = await userRepo.addWalletAndSyncAssets(user, wallet.address);
            expect(result).toContain(inlineCode(wallet.address));
            expect(result).toContain('NFT Domain');
        });
    });
});
