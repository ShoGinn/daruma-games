import type { PlayerRoundsData } from '../model/types/daruma-training.js';
import {
  Entity,
  EntityRepository,
  EntityRepositoryType,
  Enum,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';

import { CustomBaseEntity } from './base.entity.js';
import { GameTypes } from '../enums/daruma-training.js';
import { Game } from '../utils/classes/dt-game.js';

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => DtEncountersRepository })
export class DtEncounters extends CustomBaseEntity {
  [EntityRepositoryType]?: DtEncountersRepository;

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

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DtEncountersRepository extends EntityRepository<DtEncounters> {
  async createEncounter(game: Game): Promise<DtEncounters> {
    const gameData: Record<string, PlayerRoundsData> = {};
    const em = this.getEntityManager();

    for (const player of game.players) {
      gameData[player.playableNFT.id] = player.roundsData;
    }
    const encounter = new DtEncounters(game.settings.channelId, game.settings.gameType, gameData);

    await em.persistAndFlush(encounter);
    return encounter;
  }
}
