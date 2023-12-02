import { mongoFixture } from '../../../tests/fixtures/mongodb-fixture.js';
import { GameTypes } from '../../enums/daruma-training.js';

import { darumaTrainingChannelModel } from './dt-channel.js';
import { DarumaTrainingChannelRepository } from './dt-channel.repo.js';

describe('Daruma Training Channel Repository', () => {
  mongoFixture(darumaTrainingChannelModel);
  let dtChannelRepo: DarumaTrainingChannelRepository;
  const dtChannel = {
    _id: '1',
    gameType: GameTypes.OneVsNpc,
    guild: '1',
  };
  const dtChannel2 = {
    _id: '2',
    gameType: GameTypes.OneVsNpc,
    guild: '2',
  };
  const dtChannel3 = {
    _id: '3',
    gameType: GameTypes.OneVsNpc,
    guild: '3',
  };
  beforeAll(() => {
    dtChannelRepo = new DarumaTrainingChannelRepository();
  });
  describe('getAllChannelsByGuildIds', () => {
    it('should return all channels by guild ids', async () => {
      await darumaTrainingChannelModel.insertMany([dtChannel, dtChannel2, dtChannel3]);
      const result = await dtChannelRepo.getAllChannelsByGuildIds(['1', '2', '3']);
      expect(result).toHaveLength(3);
      expect(result.map((channel) => channel._id)).toEqual(['1', '2', '3']);
    });
    it('should return empty array if no channels found', async () => {
      const guildIds = ['1', '2', '3'];
      const result = await dtChannelRepo.getAllChannelsByGuildIds(guildIds);
      expect(result).toHaveLength(0);
    });
    it('should return channels for a subset of guild ids', async () => {
      await darumaTrainingChannelModel.insertMany([dtChannel, dtChannel2, dtChannel3]);
      const result = await dtChannelRepo.getAllChannelsByGuildIds(['1', '2']);
      expect(result).toHaveLength(2);
      expect(result.map((channel) => channel._id)).toEqual(['1', '2']);
    });
  });
  describe('getChannelById', () => {
    it('should return channel by id', async () => {
      await darumaTrainingChannelModel.insertMany([dtChannel, dtChannel2, dtChannel3]);
      const result = await dtChannelRepo.getChannelById('1');
      expect(result?._id).toBe('1');
    });
    it('should return null if no channel found', async () => {
      const result = await dtChannelRepo.getChannelById('1');
      expect(result).toBeNull();
    });
  });
  describe('upsertChannel', () => {
    it('should upsert channel', async () => {
      const result = await dtChannelRepo.upsertChannel('1', GameTypes.OneVsNpc, '1');
      expect(result).toMatchObject({
        _id: '1',
        gameType: GameTypes.OneVsNpc,
        guild: '1',
      });
    });
    it('should update channel if exists', async () => {
      await darumaTrainingChannelModel.insertMany([dtChannel, dtChannel2, dtChannel3]);
      const result = await dtChannelRepo.upsertChannel('3', GameTypes.OneVsNpc, '1');
      expect(result).toMatchObject({
        _id: '3',
        gameType: GameTypes.OneVsNpc,
        guild: '1',
      });
    });
  });
  describe('deleteChannelById', () => {
    it('should delete channel by id', async () => {
      await darumaTrainingChannelModel.insertMany([dtChannel, dtChannel2, dtChannel3]);
      const result = await dtChannelRepo.deleteChannelById('1');
      expect(result).toBe(true);
    });
    it('should return false if no channel found', async () => {
      const result = await dtChannelRepo.deleteChannelById('1');
      expect(result).toBe(false);
    });
  });
});
