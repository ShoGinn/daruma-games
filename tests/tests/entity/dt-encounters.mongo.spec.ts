import * as dtEncounters from '../../../src/entities/dt-encounters.mongo.js';
import { GameTypes } from '../../../src/enums/daruma-training.js';
import { mockedFakePlayerLongestGame, mockFakeGame } from '../../utils/fake-mocks.js';

describe('dt-encounters.mongo.spec.ts', () => {
  describe('createEncounter()', () => {
    it('should create a new encounter', async () => {
      dtEncounters.dtEncounters.create = jest.fn();
      dtEncounters.dtEncounters.countDocuments = jest.fn().mockReturnValue(1);
      const game = mockFakeGame(GameTypes.OneVsNpc);
      await game.addPlayer(mockedFakePlayerLongestGame());
      const result = await dtEncounters.createEncounter(game);
      expect(result).toBe(1);
    });
  });
  describe('getAllDtEncounters()', () => {
    it('should return all encounters', async () => {
      dtEncounters.dtEncounters.find = jest.fn().mockImplementation(() => {
        return {
          exec: jest.fn().mockResolvedValueOnce([]),
        };
      });
      const result = await dtEncounters.getAllDtEncounters();
      expect(result).toEqual([]);
    });
  });
});
