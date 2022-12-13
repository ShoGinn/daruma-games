import { User as DUser } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { Guild } from '../../entities/Guild.js';
import { User } from '../../entities/User.js';
import { Database } from '../../services/Database.js';
import logger from './LoggerFactory.js';
/**
 * Add a active user to the database if doesn't exist.
 * @param user
 */
export async function syncUser(user: DUser): Promise<void> {
    const db = container.resolve(Database);
    const userRepo = db.get(User);

    const userData = await userRepo.findOne({
        id: user.id,
    });

    if (!userData) {
        // add user to the db
        const newUser = new User();
        newUser.id = user.id;
        await userRepo.persistAndFlush(newUser);

        logger.info(`New user added to the database: ${user.tag} (${user.id})`);
    }
}

/**
 * Sync a guild with the database.
 * @param guildId
 * @param client
 */
export async function syncGuild(guildId: string, client: Client): Promise<void> {
    const db = container.resolve(Database);

    const guildRepo = db.get(Guild),
        guildData = await guildRepo.findOne({ id: guildId, deleted: false });

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
 * @param client
 */
export async function syncAllGuilds(client: Client): Promise<void> {
    const db = container.resolve(Database);

    // add missing guilds
    const guilds = client.guilds.cache;
    for (const guild of guilds) {
        await syncGuild(guild[1].id, client);
    }

    // remove deleted guilds
    const guildRepo = db.get(Guild);
    const guildsData = await guildRepo.getActiveGuilds();
    for (const guildData of guildsData) {
        await syncGuild(guildData.id, client);
    }
}
