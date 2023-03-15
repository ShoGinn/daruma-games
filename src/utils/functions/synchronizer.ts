import { MikroORM } from '@mikro-orm/core';
import { User as DUser } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import logger from './LoggerFactory.js';
import { Guild } from '../../entities/Guild.entity.js';
import { User } from '../../entities/User.entity.js';
import { fetchGuild } from '../Utils.js';
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
    await userRepo.persistAndFlush(newUser);

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
export async function syncGuild(guildId: string, client: Client): Promise<void> {
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
    const guilds = client.guilds.cache;
    for (const guild of guilds) {
        await syncGuild(guild[1].id, client);
        const members = await guild[1].members.fetch();
        // remove bots from the members
        for (const member of members.filter(member => member.user.bot))
            members.delete(member[1].id);
        logger.info(`Loaded ${members.size} members from ${guild[1].name}`);
    }

    // remove deleted guilds
    const guildRepo = database.getRepository(Guild);
    const guildsData = await guildRepo.getActiveGuilds();
    for (const guildData of guildsData) {
        await syncGuild(guildData.id, client);
    }
}
