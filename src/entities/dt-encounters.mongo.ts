import { Document, model, Schema, Types } from 'mongoose';

import { GameTypes } from '../enums/daruma-training.js';
import { PlayerRoundsData } from '../model/types/daruma-training.js';
import { Game } from '../utils/classes/dt-game.js';

export interface IDarumaTrainingEncounters extends Document {
  _id: Types.ObjectId;
  encounterDateTime: Date;
  channelId: string;
  gameType: GameTypes;
  gameData: Record<number, PlayerRoundsData>;
}
const dtEncountersSchema = new Schema<IDarumaTrainingEncounters>(
  {
    encounterDateTime: { type: Date, default: Date.now },
    channelId: String,
    gameType: { type: String, enum: Object.values(GameTypes), required: true },
    gameData: Schema.Types.Mixed,
  },
  { collection: 'dtEncounters' },
);

export const dtEncounters = model<IDarumaTrainingEncounters>('dtEncounters', dtEncountersSchema);

export async function createEncounter(game: Game): Promise<number> {
  const gameData: Record<number, PlayerRoundsData> = {};

  for (const player of game.state.playerManager.getAllPlayers()) {
    gameData[player.playableNFT.id] = player.roundsData;
  }
  await dtEncounters.create({
    channelId: game.settings.channelId,
    gameType: game.settings.gameType,
    gameData: gameData,
  });
  return await dtEncounters.countDocuments();
}

export async function getAllDtEncounters(): Promise<IDarumaTrainingEncounters[]> {
  return await dtEncounters.find().exec();
}
