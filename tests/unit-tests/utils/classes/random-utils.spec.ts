import { RandomUtils } from '../../../../src/utils/classes/random-utils.js';

describe('RandomUtils', () => {
  describe('randInt', () => {
    it('should generate a random number between min included and max excluded', () => {
      // Arrange
      const min = 0;
      const max = 10;

      // Act
      const result = RandomUtils.randInt(min, max);

      // Assert
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThan(max);
    });

    it('should handle negative numbers', () => {
      // Arrange
      const min = -10;
      const max = 0;

      // Act
      const result = RandomUtils.randInt(min, max);

      // Assert
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThan(max);
    });

    it('should handle min and max being the same', () => {
      // Arrange
      const min = 5;
      const max = 5;

      // Act
      const result = RandomUtils.randInt(min, max);

      // Assert
      expect(result).toBe(min);
    });
  });

  describe('rangedInt', () => {
    it('should generate a random number in the specified range', () => {
      // Arrange
      const range = { MIN: 0, MAX: 10 };
      const minAdd = 1;
      const maxAdd = 2;

      // Act
      const result = RandomUtils.rangedInt(range, minAdd, maxAdd);

      // Assert
      expect(result).toBeGreaterThanOrEqual(range.MIN + minAdd);
      expect(result).toBeLessThanOrEqual(range.MAX + maxAdd);
    });

    it('should handle default values for minAdd and maxAdd', () => {
      // Arrange
      const range = { MIN: 0, MAX: 10 };

      // Act
      const result = RandomUtils.rangedInt(range);

      // Assert
      expect(result).toBeGreaterThanOrEqual(range.MIN);
      expect(result).toBeLessThanOrEqual(range.MAX + 1);
    });
  });

  describe('variationInt', () => {
    it('should generate a random number between -variation and variation', () => {
      // Arrange
      const variation = 10;

      // Act
      const result = RandomUtils.variationInt(variation);

      // Assert
      expect(result).toBeGreaterThanOrEqual(-variation);
      expect(result).toBeLessThanOrEqual(variation);
    });

    it('should handle variation being 0', () => {
      // Arrange
      const variation = 0;

      // Act
      const result = RandomUtils.variationInt(variation);

      // Assert
      expect(result).toBe(-0);
    });
  });
});
