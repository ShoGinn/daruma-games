import { HydratedDocument, Schema, Types } from 'mongoose';

import { GameTypes } from '../../enums/daruma-training.js';
import { PlayerDiceRolls } from '../../types/daruma-training.js';

export interface IDarumaTrainingEncounters {
  _id?: Types.ObjectId;
  dt?: Date;
  channelId: string;
  gameType: GameTypes;
  gameData: Record<number, PlayerDiceRolls>;
}
export const dtEncountersSchema = new Schema<IDarumaTrainingEncounters>(
  {
    dt: { type: Date, default: Date.now },
    channelId: { type: String, required: true },
    gameType: { type: String, enum: Object.values(GameTypes), required: true },
    gameData: { type: Schema.Types.Mixed, required: true },
  },
  { collection: 'dtEncounters' },
);

export type DarumaTrainingEncounters = HydratedDocument<IDarumaTrainingEncounters>;
