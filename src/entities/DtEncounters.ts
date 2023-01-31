import {
    Entity,
    EntityRepository,
    EntityRepositoryType,
    Enum,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';

import { CustomBaseEntity } from './BaseEntity.js';
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
    gameData: Record<string, DarumaTrainingPlugin.PlayerRoundsData>;
    constructor(
        channelId: string,
        gameType: GameTypes,
        gameData?: Record<string, DarumaTrainingPlugin.PlayerRoundsData>
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
    async createEncounter(game: Game): Promise<number> {
        const gameData = game.playerArray.reduce((data, player) => {
            data[player.asset.id] = player.roundsData;
            return data;
        }, {} as Record<string, DarumaTrainingPlugin.PlayerRoundsData>);

        const encounter = new DtEncounters(
            game.settings.channelId,
            game.settings.gameType,
            gameData
        );

        await this.persistAndFlush(encounter);
        return encounter.id;
    }
}
