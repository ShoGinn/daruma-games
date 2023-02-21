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
        beforeEach(async () => {
            user = await createRandomUser(db);
            wallet = await createRandomWallet(user, db);
        });
        describe('When the wallet is not on the NFDomain', () => {
            let walletOwnedByDiscordUser: boolean;
            beforeEach(() => {
                walletOwnedByDiscordUser = false;
                jest.spyOn(userRepo, 'checkNFDomainOwnership').mockResolvedValueOnce(
                    walletOwnedByDiscordUser
                );
            });
            it('should return valid wallet (can be registered) not on the NFDomain with a null owner if an invalid user is passed', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser('12345', '12345');

                // assert
                expect(result).toHaveProperty('walletOwnedByDiscordUser', walletOwnedByDiscordUser);
                expect(result).toHaveProperty('walletOwner', null);
                expect(result).toHaveProperty('isWalletInvalid', !walletOwnedByDiscordUser);
            });

            it('should return expected values when wallet is not found in the database or NF Domain', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, '12345');

                // assert
                expect(result).toHaveProperty('walletOwnedByDiscordUser', walletOwnedByDiscordUser);
                expect(result).toHaveProperty('isWalletInvalid', !walletOwnedByDiscordUser);
                expect(result).toHaveProperty('walletOwner', null);
            });
            it('should return expected values when wallet is invalid on NFDomain', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, wallet.address);

                // assert
                expect(result).toHaveProperty('walletOwnedByDiscordUser', walletOwnedByDiscordUser);
                expect(result).toHaveProperty('walletOwner', user);
                expect(result).toHaveProperty('isWalletInvalid', !walletOwnedByDiscordUser);
            });
            it('should return expected values when wallet is owned by another user and not valid NF Domain', async () => {
                const walletOwner = await createRandomUser(db);

                // act
                const result = await userRepo.walletOwnedByAnotherUser(
                    walletOwner.id,
                    wallet.address
                );

                // assert
                expect(result).toHaveProperty('walletOwnedByDiscordUser', walletOwnedByDiscordUser);
                expect(result).toHaveProperty('isWalletInvalid', !walletOwnedByDiscordUser);
                expect(result).toHaveProperty('walletOwner', user);
            });
        });
        describe('When the wallet is on the NFDomain', () => {
            let walletOwnedByDiscordUser: boolean;
            beforeEach(() => {
                walletOwnedByDiscordUser = true;
                jest.spyOn(userRepo, 'checkNFDomainOwnership').mockResolvedValueOnce(
                    walletOwnedByDiscordUser
                );
            });

            it('should return expected values when wallet is not found in the database but found in the NF Domain', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, '12345');

                // assert
                expect(result).toHaveProperty('walletOwnedByDiscordUser', walletOwnedByDiscordUser);
                expect(result).toHaveProperty('isWalletInvalid', !walletOwnedByDiscordUser);
                expect(result).toHaveProperty('walletOwner', null);
            });

            it('should return expected values when wallet is valid on NFDomain', async () => {
                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, wallet.address);

                // assert
                expect(result).toHaveProperty('walletOwnedByDiscordUser', walletOwnedByDiscordUser);
                expect(result).toHaveProperty('isWalletInvalid', !walletOwnedByDiscordUser);
                expect(result).toHaveProperty('walletOwner', user);
            });
            it('should return expected values when wallet is owned by another user and valid NF Domain', async () => {
                const walletOwner = await createRandomUser(db);

                // act
                const result = await userRepo.walletOwnedByAnotherUser(
                    walletOwner.id,
                    wallet.address
                );

                // assert
                expect(result).toHaveProperty('walletOwnedByDiscordUser', walletOwnedByDiscordUser);
                expect(result).toHaveProperty('isWalletInvalid', walletOwnedByDiscordUser);
                expect(result).toHaveProperty('walletOwner', user);
            });
        });
    });
    describe('addWalletToUser', () => {
        let user: User;
        let wallet: AlgoWallet;
        beforeEach(async () => {
            user = await createRandomUser(db);
            wallet = await createRandomWallet(user, db);
        });
        describe('When the wallet is not on the NFDomain', () => {
            let walletOwnedByDiscordUser: boolean;
            beforeEach(() => {
                walletOwnedByDiscordUser = false;
                jest.spyOn(userRepo, 'checkNFDomainOwnership').mockResolvedValueOnce(
                    walletOwnedByDiscordUser
                );
            });
            it('should not add a wallet to a user because the user does not own the wallet that is registered in the NFD and the user does not exist on the server', async () => {
                // act
                const result = await userRepo.addWalletToUser(user.id, '12345');

                // assert
                expect(result.msg.includes('has been registered to a NFT Domain.')).toBeTruthy();
                expect(result).toHaveProperty('isWalletInvalid', true);
                expect(result).toHaveProperty('walletOwner', null);
            });
            it('should not add a wallet to a user because the user does not own the wallet that is registered in the NFD', async () => {
                // act
                const result = await userRepo.addWalletToUser(user.id, wallet.address);

                // assert
                expect(result.msg.includes('has been registered to a NFT Domain.')).toBeTruthy();
                expect(result).toHaveProperty('isWalletInvalid', true);
                expect(result).toHaveProperty('walletOwner', user);
            });
        });
        describe('When the wallet is not on the NFDomain', () => {
            let walletOwnedByDiscordUser: boolean;
            beforeEach(() => {
                walletOwnedByDiscordUser = true;
                jest.spyOn(userRepo, 'checkNFDomainOwnership').mockResolvedValue(
                    walletOwnedByDiscordUser
                );
            });
            it('should add the user.', async () => {
                // act
                const result = await userRepo.addWalletToUser(user.id, '12345');

                // assert
                expect(result.msg.includes('Added.')).toBeTruthy();
                expect(result).toHaveProperty('isWalletInvalid', false);
                expect(result).toHaveProperty('walletOwner', null);
            });
            it('should not add the user but refresh it.', async () => {
                // act
                const result = await userRepo.addWalletToUser(user.id, wallet.address);

                // assert
                expect(result.msg.includes('has been refreshed.')).toBeTruthy();
                expect(result).toHaveProperty('isWalletInvalid', false);
                expect(result).toHaveProperty('walletOwner', user);
            });
            it('should not add the user because its owned by another user', async () => {
                // act
                const newUser = await createRandomUser(db);

                await userRepo.addWalletToUser(user.id, wallet.address);
                const result = await userRepo.addWalletToUser(newUser.id, wallet.address);

                // assert
                expect(result.msg.includes('already owned by another')).toBeTruthy();
                expect(result).toHaveProperty('isWalletInvalid', true);
                expect(result).toHaveProperty('walletOwner', user);
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
