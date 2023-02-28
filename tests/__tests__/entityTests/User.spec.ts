import { EntityManager, MikroORM } from '@mikro-orm/core';
import mockAxios from 'axios';

import { AlgoStdToken } from '../../../src/entities/AlgoStdToken.entity.js';
import { AlgoWallet, AlgoWalletRepository } from '../../../src/entities/AlgoWallet.entity.js';
import { User, UserRepository } from '../../../src/entities/User.entity.js';
import { createNFDWalletRecords } from '../../mocks/mockNFDData.js';
import { initORM } from '../../utils/bootstrap.js';
import {
    createRandomASA,
    createRandomUser,
    createRandomUserWithRandomWallet,
    createRandomWallet,
    generateAlgoWalletAddress,
    generateDiscordId,
} from '../../utils/testFuncs.js';
jest.mock('axios');

describe('Simple User tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let userRepo: UserRepository;

    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        db = orm.em.fork();
        userRepo = db.getRepository(User);
    });
    describe('updateLastInteract', () => {
        it('should update last interact', async () => {
            const user = await createRandomUser(db);
            // Interaction is a date that is set when the guild is created
            expect(user.lastInteract).toBeInstanceOf(Date);
            await userRepo.updateLastInteract(user.id);
            const currentDateTime = new Date();
            expect(user?.lastInteract.getTime()).toBeCloseTo(currentDateTime.getTime(), -3); // verify that the stored date is within 3 milliseconds of the current date
            expect(user.lastInteract).not.toBeUndefined();
        });
    });
    describe('getAllUsers', () => {
        it('should return all users', async () => {
            const users = await userRepo.getAllUsers();
            // It will return 0 because of the constraint
            expect(users).toHaveLength(0);
            //we must create a new user that has an Id that replicates a discord id
            await createRandomUser(db);
            const users2 = await userRepo.getAllUsers();
            expect(users2).toHaveLength(1);
        });
    });
    describe('getUserById', () => {
        it('should return a user by id', async () => {
            const user = await createRandomUser(db);
            const foundUser = await userRepo.getUserById(user.id);
            expect(foundUser).not.toBeNull();
        });
    });
    describe('findByWallet', () => {
        it('should return a user by wallet', async () => {
            const user = await createRandomUser(db);
            const wallet = await createRandomWallet(user, db);
            const foundUser = await userRepo.findByWallet(wallet.address);
            expect(foundUser).not.toBeNull();
        });
    });
});
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
    });

    describe('findByDiscordIDWithWallets', () => {
        it('should return a user by discord id with no wallets', async () => {
            const user = await createRandomUser(db);
            const foundUser = await userRepo.findByDiscordIDWithWallets(user.id);
            expect(foundUser?.algoWallets).toHaveLength(0);
            expect(foundUser).not.toBeNull();
        });
        it('should return a user by discord id who has a wallet but its not added', async () => {
            const user = await createRandomUser(db);
            await createRandomWallet(user, db);
            const foundUser = await userRepo.findByDiscordIDWithWallets(user.id);
            expect(foundUser?.algoWallets).toHaveLength(0);
            expect(foundUser).not.toBeNull();
        });

        it('should return a user by discord id with wallets', async () => {
            const user = await createRandomUser(db);
            const wallet = await createRandomWallet(user, db);
            user.algoWallets.add(wallet);
            await db.persistAndFlush(user);
            const foundUser = await userRepo.findByDiscordIDWithWallets(user.id);
            expect(foundUser?.algoWallets).toHaveLength(1);
            expect(foundUser).not.toBeNull();
        });
        it('should return null because there is no user with that id', async () => {
            const foundUser = await userRepo.findByDiscordIDWithWallets('12345');
            expect(foundUser?.algoWallets).toBeUndefined();
            expect(foundUser).toBeNull();
        });
    });
    describe('walletOwnedByAnotherUser', () => {
        let isWalletOwnedByOtherDiscordID: boolean;
        let isWalletInvalid: boolean;
        beforeEach(async () => {
            user = await createRandomUser(db);
            wallet = await createRandomWallet(user, db);
        });
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

        beforeEach(async () => {
            user = await createRandomUser(db);
            wallet = await createRandomWallet(user, db);
        });
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
                const result = await userRepo.addWalletToUser(user.id, generateAlgoWalletAddress());

                // assert
                expect(
                    result.walletOwnerMsg?.includes('has been registered to a NFT Domain.')
                ).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBeNull();
            });
            it('should not add a wallet to a user because the user does not own the wallet that is registered in the NFD', async () => {
                // act
                const result = await userRepo.addWalletToUser(user.id, wallet.address);

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
                const result = await userRepo.addWalletToUser(user.id, generateAlgoWalletAddress());

                // assert

                expect(result.walletOwnerMsg?.includes('Added.')).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBeNull();
            });
            it.skip('adding multiple wallets should work as expected', async () => {
                // act
                expect(await algoWalletRepo.findAll()).toHaveLength(1);
                const result = await userRepo.addWalletToUser(user.id, wallet.address);
                const result2 = await userRepo.addWalletToUser(
                    user.id,
                    generateAlgoWalletAddress()
                );
                const result3 = await userRepo.addWalletToUser(
                    user.id,
                    generateAlgoWalletAddress()
                );

                // assert
                expect(result.walletOwnerMsg?.includes('Added.')).toBeTruthy();
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
                const result = await userRepo.addWalletToUser(user.id, wallet.address);

                // assert

                expect(result.walletOwnerMsg?.includes('has been refreshed.')).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBe(user);
            });
            it('should not add the wallet because the user is not found', async () => {
                // act
                expect.assertions(1);
                try {
                    await userRepo.addWalletToUser(
                        generateDiscordId(),
                        generateAlgoWalletAddress()
                    );
                } catch (error) {
                    expect(error).toHaveProperty('message', 'User not found.');
                }
            });

            it('should not add the wallet because its owned by another user', async () => {
                // act
                await userRepo.addWalletToUser(user.id, wallet.address);

                const newUser = await createRandomUser(db);
                const result = await userRepo.addWalletToUser(newUser.id, wallet.address);

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
            expect(allWallets.length).toBe(2);

            const result = await userRepo.removeWalletFromUser(user.id, wallet2.address);

            allWallets = await algoWalletRepo.findAll();
            expect(allWallets.length).toBe(2);

            // assert
            expect(result.includes('You do not')).toBeTruthy();
        });
        it('should remove the wallet', async () => {
            let allWallets = await algoWalletRepo.findAll();
            expect(allWallets.length).toBe(2);

            // act
            const result = await userRepo.removeWalletFromUser(user.id, wallet.address);

            allWallets = await algoWalletRepo.findAll();
            expect(allWallets.length).toBe(1);

            // assert
            expect(result.includes('removed')).toBeTruthy();
        });
        it.skip('should remove the wallet even if the user has multiple wallets', async () => {
            let ownerWallets = await userRepo.findByDiscordIDWithWallets(user.id);
            let allWallets = ownerWallets?.algoWallets.getItems();
            expect(allWallets?.length).toBe(1);

            const wallet3 = await createRandomWallet(user, db);
            const wallet4 = await createRandomWallet(user, db);

            const dbWallets = await algoWalletRepo.findAll();
            expect(dbWallets.length).toBe(4);

            ownerWallets = await userRepo.findByDiscordIDWithWallets(user.id);
            allWallets = ownerWallets?.algoWallets.getItems();
            expect(allWallets?.length).toBe(1);

            // add the other 2 wallets
            await userRepo.addWalletToUser(user.id, wallet3.address);
            await userRepo.addWalletToUser(user.id, wallet4.address);
            ownerWallets = await userRepo.findByDiscordIDWithWallets(user.id);
            allWallets = ownerWallets?.algoWallets.getItems();
            expect(allWallets?.length).toBe(3);

            // act
            const result = await userRepo.removeWalletFromUser(user.id, wallet3.address);

            ownerWallets = await userRepo.findByDiscordIDWithWallets(user.id);
            allWallets = ownerWallets?.algoWallets.getItems();
            // make sure that the correct wallet was removed

            expect(allWallets?.[0].address).toBe(wallet.address);
            expect(allWallets?.[1].address).toBe(wallet2.address);
            expect(allWallets?.[2].address).toBe(wallet4.address);
            expect(allWallets?.length).toBe(3);

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
            await algoStdTokenRepo.addAlgoStdToken(wallet, randomASA, 1000, true);
            await algoStdTokenRepo.addUnclaimedTokens(wallet, randomASA.id, 1000);
            const removed = await userRepo.removeWalletFromUser(user.id, wallet.address);
            expect(removed).toBe(
                'You have unclaimed tokens. Please check your wallet before removing it.'
            );
        });
    });
    describe('Pre-token function tests', () => {
        beforeEach(async () => {
            user = await createRandomUser(db);
        });
        describe('User Artifacts', () => {
            it('should increase the user artifact count by 1', async () => {
                const artifactIncrement = await userRepo.updateUserPreToken(user.id, 1);
                const userAfter = await userRepo.getUserById(user.id);
                expect(userAfter.preToken).toBe(1);
                expect(artifactIncrement).toBe('1');
            });
            it('should increase the user artifact count by 1000', async () => {
                const artifactIncrement = await userRepo.updateUserPreToken(user.id, 1000);
                const userAfter = await userRepo.getUserById(user.id);
                expect(userAfter.preToken).toBe(1000);
                expect(artifactIncrement).toBe('1,000');
            });
            it('should decrease the user artifact count by 1', async () => {
                await userRepo.updateUserPreToken(user.id, 1000);
                const testAmount = 5;
                const artifactIncrement = await userRepo.updateUserPreToken(user.id, -testAmount);
                const userAfter = await userRepo.getUserById(user.id);
                expect(userAfter.preToken).toBe(995);
                expect(artifactIncrement).toBe('995');
            });
            it('should throw an error because you cannot have less than 0 artifacts', async () => {
                try {
                    await userRepo.updateUserPreToken(user.id, -1);
                } catch (e) {
                    expect(e).toHaveProperty(
                        'message',
                        'Not enough artifacts. You have 0 artifacts.'
                    );
                }
            });
        });
    });
});
