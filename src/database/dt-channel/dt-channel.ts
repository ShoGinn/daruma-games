import { model } from 'mongoose';

import { darumaTrainingChannelSchema, IDarumaTrainingChannel } from './dt-channel.schema.js';

export const darumaTrainingChannelModel = model<IDarumaTrainingChannel>(
  'darumaTrainingChannel',
  darumaTrainingChannelSchema,
);
