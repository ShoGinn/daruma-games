import {
    Entity,
    EntityRepository,
    EntityRepositoryType,
    Enum,
    Loaded,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';

import { CustomBaseEntity } from './BaseEntity.js';
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
    messageId?: string;

    @Enum({ items: () => GameTypes })
    gameType!: GameTypes;
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DarumaTrainingChannelRepository extends EntityRepository<DarumaTrainingChannel> {
    async getAllChannels(): Promise<Loaded<DarumaTrainingChannel, never>[]> {
        return await this.findAll();
    }
    async updateMessageId(channelId: string, messageId: string): Promise<DarumaTrainingChannel> {
        const channel = await this.findOneOrFail({ id: channelId });
        channel.messageId = messageId;
        await this.persistAndFlush(channel);
        return channel;
    }
    async addChannel(channelId: string, gameType: GameTypes): Promise<DarumaTrainingChannel> {
        const channel = new DarumaTrainingChannel();
        channel.id = channelId;
        channel.messageId = '';
        channel.gameType = gameType;
        await this.persistAndFlush(channel);
        return channel;
    }
    async removeChannel(channelId: string): Promise<boolean> {
        // Check if channel exists
        try {
            const channel = await this.findOneOrFail({ id: channelId });
            await this.removeAndFlush(channel);
            return true;
        } catch (error) {
            return false;
        }
    }
    async getChannelMessageId(channelId: string): Promise<string> {
        const channel = await this.findOne({ id: channelId });
        return channel ? channel.messageId : null;
    }
}
