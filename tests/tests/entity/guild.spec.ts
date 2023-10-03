import { EntityManager, MikroORM } from '@mikro-orm/core';

import { Guild, GuildRepository } from '../../../src/entities/guild.entity.js';
import { initORM } from '../../utils/bootstrap.js';

describe('guild tests that require db', () => {
	let orm: MikroORM;
	let database: EntityManager;
	let guildRepo: GuildRepository;
	beforeAll(async () => {
		orm = await initORM();
	});
	afterAll(async () => {
		await orm.close(true);
	});
	beforeEach(async () => {
		await orm.schema.clearDatabase();
		database = orm.em.fork();
		guildRepo = database.getRepository(Guild);
	});
	// sourcery skip: avoid-function-declarations-in-blocks
	function refreshRepos(): void {
		database = orm.em.fork();
		guildRepo = database.getRepository(Guild);
	}
	it('should add a guild to the database', async () => {
		const guild = await guildRepo.createNewGuild('test-guild');
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
		await database.persistAndFlush(guild);
		refreshRepos();
		// Interaction is a date that is set when the guild is created
		expect(guild.lastInteract).toBeInstanceOf(Date);
		await guildRepo.updateLastInteract(guild.id);
		const currentDateTime = new Date();
		expect(guild?.lastInteract.getTime()).toBeCloseTo(
			currentDateTime.getTime(),
			-3,
		); // verify that the stored date is within 3 milliseconds of the current date
		expect(guild.lastInteract).not.toBeUndefined();
	});
	it('get all active guilds', async () => {
		const guild = new Guild();
		guild.id = 'test-guild';
		await database.persistAndFlush(guild);
		refreshRepos();
		const guild2 = new Guild();
		guild2.id = 'test-guild2';
		await database.persistAndFlush(guild2);
		refreshRepos();
		const guild3 = new Guild();
		guild3.id = 'test-guild3';
		await database.persistAndFlush(guild3);
		refreshRepos();
		const guild4 = new Guild();
		guild4.id = 'test-guild4';
		await database.persistAndFlush(guild4);
		refreshRepos();

		const guilds = await guildRepo.getActiveGuilds();
		expect(guilds).toHaveLength(4);
		guild4.deleted = true;
		await database.persistAndFlush(guild4);
		refreshRepos();
		const guilds2 = await guildRepo.getActiveGuilds();
		expect(guilds2).toHaveLength(3);
	});
	it('should delete a guild', async () => {
		const guild = new Guild();
		guild.id = 'test-guild';
		await database.persistAndFlush(guild);
		refreshRepos();
		await guildRepo.markGuildDeleted(guild.id);
		const deletedGuild = await guildRepo.getGuild(guild.id);
		expect(deletedGuild.deleted).toBe(true);
	});
	it('should recover a deleted guild', async () => {
		const guild = new Guild();
		guild.id = 'test-guild';
		await database.persistAndFlush(guild);
		refreshRepos();
		guild.deleted = true;
		await database.persistAndFlush(guild);
		refreshRepos();
		await guildRepo.recoverGuildMarkedDeleted(guild.id);
		const recoveredGuild = await guildRepo.getGuild(guild.id);
		expect(recoveredGuild.deleted).toBe(false);
	});
});
