import {
    Entity,
    EntityRepository,
    EntityRepositoryType,
    Enum,
    Loaded,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';

import { GameTypes } from '../enums/dtEnums.js';
import { CustomBaseEntity } from './BaseEntity.js';

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => DarumaTrainingChannelRepository })
export class DarumaTrainingChannel extends CustomBaseEntity {
    [EntityRepositoryType]?: DarumaTrainingChannelRepository;

    @PrimaryKey({ autoincrement: false })
    channelId!: string;

    @Property()
    messageId?: string;

    @Enum({ items: () => GameTypes })
    gameType!: GameTypes;

    @Property({ nullable: true, type: 'json' })
    overRides?: DarumaTrainingPlugin.ChannelSettings | null = null;
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DarumaTrainingChannelRepository extends EntityRepository<DarumaTrainingChannel> {
    async getAllChannels(): Promise<Loaded<DarumaTrainingChannel, never>[]> {
        return await this.findAll();
    }
    async updateMessageId(channelId: string, messageId: string): Promise<DarumaTrainingChannel> {
        const channel = await this.findOneOrFail({ channelId });
        channel.messageId = messageId;
        await this.persistAndFlush(channel);
        return channel;
    }
    async addChannel(
        channelId: string,
        gameType: GameTypes,
        overRides?: DarumaTrainingPlugin.ChannelSettings
    ): Promise<DarumaTrainingChannel> {
        const channel = new DarumaTrainingChannel();
        channel.channelId = channelId;
        channel.messageId = '';
        channel.gameType = gameType;
        channel.overRides = overRides;
        await this.persistAndFlush(channel);
        return channel;
    }
    async removeChannel(channelId: string): Promise<boolean> {
        // Check if channel exists
        try {
            const channel = await this.findOneOrFail({ channelId });
            await this.removeAndFlush(channel);
            return true;
        } catch (error) {
            return false;
        }
    }
    async getChannelMessageId(channelId: string): Promise<string> {
        const channel = await this.findOne({ channelId });
        if (channel) {
            return channel.messageId;
        } else {
            return null;
        }
    }
}
