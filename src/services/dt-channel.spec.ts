/* eslint-disable @typescript-eslint/unbound-method */
import { Collection, Guild } from 'discord.js';

import { deepEqual, instance, mock, verify, when } from 'ts-mockito';

import { mockFakeChannel } from '../../tests/mocks/mock-functions.js';
import { DarumaTrainingChannelRepository } from '../database/dt-channel/dt-channel.repo.js';
import { GameTypes } from '../enums/daruma-training.js';

import { DarumaTrainingChannelService } from './dt-channel.js';

describe('DarumaTrainingChannelService', () => {
  let repoMock: DarumaTrainingChannelRepository;
  let service: DarumaTrainingChannelService;

  beforeEach(() => {
    repoMock = mock(DarumaTrainingChannelRepository);
    service = new DarumaTrainingChannelService(instance(repoMock));
  });
  it('should get all channels by guild ids', async () => {
    const guilds = new Collection<string, Guild>();
    const mockChannels = [mockFakeChannel(GameTypes.OneVsNpc), mockFakeChannel(GameTypes.OneVsNpc)];
    guilds.set(mockChannels[0]!.guild, {} as Guild);
    guilds.set(mockChannels[1]!.guild, {} as Guild);
    const guildIds = [...guilds.keys()];
    when(repoMock.getAllChannelsByGuildIds(deepEqual(guildIds))).thenResolve(mockChannels);

    const result = await service.getAllChannelsByGuildIds(guilds);

    expect(result).toBe(mockChannels);
    verify(repoMock.getAllChannelsByGuildIds(deepEqual(guildIds))).once();
  });

  it('should get channel by id', async () => {
    const channelId = 'channel1';
    const mockChannel = mockFakeChannel(GameTypes.OneVsNpc);
    when(repoMock.getChannelById(channelId)).thenResolve(mockChannel);

    const result = await service.getChannelById(channelId);

    expect(result).toBe(mockChannel);
    verify(repoMock.getChannelById(channelId)).once();
  });

  it('should upsert channel', async () => {
    const channelId = 'channel1';
    const gameType = GameTypes.OneVsNpc;
    const guildId = 'guild1';
    const mockChannel = mockFakeChannel(gameType);
    when(repoMock.upsertChannel(channelId, gameType, guildId)).thenResolve(mockChannel);

    const result = await service.upsertChannel(channelId, gameType, guildId);

    expect(result).toBe(mockChannel);
    verify(repoMock.upsertChannel(channelId, gameType, guildId)).once();
  });

  it('should delete channel by id', async () => {
    const channelId = 'channel1';
    when(repoMock.deleteChannelById(channelId)).thenResolve(true);

    const result = await service.deleteChannelById(channelId);

    expect(result).toBe(true);
    verify(repoMock.deleteChannelById(channelId)).once();
  });
});
