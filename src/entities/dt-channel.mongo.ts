import { Document, model, Schema } from 'mongoose';

import { GameTypes } from '../enums/daruma-training.js';

export interface IDarumaTrainingChannel extends Document {
  _id: string;
  gameType: GameTypes;
  guild: string;
}

const darumaTrainingChannelSchema = new Schema<IDarumaTrainingChannel>(
  {
    _id: { type: String, required: true },
    gameType: { type: String, enum: Object.values(GameTypes), required: true },
    guild: { type: String, required: true },
  },
  { collection: 'dtChannels' },
);

export const darumaTrainingChannel = model<IDarumaTrainingChannel>(
  'darumaTrainingChannel',
  darumaTrainingChannelSchema,
);
