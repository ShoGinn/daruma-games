import {
    Entity,
    EntityRepository,
    EntityRepositoryType,
    Enum,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';

import { GameTypes } from '../enums/dtEnums.js';
import { Game } from '../utils/classes/dtGame.js';
import { CustomBaseEntity } from './BaseEntity.js';

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => DtEncountersRepository })
export class DtEncounters extends CustomBaseEntity {
    [EntityRepositoryType]?: DtEncountersRepository;

    @PrimaryKey()
    id: number;

    @Property()
    channelId!: string;

    @Enum({ items: () => GameTypes })
    gameType!: GameTypes;

    @Property({ type: 'json' })
    gameData: Record<string, DarumaTrainingPlugin.PlayerRoundsData>;
    constructor(channelId: string, gameType: GameTypes) {
        super();
        this.channelId = channelId;
        this.gameType = gameType;
    }
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DtEncountersRepository extends EntityRepository<DtEncounters> {
    async createEncounter(game: Game): Promise<number> {
        const encounter = new DtEncounters(game.settings.channelId, game.settings.gameType);
        let gameData: Record<string, DarumaTrainingPlugin.PlayerRoundsData> = {};
        game.playerArray.forEach(player => {
            gameData[player.asset.assetIndex] = player.roundsData;
        });
        encounter.gameData = gameData;
        await this.persistAndFlush(encounter);
        return encounter.id;
    }
}
