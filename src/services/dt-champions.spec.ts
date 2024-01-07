import { instance, mock, when } from 'ts-mockito';

import {
  fourVsNpcPlayerWinner,
  oneVsNpcNpcWinner,
  oneVsOneZen,
} from '../../tests/mocks/mock-encounters-data.js';
import { DarumaTrainingEncounters } from '../database/dt-encounter/dt-encounters.schema.js';

import { AlgoNFTAssetService } from './algo-nft-assets.js';
import { DarumaTrainingChampions } from './dt-champions.js';
import { DarumaTrainingEncountersService } from './dt-encounters.js';
import { UserService } from './user.js';

describe('DarumaTrainingChampions', () => {
  let encounterService: DarumaTrainingEncountersService;
  let userService: UserService;
  let algoNFTServer: AlgoNFTAssetService;
  let champions: DarumaTrainingChampions;

  beforeEach(() => {
    encounterService = mock(DarumaTrainingEncountersService);
    userService = mock(UserService);
    algoNFTServer = mock(AlgoNFTAssetService);
    champions = new DarumaTrainingChampions(
      instance(encounterService),
      instance(userService),
      instance(algoNFTServer),
    );
  });

  it('should return the correct number of champions for a fourVsNpcPlayerWinner', async () => {
    const date = new Date();
    const encounters = [fourVsNpcPlayerWinner];
    when(encounterService.getAllByDate(date)).thenResolve(encounters);

    const result = await champions.getRandomNumberOfChampionsByDate(date, 3);

    // Replace with the expected champions
    const expectedChampions = [40_001];
    expect(result).toEqual(expectedChampions);
  });

  it('should return the correct champions for a oneVsOneZen', async () => {
    const date = new Date();
    const encounters: DarumaTrainingEncounters[] = [oneVsOneZen];
    when(encounterService.getAllByDate(date)).thenResolve(encounters);

    const result = await champions.getRandomNumberOfChampionsByDate(date, 3);

    // Replace with the expected champions
    const expectedChampions = [11_001, 11_002];
    expect(result).toEqual(expectedChampions);
  });
  it('should return the correct champions for a oneVsNpcNpcWinner', async () => {
    const date = new Date();
    const encounters: DarumaTrainingEncounters[] = [oneVsNpcNpcWinner];
    when(encounterService.getAllByDate(date)).thenResolve(encounters);

    const result = await champions.getRandomNumberOfChampionsByDate(date, 3);

    // Replace with the expected champions
    expect(result).toHaveLength(0);
  });
  it('should return the correct length of champions for all the mock data no dupes', async () => {
    const date = new Date();
    const encounters: DarumaTrainingEncounters[] = [
      oneVsNpcNpcWinner,
      oneVsOneZen,
      fourVsNpcPlayerWinner,
      oneVsOneZen,
      fourVsNpcPlayerWinner,
    ];
    when(encounterService.getAllByDate(date)).thenResolve(encounters);

    const result = await champions.getRandomNumberOfChampionsByDate(date, 3);

    // Replace with the expected champions
    const expectedChampions = [40_001, 11_001, 11_002];
    expect(result.sort()).toEqual(expectedChampions.sort());
  });
});
