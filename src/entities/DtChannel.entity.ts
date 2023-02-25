import {
    Entity,
    EntityRepository,
    EntityRepositoryType,
    Enum,
    Loaded,
    ManyToOne,
    MikroORM,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';
import { GuildChannel, TextBasedChannel } from 'discord.js';
import { container } from 'tsyringe';

import { CustomBaseEntity } from './BaseEntity.entity.js';
import { Guild } from './Guild.entity.js';
import { GameTypes } from '../enums/dtEnums.js';

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => DarumaTrainingChannelRepository })
export class DarumaTrainingChannel extends CustomBaseEntity {
    [EntityRepositoryType]?: DarumaTrainingChannelRepository;

    @PrimaryKey({ autoincrement: false })
    id!: string;

    @Property()
    messageId!: string;

    @Enum({ items: () => GameTypes })
    gameType!: GameTypes;

    @ManyToOne(() => Guild, { ref: true })
    guild!: Guild;
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DarumaTrainingChannelRepository extends EntityRepository<DarumaTrainingChannel> {
    async getAllChannels(): Promise<Array<Loaded<DarumaTrainingChannel, never>>> {
        return await this.findAll();
    }
    async getAllChannelsInGuild(
        guildId: string
    ): Promise<Array<Loaded<DarumaTrainingChannel, never>>> {
        const em = container.resolve(MikroORM).em.fork();
        const guildRepo = em.getRepository(Guild);
        const currentGuild = await guildRepo.getGuild(guildId);
        return await this.find({
            guild: currentGuild,
        });
    }
    async getChannel(
        channel: TextBasedChannel | GuildChannel
    ): Promise<Loaded<DarumaTrainingChannel, never>> {
        return await this.findOneOrFail({ id: channel.id });
    }
    async getChannelMessageId(channelId: string | undefined): Promise<string> {
        const channel = await this.findOne({ id: channelId });
        return channel ? channel.messageId : '';
    }

    async updateMessageId(channelId: string, messageId: string): Promise<DarumaTrainingChannel> {
        const channel = await this.findOneOrFail({ id: channelId });
        channel.messageId = messageId;
        await this.persistAndFlush(channel);
        return channel;
    }

    async getGuild<T>(channel: T): Promise<Loaded<Guild, never>> {
        const em = container.resolve(MikroORM).em.fork();
        const guildRepo = em.getRepository(Guild);
        if (channel instanceof GuildChannel) {
            return await guildRepo.getGuild(channel.guild.id);
        } else if (typeof channel === 'string') {
            return await guildRepo.getGuild(channel);
        } else {
            throw new Error('Invalid channel type');
        }
    }
    async addChannel(channel: GuildChannel, gameType: GameTypes): Promise<DarumaTrainingChannel> {
        const dojo = new DarumaTrainingChannel();
        dojo.id = channel.id;
        dojo.gameType = gameType;
        dojo.messageId = '';
        dojo.guild = await this.getGuild(channel);
        await this.persistAndFlush(dojo);
        return dojo;
    }
    async removeChannel(channel: TextBasedChannel | GuildChannel): Promise<boolean> {
        // Check if channel exists
        try {
            const channelId = await this.findOneOrFail({ id: channel.id });
            await this.removeAndFlush(channelId);
            return true;
        } catch (error) {
            return false;
        }
    }
}
