import { inject, injectable, singleton } from 'tsyringe';

import { DarumaTrainingEncountersRepository } from '../database/dt-encounter/dt-encounters.repo.js';
import { DarumaTrainingEncounters } from '../database/dt-encounter/dt-encounters.schema.js';
import { GameTypes } from '../enums/daruma-training.js';
import { PlayerDiceRolls } from '../types/daruma-training.js';
import { Player } from '../utils/classes/dt-player.js';

@singleton()
@injectable()
export class DarumaTrainingEncountersService {
  constructor(
    @inject(DarumaTrainingEncountersRepository)
    private dtEncountersRepository: DarumaTrainingEncountersRepository,
  ) {}
  async getAll(): Promise<DarumaTrainingEncounters[] | []> {
    return await this.dtEncountersRepository.getAll();
  }
  async create(players: Player[], channelId: string, gameType: GameTypes): Promise<number> {
    const gameData: Record<number, PlayerDiceRolls> = {};

    for (const player of players) {
      gameData[player.playableNFT._id] = player.rollsData;
    }
    return await this.dtEncountersRepository.create({
      channelId,
      gameType,
      gameData,
    });
  }
}
