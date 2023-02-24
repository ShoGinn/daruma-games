import { EntityManager, MikroORM } from '@mikro-orm/core';

import { Guild, GuildRepository } from '../../../src/entities/Guild.entity.js';
import { initORM } from '../../utils/bootstrap.js';

describe('guild tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let guildRepo: GuildRepository;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        db = orm.em.fork();
        guildRepo = db.getRepository(Guild);
    });
    it('should add a guild to the database', async () => {
        const guild = new Guild();
        guild.id = 'test-guild';
        await guildRepo.persistAndFlush(guild);
        const newGuild = await guildRepo.getGuild(guild.id);
        expect(await guildRepo.findAll()).toHaveLength(1);
        expect(newGuild.id).toBe('test-guild');
        expect(newGuild.dojos).toHaveLength(0);
        expect(newGuild.deleted).toBe(false);
    });
    it('should throw an error if the guild does not exist', async () => {
        await expect(guildRepo.getGuild('test-guild')).rejects.toThrowError();
    });
    it('should update the last interaction time', async () => {
        const guild = new Guild();
        guild.id = 'test-guild';
        await guildRepo.persistAndFlush(guild);
        // Interaction is a date that is set when the guild is created
        expect(guild.lastInteract).toBeInstanceOf(Date);
        await guildRepo.updateLastInteract(guild.id);
        const currentDateTime = new Date();
        expect(guild?.lastInteract.getTime()).toBeCloseTo(currentDateTime.getTime(), -3); // verify that the stored date is within 3 milliseconds of the current date
        expect(guild.lastInteract).not.toBeUndefined();
    });
    it('get all active guilds', async () => {
        const guild = new Guild();
        guild.id = 'test-guild';
        await guildRepo.persistAndFlush(guild);
        const guild2 = new Guild();
        guild2.id = 'test-guild2';
        await guildRepo.persistAndFlush(guild2);
        const guild3 = new Guild();
        guild3.id = 'test-guild3';
        await guildRepo.persistAndFlush(guild3);
        const guild4 = new Guild();
        guild4.id = 'test-guild4';
        await guildRepo.persistAndFlush(guild4);

        const guilds = await guildRepo.getActiveGuilds();
        expect(guilds.length).toBe(4);
        guild4.deleted = true;
        await guildRepo.persistAndFlush(guild4);
        const guilds2 = await guildRepo.getActiveGuilds();
        expect(guilds2.length).toBe(3);
    });
});
