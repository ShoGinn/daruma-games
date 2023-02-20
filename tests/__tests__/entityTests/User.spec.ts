import { EntityManager, MikroORM } from '@mikro-orm/core';

import { User, UserRepository } from '../../../src/entities/User.entity.js';
import { NFDomainsManager } from '../../../src/model/framework/manager/NFDomains.js';
import { initORM } from '../../utils/bootstrap.js';
import { createRandomUser, createRandomWallet } from '../../utils/testFuncs.js';
describe('User tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let userRepo: UserRepository;
    let nfDomainsManager: NFDomainsManager;
    beforeAll(async () => {
        orm = await initORM();
        nfDomainsManager = new NFDomainsManager();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        db = orm.em.fork();
        userRepo = db.getRepository(User);
    });
    it('should update last interact', async () => {
        const user = await createRandomUser(db);
        // Interaction is a date that is set when the guild is created
        expect(user.lastInteract).toBeInstanceOf(Date);
        await userRepo.updateLastInteract(user.id);
        const currentDateTime = new Date();
        expect(user?.lastInteract.getTime()).toBeCloseTo(currentDateTime.getTime(), -3); // verify that the stored date is within 3 milliseconds of the current date
        expect(user.lastInteract).not.toBeUndefined();
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
