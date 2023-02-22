import type { PlayerRoundsData } from '../model/types/darumaTraining.js';
import {
    Entity,
    EntityRepository,
    EntityRepositoryType,
    Enum,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';
import { container } from 'tsyringe';

import { CustomBaseEntity } from './BaseEntity.entity.js';
import { GameTypes } from '../enums/dtEnums.js';
import { CustomCache } from '../services/CustomCache.js';
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
    async createEncounter(game: Game): Promise<number> {
        const gameData = game.playerArray.reduce((data, player) => {
            data[player.asset.id] = player.roundsData;
            return data;
        }, {} as Record<string, PlayerRoundsData>);

        const encounter = new DtEncounters(
            game.settings.channelId,
            game.settings.gameType,
            gameData
        );

        await this.persistAndFlush(encounter);
        return encounter.id;
    }
    async maxRoundsPerGameType(): Promise<Record<GameTypes, { id: number; maxRounds: number }>> {
        const gameData = await this.findAll();
        const result: Record<GameTypes, { id: number; maxRounds: number }> = {
            [GameTypes.OneVsNpc]: { id: 0, maxRounds: 0 },
            [GameTypes.OneVsOne]: { id: 0, maxRounds: 0 },
            [GameTypes.FourVsNpc]: { id: 0, maxRounds: 0 },
        };

        for (const entry of gameData) {
            const entryMinRounds = Math.min(
                ...Object.values(entry.gameData).map(data => data.gameWinRoundIndex + 1)
            );

            if (entryMinRounds > result[entry.gameType].maxRounds) {
                result[entry.gameType].id = entry.id;
                result[entry.gameType].maxRounds = entryMinRounds;
            }
        }

        return result;
    }

    /**
     * Returns the distribution of rounds per game type
     *
     * @returns {*}  {Promise<
     *         Record<GameTypes, Array<{ rounds: number; count: number }>>
     *     >}
     * @memberof DtEncountersRepository
     */
    async roundsDistributionPerGameType(): Promise<
        Record<GameTypes, Array<{ rounds: number; count: number }>>
    > {
        const cache = container.resolve(CustomCache);
        const cachedData = (await cache.get('roundsDistributionPerGameType')) as Record<
            GameTypes,
            Array<{
                rounds: number;
                count: number;
            }>
        >;
        if (cachedData) {
            return cachedData;
        }
        const gameData = await this.findAll();
        const result: Record<GameTypes, Array<{ rounds: number; count: number }>> = {
            [GameTypes.OneVsNpc]: [],
            [GameTypes.OneVsOne]: [],
            [GameTypes.FourVsNpc]: [],
        };

        for (const entry of gameData) {
            const entryMinRounds = Math.min(
                ...Object.values(entry.gameData).map(data => data.gameWinRoundIndex + 1)
            );

            const existingData = result[entry.gameType].find(
                data => data.rounds === entryMinRounds
            );
            if (existingData) {
                existingData.count++;
            } else {
                result[entry.gameType].push({ rounds: entryMinRounds, count: 1 });
            }
        }
        cache.set('roundsDistributionPerGameType', result);
        return result;
    }
}
