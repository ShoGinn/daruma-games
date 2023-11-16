import { HydratedDocument, Schema } from 'mongoose';

import { GameTypes } from '../../enums/daruma-training.js';

export interface IDarumaTrainingChannel {
  _id: string;
  gameType: GameTypes;
  guild: string;
}

export const darumaTrainingChannelSchema = new Schema<IDarumaTrainingChannel>(
  {
    _id: { type: String, required: true },
    gameType: { type: String, enum: Object.values(GameTypes), required: true },
    guild: { type: String, required: true },
  },
  { collection: 'dtChannels' },
);

export type DarumaTrainingChannel = HydratedDocument<IDarumaTrainingChannel>;
