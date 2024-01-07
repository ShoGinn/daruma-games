import { singleton } from 'tsyringe';

import { dtEncountersModel } from './dt-encounters.js';
import { DarumaTrainingEncounters, IDarumaTrainingEncounters } from './dt-encounters.schema.js';

@singleton()
export class DarumaTrainingEncountersRepository {
  async getAll(): Promise<DarumaTrainingEncounters[] | []> {
    return await dtEncountersModel.find().exec();
  }
  async getAllByDate(date: Date): Promise<DarumaTrainingEncounters[] | []> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);
    return await dtEncountersModel
      .find({
        dt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      })
      .exec();
  }
  async create(encounter: IDarumaTrainingEncounters): Promise<number> {
    await dtEncountersModel.create(encounter);
    return await dtEncountersModel.countDocuments();
  }
}
