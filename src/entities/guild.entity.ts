import {
    Collection,
    Entity,
    EntityRepository,
    EntityRepositoryType,
    Loaded,
    OneToMany,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';

import { CustomBaseEntity } from './base.entity.js';
import { DarumaTrainingChannel } from './dt-channel.entity.js';
import logger from '../utils/functions/logger-factory.js';

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => GuildRepository })
export class Guild extends CustomBaseEntity {
    [EntityRepositoryType]?: GuildRepository;

    @PrimaryKey({ autoincrement: false })
    id!: string;

    @OneToMany(() => DarumaTrainingChannel, dojo => dojo.guild)
    dojos = new Collection<DarumaTrainingChannel>(this);

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    @Property()
    deleted: boolean = false;

    @Property()
    lastInteract: Date = new Date();
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class GuildRepository extends EntityRepository<Guild> {
    async createNewGuild(guildId: string): Promise<Guild> {
        const newGuild = new Guild();
        newGuild.id = guildId;
        await this.persistAndFlush(newGuild);

        logger.info(`New guild added to the database: ${guildId}`);
        return newGuild;
    }
    async recoverGuildMarkedDeleted(guildId: string): Promise<void> {
        const deletedGuildData = await this.findOne({ id: guildId, deleted: true });
        if (deletedGuildData) {
            deletedGuildData.deleted = false;
            await this.persistAndFlush(deletedGuildData);

            logger.info(`Guild recovered from the database: ${guildId}`);
        }
    }
    async markGuildDeleted(guildId: string): Promise<void> {
        const guild = await this.findOne({ id: guildId });
        if (guild) {
            guild.deleted = true;
            await this.persistAndFlush(guild);
            logger.info(`Guild deleted from the database: ${guildId}`);
        }
    }
    async updateLastInteract(guildId?: string): Promise<void> {
        const guild = await this.findOne({ id: guildId });

        if (guild) {
            guild.lastInteract = new Date();
            await this.flush();
        }
    }

    async getActiveGuilds(): Promise<Array<Loaded<Guild, never>>> {
        return await this.find({ deleted: false });
    }
    async getGuild(guildId: string): Promise<Loaded<Guild, never>> {
        return await this.findOneOrFail({ id: guildId });
    }
}
