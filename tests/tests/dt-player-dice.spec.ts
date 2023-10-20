import { PlayerRoundsData } from '../../src/model/types/daruma-training.js';
import { PlayerDice } from '../../src/utils/classes/dt-player-dice.js';
let defaultArray = [6, 6, 6, 6, 6, 6, 6];
const mockDiceRollsArray = (): number[] => {
  // Return custom dice rolls for testing (all 6s) to avoid random values
  return defaultArray;
};

const mockDamageCalc = (): PlayerRoundsData => {
  // Return custom PlayerRoundsData for testing
  return {
    rounds: [
      {
        rolls: [
          { damage: 3, roll: 6, totalScore: 3 },
          { damage: 3, roll: 6, totalScore: 6 },
          { damage: 3, roll: 6, totalScore: 9 },
        ],
      },
      {
        rolls: [
          { damage: 3, roll: 6, totalScore: 12 },
          { damage: 3, roll: 6, totalScore: 15 },
          { damage: 3, roll: 6, totalScore: 18 },
        ],
      },
      {
        rolls: [{ damage: 3, roll: 6, totalScore: 21 }],
      },
    ],
    gameWinRollIndex: 0,
    gameWinRoundIndex: 2,
  };
};
describe('PlayerDice', () => {
  describe('generateDiceDamageMap', () => {
    test('should generate a dice damage map with correct values', () => {
      const maxDiceValue = 6;
      const maxDamageValue = 3;
      const expectedMap = new Map([
        [1, 1],
        [2, 1],
        [3, 2],
        [4, 2],
        [5, 3],
        [6, 3],
      ]);

      const result = PlayerDice['generateDiceDamageMap'](maxDiceValue, maxDamageValue);

      // Assert
      expect(result).toEqual(expectedMap);
    });

    test('should generate a dice damage map with correct values when maxDiceValue is not divisible by maxDamageValue', () => {
      const maxDiceValue = 7;
      const maxDamageValue = 3;
      const expectedMap = new Map([
        [1, 1],
        [2, 1],
        [3, 2],
        [4, 2],
        [5, 3],
        [6, 3],
        [7, 3],
      ]);

      const result = PlayerDice['generateDiceDamageMap'](maxDiceValue, maxDamageValue);

      // Assert
      expect(result).toEqual(expectedMap);
    });

    test('should generate a dice damage map with correct values when maxDiceValue is less than maxDamageValue', () => {
      const maxDiceValue = 3;
      const maxDamageValue = 3;
      const expectedMap = new Map([
        [1, 1],
        [2, 2],
        [3, 3],
      ]);

      const result = PlayerDice['generateDiceDamageMap'](maxDiceValue, maxDamageValue);

      // Assert
      expect(result).toEqual(expectedMap);
    });
  });
  describe('diceRollsArr', () => {
    test('should return an array of dice rolls with the specified length', () => {
      // Arrange
      const arrayLength = 1000;

      // Act
      const result = PlayerDice['diceRollsArr'](arrayLength);

      // Assert
      expect(result).toHaveLength(arrayLength);
      expect(result.every((roll) => roll >= 1 && roll <= 6)).toBe(true);
    });

    test('should return an empty array when the length is 0', () => {
      // Arrange
      const arrayLength = 0;

      // Act
      const result = PlayerDice['diceRollsArr'](arrayLength);

      // Assert
      expect(result).toEqual([]);
    });
  });
  describe('calculateDamageForRoll', () => {
    test('should return the correct damage for a roll', () => {
      // Arrange
      const roll = 6;

      // Act
      const result = PlayerDice['calculateDamageForRoll'](roll);

      // Assert
      expect(result).toBe(3);
    });
    test('should return 0 for a roll of 7 in the default dice damage map', () => {
      // Arrange
      const roll = 7;

      // Act
      const result = PlayerDice['calculateDamageForRoll'](roll);

      // Assert
      expect(result).toBe(0);
    });
  });
  describe('damageCalc', () => {
    test('should calculate the damage for each roll and return the correct PlayerRoundsData', () => {
      // Arrange
      const diceRolls = [6, 6, 6, 6, 6, 6, 6];

      // Act
      const result = PlayerDice['damageCalc'](diceRolls);

      // Assert
      expect(result.rounds).toHaveLength(3);
      expect(result.rounds[0].rolls).toHaveLength(3);
      expect(result.rounds[1].rolls).toHaveLength(3);
      expect(result.rounds[2].rolls).toHaveLength(1);
      expect(result.gameWinRollIndex).toBe(0);
      expect(result.gameWinRoundIndex).toBe(2);
    });

    test('should handle the case when the total score exceeds 21 and resets to 15 and then achieves 21', () => {
      // Arrange
      const diceRolls = [6, 6, 6, 6, 6, 6, 4, 4, 4, 4, 4];

      // Act
      const result = PlayerDice['damageCalc'](diceRolls);

      // Assert
      expect(result.rounds).toHaveLength(4);
      expect(result.rounds[0].rolls).toHaveLength(3);
      expect(result.rounds[1].rolls).toHaveLength(3);
      expect(result.rounds[2].rolls).toHaveLength(3);
      expect(result.rounds[3].rolls).toHaveLength(2);
      expect(
        result.rounds.every((round) => round.rolls.every((roll) => roll.totalScore <= 21)),
      ).toBe(true);
      expect(result.gameWinRollIndex).toBe(1);
      expect(result.gameWinRoundIndex).toBe(3);
    });

    test('should handle the case when the total score is exactly 21', () => {
      // Arrange
      const diceRolls = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1];

      // Act
      const result = PlayerDice['damageCalc'](diceRolls);

      // Assert
      expect(result.rounds).toHaveLength(7);
      expect(result.rounds.every((round) => round.rolls.length === 3)).toBe(true);
      expect(result.gameWinRollIndex).toBe(2);
      expect(result.gameWinRoundIndex).toBe(6);
    });

    test('should handle the case when the total score is less than 21', () => {
      // Arrange
      const diceRolls = [1, 2, 3, 4, 5];

      // Act

      expect(() => {
        PlayerDice['damageCalc'](diceRolls);
      }).toThrowError('No winning roll found');
    });
  });

  describe('completeGameForPlayer', () => {
    test('should return the correct PlayerRoundsData for a complete game', () => {
      // Arrange & Act
      const result = PlayerDice.completeGameForPlayer(mockDiceRollsArray);
      const mockResult = mockDamageCalc();
      // Assert
      expect(result.rounds).toHaveLength(3);
      expect(result.rounds[0].rolls).toHaveLength(3);
      expect(result.rounds[1].rolls).toHaveLength(3);
      expect(result.rounds[2].rolls).toHaveLength(1);
      expect(result.gameWinRollIndex).toBe(0);
      expect(result.gameWinRoundIndex).toBe(2);
      expect(result).toEqual(mockResult);
    });
    test('should return a completeGameForPlayer with a random diceRollsArray', () => {
      // Arrange & Act
      const result = PlayerDice.completeGameForPlayer();
      // Assert
      expect(result.rounds).toBeDefined();
      expect(result.gameWinRollIndex).toBeDefined();
      expect(result.gameWinRoundIndex).toBeDefined();
    });
    test('should throw an error if no winning roll is found after 3 tries', () => {
      // Arrange
      defaultArray = [1, 2, 3, 4, 5, 6, 7];
      // Act & Assert
      expect(() => {
        PlayerDice.completeGameForPlayer(mockDiceRollsArray);
      }).toThrowError('No winning roll found after 3 tries');
    });
  });
});
