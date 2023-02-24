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

import { CustomBaseEntity } from './BaseEntity.entity.js';
import { DarumaTrainingChannel } from './DtChannel.entity.js';

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
