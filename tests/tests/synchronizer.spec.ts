import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { Guild } from '../../src/entities/guild.entity.js';
import { User } from '../../src/entities/user.entity.js';
import { syncAllGuilds, syncGuild, syncUser } from '../../src/utils/functions/synchronizer.js';
import { Mock } from '../mocks/mock-discord.js';
import { initORM } from '../utils/bootstrap.js';

describe('Sync Users and Guilds', () => {
  let orm: MikroORM;
  let database: EntityManager;
  const mock = container.resolve(Mock);
  const user = mock.getUser();
  const guild = mock.getGuild();
  let client = mock.getClient() as Client;
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
    it('should add a new user to the database', async () => {
      const userRepo = database.getRepository(User);
      await syncUser(user);
      const databaseUser = await userRepo.findOne({ id: user.id });
      expect(databaseUser?.id).toBe(user.id);
      const allUsers = await userRepo.findAll();
      expect(allUsers.length).toBe(1);
    });
    it('should not add a user to the database if they already exist', async () => {
      const userRepo = database.getRepository(User);
      await syncUser(user);
      await syncUser(user);
      const databaseUser = await userRepo.findOne({ id: user.id });
      expect(databaseUser?.id).toBe(user.id);
      const allUsers = await userRepo.findAll();
      expect(allUsers.length).toBe(1);
    });
  });
  describe('syncGuild', () => {
    it('should add a new guild to the database', async () => {
      const guildRepo = database.getRepository(Guild);
      await syncGuild('123456789', client);
      const databaseGuild = await guildRepo.findOne({ id: '123456789' });
      expect(databaseGuild?.id).toBe('123456789');
      const allGuilds = await guildRepo.findAll();
      expect(allGuilds.length).toBe(1);
    });
    it('should not add a guild to the database if they already exist', async () => {
      const guildRepo = database.getRepository(Guild);
      await syncGuild('123456789', client);
      const databaseGuild = await guildRepo.findOne({ id: '123456789' });
      expect(databaseGuild?.id).toBe('123456789');
      const allGuilds = await guildRepo.findAll();
      expect(allGuilds.length).toBe(1);
    });
    it('should delete a guild from the database if it is not found', async () => {
      await syncGuild(guild.id, client);
      const guildRepo = database.getRepository(Guild);
      client.guilds.fetch = jest.fn().mockRejectedValueOnce(null);
      await syncGuild(guild.id, client);
      const databaseGuild = await guildRepo.findOne({ id: guild.id });
      expect(databaseGuild?.deleted).toBe(true);
    });
    it('should recover a guild from the database if it is found', async () => {
      await syncGuild(guild.id, client);
      client.guilds.fetch = jest.fn().mockRejectedValueOnce(null);
      await syncGuild(guild.id, client);
      client.guilds.fetch = jest.fn().mockResolvedValueOnce(guild.id);
      await syncGuild(guild.id, client);
      //const db2 = orm.em.fork();
      const guildRepo = database.getRepository(Guild);
      const databaseGuild = await guildRepo.findOne({ id: guild.id });
      expect(databaseGuild?.deleted).toBe(false);
    });
  });
  describe('syncAllGuilds', () => {
    it('should add all guilds to the database', async () => {
      client = mock.getClient(true) as Client;
      const guildRepo = database.getRepository(Guild);
      await syncAllGuilds(client);
      const databaseGuild = await guildRepo.findOne({ id: guild.id });
      expect(databaseGuild?.id).toBe(guild.id);
      const allGuilds = await guildRepo.findAll();
      expect(allGuilds.length).toBe(1);
    });
  });
});
