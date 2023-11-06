import { Document, model, Schema, Types } from 'mongoose';

import { GameTypes } from '../enums/daruma-training.js';
import { PlayerDiceRolls } from '../model/types/daruma-training.js';
import { Game } from '../utils/classes/dt-game.js';

export interface IDarumaTrainingEncounters extends Document {
  _id: Types.ObjectId;
  dt: Date;
  channelId: string;
  gameType: GameTypes;
  gameData: Record<number, PlayerDiceRolls>;
}
const dtEncountersSchema = new Schema<IDarumaTrainingEncounters>(
  {
    dt: { type: Date, default: Date.now },
    channelId: { type: String, required: true },
    gameType: { type: String, enum: Object.values(GameTypes), required: true },
    gameData: { type: Schema.Types.Mixed, required: true },
  },
  { collection: 'dtEncounters' },
);

export const dtEncounters = model<IDarumaTrainingEncounters>('dtEncounters', dtEncountersSchema);

/*
Static
*/

export async function createEncounter(game: Game): Promise<number> {
  const gameData: Record<number, PlayerDiceRolls> = {};

  for (const player of game.state.playerManager.getAllPlayers()) {
    gameData[player.playableNFT.id] = player.rollsData;
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
