import { EntityManager, MikroORM } from '@mikro-orm/core';

import { User, UserRepository } from '../../../src/entities/User.entity.js';
import { initORM } from '../../utils/bootstrap.js';
import { createRandomUser, createRandomWallet } from '../../utils/testFuncs.js';

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
            const wallet = await createRandomWallet(db, user);
            const foundUser = await userRepo.findByWallet(wallet.address);
            expect(foundUser).not.toBeNull();
        });
    });
    describe('findByDiscordIDWithWallets', () => {
        it('should return a user by discord id with no wallets', async () => {
            const user = await createRandomUser(db);
            const foundUser = await userRepo.findByDiscordIDWithWallets(user.id);
            expect(foundUser?.algoWallets).toHaveLength(0);
            expect(foundUser).not.toBeNull();
        });

        it('should return a user by discord id with wallets', async () => {
            const user = await createRandomUser(db);
            const wallet = await createRandomWallet(db, user);
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
    describe('Pre-token function tests', () => {
        let user: User;
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
