import type {
  PlayerGameData,
  PlayerRoundsData,
  RollData,
} from '../../model/types/daruma-training.js';
import { produce } from 'immer';

import { RandomUtils } from '../utils.js';
const MAX_ROLL_VALUE = 6;
const MAX_DAMAGE_VALUE = 3;
const TOTAL_DICE_ROLLS = 100;
const WINNING_SCORE = 21;
const RESET_SCORE = 15;
const MAX_ROLLS_IN_ROUND = 3;
export class PlayerDice {
  static readonly defaultPlayerRoundsData: PlayerRoundsData = {
    rounds: [],
    gameWinRollIndex: 0,
    gameWinRoundIndex: 0,
  };
  private static readonly diceValues = this.generateDiceDamageMap(MAX_ROLL_VALUE, MAX_DAMAGE_VALUE);
  /**
   * Generates a map of dice values to damage values.
   *
   * @private
   * @static
   * @param {number} maxDiceValue
   * @param {number} maxDamageValue
   * @memberof PlayerDice
   * @returns {Map<number, number>} Map<number, number>
   */
  private static generateDiceDamageMap(
    maxDiceValue: number,
    maxDamageValue: number,
  ): Map<number, number> {
    const diceDamageMap = new Map<number, number>();
    const dicePerDamage = maxDiceValue / maxDamageValue;

    for (let index = 1; index <= maxDiceValue; index++) {
      const damageValue = Math.ceil(index / dicePerDamage);
      diceDamageMap.set(index, damageValue);
    }

    return diceDamageMap;
  }
  /**
   * Takes a dice roll from 1 to 6 and adds it to an array.
   *
   * @private
   * @param {number} arrayLength length of array
   * @memberof PlayerDice
   * @returns {number[]} number[]
   */
  private static diceRollsArr = (arrayLength: number): number[] => {
    return RandomUtils.random.dice(MAX_ROLL_VALUE, arrayLength);
  };
  /**
   * Calculates the damage for a given roll.
   *
   * @private
   * @static
   * @param {number} roll
   * @memberof PlayerDice
   * @returns {number} number
   */
  private static calculateDamageForRoll(roll: number): number {
    return PlayerDice.diceValues.get(roll) ?? 0;
  }
  /**
   * Calculates the damage for each roll and returns the data.
   *
   * @private
   * @static
   * @param {number[]} diceRolls
   * @memberof PlayerDice
   * @returns {PlayerGameData} PlayerGameData
   */
  private static damageCalc = (diceRolls: number[]): PlayerGameData => {
    let rolls: number[] = [];
    const roundsData = produce(PlayerDice.defaultPlayerRoundsData, (draft) => {
      // set up variables
      let totalScore = 0;
      let rollIndex = 0;
      let roundIndex = 0;
      let isWin = false;

      // temp storage for round rolls
      let roundRolls: RollData[] = [];

      const addRollToRound = (roll: number): void => {
        const damage = PlayerDice.calculateDamageForRoll(roll);
        // iterate total score
        totalScore += damage;
        // reset total score to 15 if over 21
        if (totalScore > WINNING_SCORE) {
          totalScore = RESET_SCORE;
        }
        // add roll to round rolls
        roundRolls.push({ roll, damage, totalScore });
      };
      const startNewRound = (): void => {
        draft.rounds.push({ rolls: roundRolls });
        roundRolls = [];
        roundIndex++;
        rollIndex = 0;
      };
      for (const roll of diceRolls) {
        // grab damage value
        addRollToRound(roll);
        // set game index if win
        if (totalScore === WINNING_SCORE) {
          draft.gameWinRoundIndex = roundIndex;
          draft.gameWinRollIndex = rollIndex;
          rolls = diceRolls.slice(0, roundIndex * 3 + rollIndex + 1);
          isWin = true;
        }
        // if we're starting a new round, push the round to roundsData
        // clear roundRolls, increment roundIndex, reset rollIndex
        // push last rolls in if it's a winning roll
        if (rollIndex === MAX_ROLLS_IN_ROUND - 1 || isWin) {
          startNewRound();
        } else {
          rollIndex++;
        }
        // stop loop if win, else increment rollIndex
        if (isWin) {
          break;
        }
      }
      if (!isWin) {
        throw new Error('No winning roll found');
      }
    });
    return { diceRolls: { rolls }, roundsData };
  };
  /**
   * Generates a complete game for a player.
   *
   * @static
   * @param {(arrayLength: number) => number[]} [diceRollsArrayFunction=PlayerDice.diceRollsArr]
   * @param {(diceRolls: number[]) => PlayerGameData} [damageCalcFunction=PlayerDice.damageCalc]
   * @memberof PlayerDice
   * @returns {PlayerGameData} PlayerGameData
   */
  public static completeGameForPlayer = (
    diceRollsArrayFunction: (arrayLength: number) => number[] = PlayerDice.diceRollsArr,
    damageCalcFunction: (diceRolls: number[]) => PlayerGameData = PlayerDice.damageCalc,
  ): PlayerGameData => {
    // Will retry 3 times if no winning roll is found
    // If no winning roll is found after 3 tries, it will throw an error
    // This is to prevent infinite loops
    let retryCount = 0;
    while (retryCount < 3) {
      try {
        const diceRolls = diceRollsArrayFunction(TOTAL_DICE_ROLLS);
        return damageCalcFunction(diceRolls);
      } catch {
        retryCount++;
      }
    }
    throw new Error('No winning roll found after 3 tries');
  };
}
