import {
  Entity,
  EntityRepositoryType,
  Enum,
  PrimaryKey,
  Property,
} from '@mikro-orm/core'
import { EntityRepository } from '@mikro-orm/sqlite'
import { GameTypes } from '@utils/functions'

import { CustomBaseEntity } from './BaseEntity'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => DarumaTrainingChannelRepository })
export class DarumaTrainingChannel extends CustomBaseEntity {
  [EntityRepositoryType]?: DarumaTrainingChannelRepository

  @PrimaryKey({ autoincrement: false })
  channelId!: string

  @Property()
  messageId?: string

  @Enum({ items: () => GameTypes })
  gameType!: GameTypes

  @Property({ nullable: true, type: 'json' })
  overRides?: DarumaTrainingPlugin.ChannelSettings | null = null
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DarumaTrainingChannelRepository extends EntityRepository<DarumaTrainingChannel> {
  async getAllChannels() {
    return await this.findAll()
  }
  async updateMessageId(
    channelId: string,
    messageId: string
  ): Promise<DarumaTrainingChannel> {
    const channel = await this.findOneOrFail({ channelId })
    channel.messageId = messageId
    await this.persistAndFlush(channel)
    return channel
  }
  async addChannel(
    channelId: string,
    gameType: GameTypes,
    overRides?: DarumaTrainingPlugin.ChannelSettings
  ): Promise<DarumaTrainingChannel> {
    const channel = new DarumaTrainingChannel()
    channel.channelId = channelId
    channel.messageId = ''
    channel.gameType = gameType
    channel.overRides = overRides
    await this.persistAndFlush(channel)
    return channel
  }
  async removeChannel(channelId: string): Promise<void> {
    await this.nativeDelete({
      channelId,
    })
  }
}
