import {
  Entity,
  EntityRepositoryType,
  Enum,
  PrimaryKey,
  Property,
} from '@mikro-orm/core'
import { EntityRepository } from '@mikro-orm/sqlite'
import { Game } from '@utils/classes'
import { GameTypes, IdtAssetRounds } from '@utils/functions'

import { CustomBaseEntity } from './BaseEntity'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => DtEncountersRepository })
export class DtEncounters extends CustomBaseEntity {
  [EntityRepositoryType]?: DtEncountersRepository

  @PrimaryKey()
  id: number

  @Property()
  channelId!: string

  @Enum({ items: () => GameTypes })
  gameType!: GameTypes

  @Property({ type: 'json' })
  gameData: IdtAssetRounds
  constructor(channelId: string, gameType: GameTypes) {
    super()
    this.channelId = channelId
    this.gameType = gameType
  }
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DtEncountersRepository extends EntityRepository<DtEncounters> {
  async createEncounter(game: Game) {
    const encounter = new DtEncounters(
      game.settings.channelId,
      game.settings.gameType
    )
    let gameData: IdtAssetRounds = {}
    game.playerArray.forEach(player => {
      gameData[player.asset.assetIndex] = player.roundsData
    })
    encounter.gameData = gameData
    await this.persistAndFlush(encounter)
    return encounter.id
  }
}
