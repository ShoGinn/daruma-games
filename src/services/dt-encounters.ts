import { inject, injectable, singleton } from 'tsyringe';

import { DarumaTrainingEncountersRepository } from '../database/dt-encounter/dt-encounters.repo.js';
import { DarumaTrainingEncounters } from '../database/dt-encounter/dt-encounters.schema.js';
import { PlayerDiceRolls } from '../types/daruma-training.js';
import { Game } from '../utils/classes/dt-game.js';

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
  async create(game: Game): Promise<number> {
    const gameData: Record<number, PlayerDiceRolls> = {};

    for (const player of game.state.playerManager.getAllPlayers()) {
      gameData[player.playableNFT._id] = player.rollsData;
    }
    return await this.dtEncountersRepository.create({
      channelId: game.settings.channelId,
      gameType: game.settings.gameType,
      gameData,
    });
  }
}
