import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { Guild } from '../../src/entities/Guild.entity.js';
import { User } from '../../src/entities/User.entity.js';
import { syncAllGuilds, syncGuild, syncUser } from '../../src/utils/functions/synchronizer.js';
import { Mock } from '../mocks/mockDiscord.js';
import { initORM } from '../utils/bootstrap.js';

describe('Sync Users and Guilds', () => {
    let orm: MikroORM;
    let db: EntityManager;
    const mock = container.resolve(Mock);
    const user = mock.getUser();
    const guild = mock.getGuild();
    let client = mock.getClient() as Client;
    beforeAll(async () => {
        orm = await initORM();
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        db = orm.em.fork();
    });
    afterAll(async () => {
        await orm.close(true);
        jest.restoreAllMocks();
    });
    describe('syncUser', () => {
        it('should add a new user to the database', async () => {
            const userRepo = db.getRepository(User);
            await syncUser(user);
            const dbUser = await userRepo.findOne({ id: user.id });
            expect(dbUser?.id).toBe(user.id);
            const allUsers = await userRepo.findAll();
            expect(allUsers.length).toBe(1);
        });
        it('should not add a user to the database if they already exist', async () => {
            const userRepo = db.getRepository(User);
            await syncUser(user);
            await syncUser(user);
            const dbUser = await userRepo.findOne({ id: user.id });
            expect(dbUser?.id).toBe(user.id);
            const allUsers = await userRepo.findAll();
            expect(allUsers.length).toBe(1);
        });
    });
    describe('syncGuild', () => {
        it('should add a new guild to the database', async () => {
            const guildRepo = db.getRepository(Guild);
            await syncGuild('123456789', client);
            const dbGuild = await guildRepo.findOne({ id: '123456789' });
            expect(dbGuild?.id).toBe('123456789');
            const allGuilds = await guildRepo.findAll();
            expect(allGuilds.length).toBe(1);
        });
        it('should not add a guild to the database if they already exist', async () => {
            const guildRepo = db.getRepository(Guild);
            await syncGuild('123456789', client);
            const dbGuild = await guildRepo.findOne({ id: '123456789' });
            expect(dbGuild?.id).toBe('123456789');
            const allGuilds = await guildRepo.findAll();
            expect(allGuilds.length).toBe(1);
        });
        it('should delete a guild from the database if it is not found', async () => {
            await syncGuild(guild.id, client);
            const guildRepo = db.getRepository(Guild);
            client.guilds.fetch = jest.fn().mockRejectedValueOnce(undefined);
            await syncGuild(guild.id, client);
            const dbGuild = await guildRepo.findOne({ id: guild.id });
            expect(dbGuild?.deleted).toBe(true);
        });
        it('should recover a guild from the database if it is found', async () => {
            await syncGuild(guild.id, client);
            client.guilds.fetch = jest.fn().mockRejectedValueOnce(undefined);
            await syncGuild(guild.id, client);
            client.guilds.fetch = jest.fn().mockResolvedValueOnce(guild.id);
            await syncGuild(guild.id, client);
            //const db2 = orm.em.fork();
            const guildRepo = db.getRepository(Guild);
            const dbGuild = await guildRepo.findOne({ id: guild.id });
            expect(dbGuild?.deleted).toBe(false);
        });
    });
    describe('syncAllGuilds', () => {
        it('should add all guilds to the database', async () => {
            client = mock.getClient(true) as Client;
            const guildRepo = db.getRepository(Guild);
            await syncAllGuilds(client);
            const dbGuild = await guildRepo.findOne({ id: guild.id });
            expect(dbGuild?.id).toBe(guild.id);
            const allGuilds = await guildRepo.findAll();
            expect(allGuilds.length).toBe(1);
        });
    });
});
