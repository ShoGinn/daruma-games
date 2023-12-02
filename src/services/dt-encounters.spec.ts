import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';

import {
  mockChannelSettings,
  mockedFakePlayerPerfectGame,
} from '../../tests/mocks/mock-functions.js';
import { DarumaTrainingEncountersRepository } from '../database/dt-encounter/dt-encounters.repo.js';
import {
  DarumaTrainingEncounters,
  IDarumaTrainingEncounters,
} from '../database/dt-encounter/dt-encounters.schema.js';
import { GameTypes } from '../enums/daruma-training.js';

import { DarumaTrainingEncountersService } from './dt-encounters.js';

describe('DarumaTrainingEncountersService', () => {
  let service: DarumaTrainingEncountersService;
  let mockRepo: DarumaTrainingEncountersRepository;
  const channelSettings = mockChannelSettings(GameTypes.OneVsNpc);
  const mockedFakePlayer = mockedFakePlayerPerfectGame();
  beforeEach(() => {
    mockRepo = mock(DarumaTrainingEncountersRepository);
    service = new DarumaTrainingEncountersService(instance(mockRepo));
  });

  it('should return all encounters', async () => {
    const encounters: DarumaTrainingEncounters[] = [];
    when(mockRepo.getAll()).thenResolve(encounters);

    const result = await service.getAll();

    expect(result).toBe(encounters);
    verify(mockRepo.getAll()).once();
  });

  it('should create an encounter', async () => {
    const id = 1;
    when(mockRepo.create(anything())).thenResolve(id);

    const result = await service.create([], channelSettings.channelId, channelSettings.gameType);

    expect(result).toBe(id);
    verify(mockRepo.create(anything())).once();
  });
  it('should create an encounter for a group of players', async () => {
    const id = 1;
    when(mockRepo.create(anything())).thenResolve(id);
    const result = await service.create(
      [mockedFakePlayer],
      channelSettings.channelId,
      channelSettings.gameType,
    );
    expect(result).toBe(id);
    const expectedCall: IDarumaTrainingEncounters = {
      channelId: channelSettings.channelId,
      gameType: channelSettings.gameType,
      gameData: {
        [mockedFakePlayer.playableNFT._id]: mockedFakePlayer.rollsData,
      },
    };
    verify(mockRepo.create(deepEqual(expectedCall))).once();
  });
});
