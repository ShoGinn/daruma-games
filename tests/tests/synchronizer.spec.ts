import { EntityManager, MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { User } from '../../src/entities/user.entity.js';
import { syncUser } from '../../src/utils/functions/synchronizer.js';
import { Mock } from '../mocks/mock-discord.js';
import { initORM } from '../utils/bootstrap.js';

describe('Sync Users and Guilds', () => {
  let orm: MikroORM;
  let database: EntityManager;
  const mock = container.resolve(Mock);
  const user = mock.getUser();
  beforeAll(async () => {
    orm = await initORM();
  });
  beforeEach(async () => {
    await orm.schema.clearDatabase();
    database = orm.em.fork();
  });
  afterAll(async () => {
    await orm.close(true);
    jest.restoreAllMocks();
  });
  describe('syncUser', () => {
    test('should add a new user to the database', async () => {
      const userRepo = database.getRepository(User);
      await syncUser(user);
      const databaseUser = await userRepo.findOne({ id: user.id });
      expect(databaseUser?.id).toBe(user.id);
      const allUsers = await userRepo.findAll();
      expect(allUsers).toHaveLength(1);
    });
    test('should not add a user to the database if they already exist', async () => {
      const userRepo = database.getRepository(User);
      await syncUser(user);
      await syncUser(user);
      const databaseUser = await userRepo.findOne({ id: user.id });
      expect(databaseUser?.id).toBe(user.id);
      const allUsers = await userRepo.findAll();
      expect(allUsers).toHaveLength(1);
    });
  });
});
