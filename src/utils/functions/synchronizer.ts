import { MikroORM } from '@mikro-orm/core';
import { User as DUser } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import logger from './logger-factory.js';
import { Guild } from '../../entities/guild.entity.js';
import { User } from '../../entities/user.entity.js';
import { fetchGuild } from '../utils.js';
/**
 * Add a active user to the database if doesn't exist.
 *
 * @param {DUser} user
 * @returns {*}  {Promise<void>}
 */
export async function syncUser(user: DUser): Promise<void> {
	const database = container.resolve(MikroORM).em.fork();
	const userRepo = database.getRepository(User);

	const userData = await userRepo.findOne({
		id: user.id,
	});

	if (userData) {
		return;
	}
	// add user to the db
	const newUser = new User(user.id);
	await database.persistAndFlush(newUser);

	logger.info(`New user added to the database: ${user.tag} (${user.id})`);
	return;
}

/**
 * Sync a guild with the database.
 *
 * @param {string} guildId
 * @param {Client} client
 * @returns {*}  {Promise<void>}
 */
export async function syncGuild(
	guildId: string,
	client: Client,
): Promise<void> {
	const database = container.resolve(MikroORM).em.fork();

	const guildRepo = database.getRepository(Guild);
	const guildData = await guildRepo.findOne({ id: guildId });
	const fetchedGuild = await fetchGuild(guildId, client);

	if (!guildData) {
		await guildRepo.createNewGuild(guildId);
	} else if (fetchedGuild) {
		await guildRepo.recoverGuildMarkedDeleted(guildId);
	} else {
		await guildRepo.markGuildDeleted(guildId);
	}
}

/**
 * Sync all guilds with the database.
 *
 * @param {Client} client
 * @returns {*}  {Promise<void>}
 */
export async function syncAllGuilds(client: Client): Promise<void> {
	const database = container.resolve(MikroORM).em.fork();

	// add missing guilds
	const guilds = client.guilds.cache.values();
	for (const guild of guilds) {
		await syncGuild(guild.id, client);
		const members = (await guild.members.fetch())
		// remove bots from the members
		
		for (const member of members.filter((member) => member.user.bot).map((member) => member.id))
			members.delete(member);
		logger.info(`Loaded ${members.size} members from ${guild.name}`);
	}

	// remove deleted guilds
	const guildRepo = database.getRepository(Guild);
	const guildsData = await guildRepo.getActiveGuilds();
	for (const guildData of guildsData) {
		await syncGuild(guildData.id, client);
	}
}
