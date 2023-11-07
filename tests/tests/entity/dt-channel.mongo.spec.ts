/* eslint-disable @typescript-eslint/unbound-method */
import { Collection, Guild } from 'discord.js';

import * as dtEntity from '../../../src/entities/dt-channel.mongo.js';
import { GameTypes } from '../../../src/enums/daruma-training.js';
import * as dtChannel from '../../../src/repositories/dt-channel-repository.js';

describe('Daruma Training Channel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should get all channels', async () => {
    // Arrange
    const mockChannels = [
      { _id: 'channel1', gameType: GameTypes.OneVsNpc, guild: 'guild1' },
      { _id: 'channel2', gameType: GameTypes.FourVsNpc, guild: 'guild2' },
    ];
    dtEntity.darumaTrainingChannel.find = jest.fn().mockImplementation(() => {
      return {
        exec: jest.fn().mockResolvedValueOnce(mockChannels),
      };
    });

    // Act
    const result = await dtChannel.getAllChannels();

    // Assert
    expect(result).toEqual(mockChannels);
    expect(dtEntity.darumaTrainingChannel.find).toHaveBeenCalledTimes(1);
  });

  test('should get all channels in a guild', async () => {
    // Arrange
    const guildId = 'guild1';
    const mockChannels = [
      { _id: 'channel1', gameType: GameTypes.OneVsNpc, guild: guildId },
      { _id: 'channel2', gameType: GameTypes.FourVsNpc, guild: guildId },
    ];
    dtEntity.darumaTrainingChannel.find = jest.fn().mockImplementation(() => {
      return {
        exec: jest.fn().mockResolvedValueOnce(mockChannels),
      };
    });

    // Act
    const result = await dtChannel.getAllChannelsInGuild(guildId);

    // Assert
    expect(result).toEqual(mockChannels);
    expect(dtEntity.darumaTrainingChannel.find).toHaveBeenCalledTimes(1);
    expect(dtEntity.darumaTrainingChannel.find).toHaveBeenCalledWith({ guild: guildId });
  });

  test('should get all channels in the database', async () => {
    // Arrange

    const guild1 = { id: 'guild1' } as Guild;
    const mockGuilds = new Collection([[guild1.id, guild1]]);
    const mockChannels = [{ _id: 'channel1', gameType: GameTypes.OneVsNpc, guild: guild1.id }];
    dtEntity.darumaTrainingChannel.find = jest.fn().mockImplementation(() => {
      return {
        exec: jest.fn().mockResolvedValueOnce(mockChannels),
      };
    });

    // Act
    const result = await dtChannel.getAllChannelsInDB(mockGuilds);

    // Assert
    expect(result).toEqual(mockChannels);
    expect(dtEntity.darumaTrainingChannel.find).toHaveBeenCalledTimes(mockGuilds.size);
    expect(dtEntity.darumaTrainingChannel.find).toHaveBeenCalledWith({ guild: guild1.id });
  });

  test('should get a channel by ID', async () => {
    // Arrange
    const channelId = 'channel1';
    const mockChannel = {
      _id: channelId,
      gameType: GameTypes.OneVsNpc,
      guild: 'guild1',
    };
    dtEntity.darumaTrainingChannel.findById = jest.fn().mockResolvedValueOnce(mockChannel);

    // Act
    const result = await dtChannel.getChannel(channelId);

    // Assert
    expect(result).toBe(mockChannel);
    expect(dtEntity.darumaTrainingChannel.findById).toHaveBeenCalledTimes(1);
    expect(dtEntity.darumaTrainingChannel.findById).toHaveBeenCalledWith(channelId);
  });

  test('should add a channel to the database', async () => {
    // Arrange
    const channelId = 'channel1';
    const gameType = GameTypes.OneVsNpc;
    const guildId = 'guild1';
    const mockChannel = {
      _id: channelId,
      gameType,
      guild: guildId,
    };
    dtEntity.darumaTrainingChannel.findById = jest.fn().mockResolvedValueOnce(null);
    dtEntity.darumaTrainingChannel.prototype.save = jest.fn().mockResolvedValueOnce(mockChannel);
    // Act
    const result = await dtChannel.addChannelToDatabase(channelId, gameType, guildId);

    // Assert
    expect(result).toBeDefined();
    expect(dtEntity.darumaTrainingChannel.findById).toHaveBeenCalledTimes(1);
    expect(dtEntity.darumaTrainingChannel.findById).toHaveBeenCalledWith(channelId);
    expect(dtEntity.darumaTrainingChannel.prototype.save).toHaveBeenCalledTimes(1);
  });

  test('should not add a channel to the database if it already exists', async () => {
    // Arrange
    const channelId = 'channel1';
    const gameType = GameTypes.OneVsNpc;
    const guildId = 'guild1';
    const mockChannel = {
      _id: channelId,
      gameType,
      guild: guildId,
    };
    dtEntity.darumaTrainingChannel.findById = jest.fn().mockResolvedValueOnce(mockChannel);

    // Act
    const result = await dtChannel.addChannelToDatabase(channelId, gameType, guildId);

    // Assert
    expect(result).toBe(mockChannel);
    expect(dtEntity.darumaTrainingChannel.findById).toHaveBeenCalledTimes(1);
  });

  test('should remove a channel from the database', async () => {
    // Arrange
    const channelId = 'channel1';
    const mockChannel = {
      _id: channelId,
      gameType: GameTypes.OneVsNpc,
      guild: 'guild1',
    };
    dtEntity.darumaTrainingChannel.findById = jest.fn().mockResolvedValueOnce(mockChannel);
    dtEntity.darumaTrainingChannel.deleteOne = jest.fn().mockResolvedValueOnce({});

    // Act
    const result = await dtChannel.removeChannelFromDatabase(channelId);

    // Assert
    expect(result).toBe(true);
    expect(dtEntity.darumaTrainingChannel.findById).toHaveBeenCalledTimes(1);
    expect(dtEntity.darumaTrainingChannel.findById).toHaveBeenCalledWith(channelId);
    expect(dtEntity.darumaTrainingChannel.deleteOne).toHaveBeenCalledTimes(1);
    expect(dtEntity.darumaTrainingChannel.deleteOne).toHaveBeenCalledWith({ _id: channelId });
  });

  test('should return false when trying to remove a non-existent channel from the database', async () => {
    // Arrange
    const channelId = 'channel1';
    dtEntity.darumaTrainingChannel.findById = jest.fn().mockResolvedValueOnce(null);

    // Act
    const result = await dtChannel.removeChannelFromDatabase(channelId);

    // Assert
    expect(result).toBe(false);
    expect(dtEntity.darumaTrainingChannel.findById).toHaveBeenCalledTimes(1);
    expect(dtEntity.darumaTrainingChannel.deleteOne).not.toHaveBeenCalled();
  });
});
