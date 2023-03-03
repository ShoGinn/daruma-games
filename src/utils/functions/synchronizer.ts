import { MikroORM } from '@mikro-orm/core';
import { User as DUser } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import logger from './LoggerFactory.js';
import { Guild } from '../../entities/Guild.entity.js';
import { User } from '../../entities/User.entity.js';
/**
 * Add a active user to the database if doesn't exist.
 *
 * @param {DUser} user
 * @returns {*}  {Promise<void>}
 */
export async function syncUser(user: DUser): Promise<void> {
    const db = container.resolve(MikroORM).em.fork();
    const userRepo = db.getRepository(User);

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
    const db = container.resolve(MikroORM).em.fork();

    const guildRepo = db.getRepository(Guild);
    const guildData = await guildRepo.findOne({ id: guildId, deleted: false });

    const fetchedGuild = await client.guilds.fetch(guildId).catch(() => null);

    //check if this guild exists in the database, if not it creates it (or recovers it from the deleted ones)
    if (!guildData) {
        const deletedGuildData = await guildRepo.findOne({
            id: guildId,
            deleted: true,
        });

        if (deletedGuildData) {
            // recover deleted guild
            deletedGuildData.deleted = false;
            await guildRepo.persistAndFlush(deletedGuildData);

            logger.info(`Guild recovered from the database: ${guildId}`);
        } else {
            // create new guild
            const newGuild = new Guild();
            newGuild.id = guildId;
            await guildRepo.persistAndFlush(newGuild);

            logger.info(`New guild added to the database: ${guildId}`);
        }
    } else if (!fetchedGuild) {
        // guild is deleted but still exists in the database
        guildData.deleted = true;
        await guildRepo.persistAndFlush(guildData);

        logger.info(`Guild deleted from the database: ${guildId}`);
    }
}

/**
 * Sync all guilds with the database.
 *
 * @param {Client} client
 * @returns {*}  {Promise<void>}
 */
export async function syncAllGuilds(client: Client): Promise<void> {
    const db = container.resolve(MikroORM).em.fork();

    // add missing guilds
    const guilds = client.guilds.cache;
    for (const guild of guilds) {
        await syncGuild(guild[1].id, client);
        const members = await guild[1].members.fetch();
        // remove bots from the members
        members.filter(member => member.user.bot).forEach(member => members.delete(member.id));
        logger.info(`Loaded ${members.size} members from ${guild[1].name}`);
    }

    // remove deleted guilds
    const guildRepo = db.getRepository(Guild);
    const guildsData = await guildRepo.getActiveGuilds();
    for (const guildData of guildsData) {
        await syncGuild(guildData.id, client);
    }
}
