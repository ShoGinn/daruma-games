import { EntityManager, MikroORM } from '@mikro-orm/core';

import { AlgoWallet } from '../../../src/entities/AlgoWallet.entity.js';
import { User, UserRepository } from '../../../src/entities/User.entity.js';
import { initORM } from '../../utils/bootstrap.js';
import { createRandomUser, createRandomWallet } from '../../utils/testFuncs.js';
describe('User tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let userRepo: UserRepository;
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
    describe('walletOwnedByAnotherUser', () => {
        let user: User;
        let wallet: AlgoWallet;
        let walletOwnedByDiscordUser: boolean;
        let isWalletInvalid: boolean;

        beforeEach(async () => {
            user = await createRandomUser(db);
            wallet = await createRandomWallet(user, db);
        });
        describe('Wallet listed on the NFDomain and NOT owned by the discord user (invalid wallet)', () => {
            beforeEach(() => {
                walletOwnedByDiscordUser = false;
                isWalletInvalid = true;
                jest.spyOn(userRepo, 'checkNFDomainOwnership').mockResolvedValueOnce(
                    walletOwnedByDiscordUser
                );
            });
            it('should return null user because the wallet is not in the db', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, '12345');

                // assert
                expect(result.walletOwnedByDiscordUser).toBe(walletOwnedByDiscordUser);
                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).toBeNull();
            });
            it('should return user because the wallet is in the db', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, wallet.address);

                // assert
                expect(result.walletOwnedByDiscordUser).toBe(walletOwnedByDiscordUser);
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
                expect(result.walletOwnedByDiscordUser).toBe(walletOwnedByDiscordUser);
                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).not.toBe(walletOwner);
            });
        });
        describe('Wallet listed on the NFDomain and owned by the discord user or not owned at all (valid wallet)', () => {
            beforeEach(() => {
                walletOwnedByDiscordUser = true;
                isWalletInvalid = false;
                jest.spyOn(userRepo, 'checkNFDomainOwnership').mockResolvedValueOnce(
                    walletOwnedByDiscordUser
                );
            });

            it('should return null user because the wallet is not in the db', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, '12345');

                // assert
                expect(result.walletOwnedByDiscordUser).toBe(walletOwnedByDiscordUser);
                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).toBeNull();
            });

            it('should return user because the wallet is in the db', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, wallet.address);

                // assert
                expect(result.walletOwnedByDiscordUser).toBe(walletOwnedByDiscordUser);
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
                expect(result.walletOwnedByDiscordUser).toBe(walletOwnedByDiscordUser);

                expect(result.isWalletInvalid).not.toBe(isWalletInvalid);

                expect(result.walletOwner).not.toBe(walletOwner);
            });
        });
    });
    describe('addWalletToUser', () => {
        let user: User;
        let wallet: AlgoWallet;
        let walletOwnedByDiscordUser: boolean;
        let isWalletInvalid: boolean;

        beforeEach(async () => {
            user = await createRandomUser(db);
            wallet = await createRandomWallet(user, db);
        });
        describe('Wallet listed on the NFDomain and NOT owned by the discord user (invalid wallet)', () => {
            beforeEach(() => {
                walletOwnedByDiscordUser = false;
                isWalletInvalid = true;
                jest.spyOn(userRepo, 'checkNFDomainOwnership').mockResolvedValueOnce(
                    walletOwnedByDiscordUser
                );
            });
            it('should not add a wallet to a user because the user does not own the wallet that is registered in the NFD and the user does not exist on the server', async () => {
                // act
                const result = await userRepo.addWalletToUser(user.id, '12345');

                // assert
                expect(result.msg.includes('has been registered to a NFT Domain.')).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBeNull();
            });
            it('should not add a wallet to a user because the user does not own the wallet that is registered in the NFD', async () => {
                // act
                const result = await userRepo.addWalletToUser(user.id, wallet.address);

                // assert
                expect(result.msg.includes('has been registered to a NFT Domain.')).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).toBe(user);
            });
        });
        describe('Wallet listed on the NFDomain and owned by the discord user or not owned at all (valid wallet)', () => {
            beforeEach(() => {
                walletOwnedByDiscordUser = true;
                isWalletInvalid = false;
                jest.spyOn(userRepo, 'checkNFDomainOwnership').mockResolvedValue(
                    walletOwnedByDiscordUser
                );
            });
            it('should add the wallet', async () => {
                // act
                const result = await userRepo.addWalletToUser(user.id, '12345');

                // assert
                expect(result.msg.includes('Added.')).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBeNull();
            });
            it('should not add the wallet', async () => {
                // act
                const result = await userRepo.addWalletToUser(user.id, wallet.address);

                // assert
                expect(result.msg.includes('has been refreshed.')).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBe(user);
            });
            it('should not add the wallet because its owned by another user', async () => {
                // act
                const newUser = await createRandomUser(db);

                await userRepo.addWalletToUser(user.id, wallet.address);
                const result = await userRepo.addWalletToUser(newUser.id, wallet.address);

                // assert
                expect(result.msg.includes('already owned by another')).toBeTruthy();

                expect(result.isWalletInvalid).not.toBe(isWalletInvalid);
                expect(result.walletOwner).toBe(user);
            });
        });
    });
    describe('removeWalletFromUser', () => {
        let user: User;
        let user2: User;
        let wallet: AlgoWallet;
        let wallet2: AlgoWallet;
        beforeEach(async () => {
            user = await createRandomUser(db);
            wallet = await createRandomWallet(user, db);
            user2 = await createRandomUser(db);
            wallet2 = await createRandomWallet(user2, db);
        });

        it('should not remove the wallet', async () => {
            // act

            const result = await userRepo.removeWalletFromUser(user.id, wallet2.address);

            // assert
            expect(result.includes('You do not')).toBeTruthy();
        });
        it('should remove the wallet', async () => {
            // act
            const result = await userRepo.removeWalletFromUser(user.id, wallet.address);
            // assert
            expect(result.includes('removed')).toBeTruthy();
        });
    });
});
