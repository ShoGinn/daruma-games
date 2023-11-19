import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import { GameTypes } from '../../enums/daruma-training.js';
import { PlayerDiceRolls } from '../../types/daruma-training.js';

import { dtEncountersModel } from './dt-encounters.js';
import { DarumaTrainingEncountersRepository } from './dt-encounters.repo.js';

describe('Daruma Training Encounters Repo', () => {
  let mongoServer: MongoMemoryServer;
  let dtEncountersRepo: DarumaTrainingEncountersRepository;
  const playerDiceRolls: PlayerDiceRolls = { rolls: [1, 2, 3, 4, 5] };
  const gameType = GameTypes.OneVsNpc;
  const channelId = '123';
  const gameData = { 1: playerDiceRolls };
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    dtEncountersRepo = new DarumaTrainingEncountersRepository();
  });
  afterEach(async () => {
    await dtEncountersModel.deleteMany({});
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  describe('getAll', () => {
    it('should return an empty array when no encounters are found', async () => {
      const encounters = await dtEncountersRepo.getAll();
      expect(encounters).toEqual([]);
    });
    it('should return an array of encounters', async () => {
      await dtEncountersModel.create({ channelId, gameType, gameData });
      const encounters = await dtEncountersRepo.getAll();
      expect(encounters[0].gameData).toEqual(gameData);
      expect(encounters[0].gameType).toEqual(gameType);
      expect(encounters[0].channelId).toEqual(channelId);
    });
    it('should return all encounters', async () => {
      await dtEncountersModel.create({ channelId: '123', gameType, gameData });
      await dtEncountersModel.create({ channelId: '456', gameType, gameData });
      const encounters = await dtEncountersRepo.getAll();
      expect(encounters).toHaveLength(2);
    });
  });
  describe('create', () => {
    it('should create an encounter', async () => {
      await dtEncountersRepo.create({ channelId, gameType, gameData });
      const encounters = await dtEncountersRepo.getAll();
      expect(encounters[0].gameData).toEqual(gameData);
      expect(encounters[0].gameType).toEqual(gameType);
      expect(encounters[0].channelId).toEqual(channelId);
    });
  });
});
