import type { PlayerRoundsData } from '../model/types/darumaTraining.js';
import {
    Entity,
    EntityRepository,
    EntityRepositoryType,
    Enum,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';

import { CustomBaseEntity } from './BaseEntity.entity.js';
import { GameTypes } from '../enums/dtEnums.js';
import { Game } from '../utils/classes/dtGame.js';

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
    constructor(
        channelId: string,
        gameType: GameTypes,
        gameData?: Record<string, PlayerRoundsData>
    ) {
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
        const gameData = game.playerArray.reduce((data, player) => {
            data[player.playableNFT.id] = player.roundsData;
            return data;
        }, {} as Record<string, PlayerRoundsData>);

        const encounter = new DtEncounters(
            game.settings.channelId,
            game.settings.gameType,
            gameData
        );

        await this.persistAndFlush(encounter);
        return encounter;
    }
}
