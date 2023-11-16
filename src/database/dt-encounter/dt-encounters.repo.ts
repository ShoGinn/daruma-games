import { singleton } from 'tsyringe';

import { dtEncountersModel } from './dt-encounters.js';
import { DarumaTrainingEncounters, IDarumaTrainingEncounters } from './dt-encounters.schema.js';

@singleton()
export class DarumaTrainingEncountersRepository {
  async getAll(): Promise<DarumaTrainingEncounters[]> {
    return await dtEncountersModel.find().exec();
  }

  async create(encounter: IDarumaTrainingEncounters): Promise<number> {
    await dtEncountersModel.create(encounter);
    return await dtEncountersModel.countDocuments();
  }
}
