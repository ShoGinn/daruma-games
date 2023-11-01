import type { PlayerRoundsData } from '../model/types/daruma-training.js';
import { Entity, Enum, PrimaryKey, Property } from '@mikro-orm/core';

import { CustomBaseEntity } from './base.entity.js';
import { GameTypes } from '../enums/daruma-training.js';

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity()
export class DtEncounters extends CustomBaseEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  channelId!: string;

  @Enum({ items: () => GameTypes })
  gameType!: GameTypes;

  @Property({ type: 'json' })
  gameData: Record<string, PlayerRoundsData>;
  constructor(channelId: string, gameType: GameTypes, gameData?: Record<string, PlayerRoundsData>) {
    super();
    this.channelId = channelId;
    this.gameType = gameType;
    this.gameData = gameData ?? {};
  }
}
