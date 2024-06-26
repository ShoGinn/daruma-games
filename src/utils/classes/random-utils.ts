import { Random } from 'random-js';

import { ConstantRange } from '../../core/constants.js';

/**
 * Functions concerning pseudo-randomness
 */
export const randomUtils = {
  /**
   * Redefining the random js library
   */
  random: new Random(),

  /**
   * Generates a random number between min included and max excluded
   * @param {number} min - minimum value included
   * @param {number} max - maximum value excluded
   * @returns {number} a random number between min included and max excluded
   */
  randInt: (min: number, max: number): number => randomUtils.random.integer(min, max - 1),

  /**
   * Generates a random number in the range (both interval bounds included)
   * @param {ConstantRange} range - typically something in constants as {MIN: number, MAX: number}
   * @param {number} minAdd - Amount to add to range.MIN ; Default : 1
   * @param {number} maxAdd - Amount to add to range.MAX ; Default : 1
   * @returns {number} a random number in [MIN, MAX]
   */
  rangedInt: (range: ConstantRange, minAdd: number = 0, maxAdd: number = 1): number =>
    randomUtils.random.integer(range.MIN + minAdd, range.MAX + maxAdd),

  /**
   * Generates a random number between -variation and variation
   * @param {number} variation
   * @returns {number} a random number in [-variation, variation]
   */
  variationInt: (variation: number): number => randomUtils.random.integer(-variation, variation),
};
