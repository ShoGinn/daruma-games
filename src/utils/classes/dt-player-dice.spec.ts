import { playerRoundsDataPerfectGame } from '../../../tests/mocks/mock-player-rounds-data.js';

import { PlayerDice } from './dt-player-dice.js';

let defaultArray = [6, 6, 6, 6, 6, 6, 6];
const mockDiceRollsArray = (): number[] => {
  // Return custom dice rolls for testing (all 6s) to avoid random values
  return defaultArray;
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
      const diceRolls = [6, 6, 6, 6, 6, 6, 6, 6];

      // Act
      const result = PlayerDice['damageCalc'](diceRolls);

      // Assert
      expect(result.diceRolls.rolls).toEqual(diceRolls.slice(0, 7));
      expect(result.roundsData.rounds).toHaveLength(3);
      expect(result.roundsData.rounds[0]!.rolls).toHaveLength(3);
      expect(result.roundsData.rounds[1]!.rolls).toHaveLength(3);
      expect(result.roundsData.rounds[2]!.rolls).toHaveLength(1);
      expect(result.roundsData.gameWinRollIndex).toBe(0);
      expect(result.roundsData.gameWinRoundIndex).toBe(2);
    });

    test('should handle the case when the total score exceeds 21 and resets to 15 and then achieves 21', () => {
      // Arrange
      const diceRolls = [6, 6, 6, 6, 6, 6, 4, 4, 4, 4, 4];

      // Act
      const result = PlayerDice['damageCalc'](diceRolls);

      // Assert
      expect(result.diceRolls.rolls).toEqual(diceRolls);

      expect(result.roundsData.rounds).toHaveLength(4);
      expect(result.roundsData.rounds[0]!.rolls).toHaveLength(3);
      expect(result.roundsData.rounds[1]!.rolls).toHaveLength(3);
      expect(result.roundsData.rounds[2]!.rolls).toHaveLength(3);
      expect(result.roundsData.rounds[3]!.rolls).toHaveLength(2);
      expect(
        result.roundsData.rounds.every((round) =>
          round.rolls.every((roll) => roll.totalScore <= 21),
        ),
      ).toBe(true);
      expect(result.roundsData.gameWinRollIndex).toBe(1);
      expect(result.roundsData.gameWinRoundIndex).toBe(3);
    });

    test('should handle the case when the total score is exactly 21', () => {
      // Arrange
      const diceRolls = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1];

      // Act
      const result = PlayerDice['damageCalc'](diceRolls);

      // Assert
      expect(result.diceRolls.rolls).toEqual(diceRolls);

      expect(result.roundsData.rounds).toHaveLength(7);
      expect(result.roundsData.rounds.every((round) => round.rolls.length === 3)).toBe(true);
      expect(result.roundsData.gameWinRollIndex).toBe(2);
      expect(result.roundsData.gameWinRoundIndex).toBe(6);
    });

    test('should handle the case when the total score is less than 21', () => {
      // Arrange
      const diceRolls = [1, 2, 3, 4, 5];

      // Act

      expect(() => {
        PlayerDice['damageCalc'](diceRolls);
      }).toThrow('No winning roll found');
    });
  });

  describe('completeGameForPlayer', () => {
    test('should return the correct PlayerRoundsData for a complete game', () => {
      // Arrange & Act
      const result = PlayerDice.completeGameForPlayer(mockDiceRollsArray);
      const mockResult = playerRoundsDataPerfectGame;
      // Assert
      expect(result.roundsData.rounds).toHaveLength(3);
      expect(result.roundsData.rounds[0]!.rolls).toHaveLength(3);
      expect(result.roundsData.rounds[1]!.rolls).toHaveLength(3);
      expect(result.roundsData.rounds[2]!.rolls).toHaveLength(1);
      expect(result.roundsData.gameWinRollIndex).toBe(0);
      expect(result.roundsData.gameWinRoundIndex).toBe(2);
      expect(result.roundsData).toEqual(mockResult);
      expect(result.diceRolls.rolls).toEqual(defaultArray.slice(0, 7));
    });
    test('should return a completeGameForPlayer with a random diceRollsArray', () => {
      // Arrange & Act
      const result = PlayerDice.completeGameForPlayer();
      // Assert
      expect(result.roundsData.rounds).toBeDefined();
      expect(result.roundsData.gameWinRollIndex).toBeDefined();
      expect(result.roundsData.gameWinRoundIndex).toBeDefined();
    });
    test('should throw an error if no winning roll is found after 3 tries', () => {
      // Arrange
      defaultArray = [1, 2, 3, 4, 5, 6, 7];
      // Act & Assert
      expect(() => {
        PlayerDice.completeGameForPlayer(mockDiceRollsArray);
      }).toThrow('No winning roll found after 3 tries');
    });
  });
});
