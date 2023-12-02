import { model } from 'mongoose';

import { dtEncountersSchema, IDarumaTrainingEncounters } from './dt-encounters.schema.js';

export const dtEncountersModel = model<IDarumaTrainingEncounters>(
  'dtEncounters',
  dtEncountersSchema,
);
