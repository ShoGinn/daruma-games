import { EntityManager, MikroORM } from '@mikro-orm/core';

import { mockCustomCache } from '../../tests/mocks/mockCustomCache.js';
import { initORM } from '../../tests/utils/bootstrap.js';
import { createRandomUser, createRandomWallet } from '../../tests/utils/testFuncs.js';
import { User, UserRepository } from '../User.entity.js';
jest.mock('../../services/CustomCache', () => ({
    CustomCache: jest.fn().mockImplementation(() => mockCustomCache),
}));

describe('asset tests that require db', () => {
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
        it('should update the last interact', async () => {
            const user = await createRandomUser(db);
            const lastInteract = user.lastInteract;
            await userRepo.updateLastInteract(user.id);
            const updatedUser = await userRepo.findOneOrFail(user.id);
            expect(updatedUser.lastInteract).not.toEqual(lastInteract);
        });
    });
    describe('getAllUsers', () => {
        it('should return all users', async () => {
            await createRandomUser(db);
            const users = await userRepo.getAllUsers();
            // It will return 0 because of the constraint
            expect(users).toHaveLength(0);
            //we must create a new user that has an Id that replicates a discord id
            const newUser = new User('123456789012345678');
            await db.persistAndFlush(newUser);
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
