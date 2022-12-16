import { injectable } from 'tsyringe';

import { randomNumber } from '../functions/dtUtils.js';
import logger from '../functions/LoggerFactory.js';

@injectable()
export class PlayerDice {
    private static readonly diceValues: { [key: number]: number } = {
        1: 1,
        2: 1,
        3: 2,
        4: 2,
        5: 3,
        6: 3,
    };

    /**
     * Takes a dice roll from 1 to 6 and adds it to an array.
     *
     * @private
     * @param {number} arrayLength length of array
     * @memberof PlayerDice
     * @returns {Array<number>} Array<number>
     */
    private static diceRollsArr = (arrayLength: number): Array<number> =>
        Array.from({ length: arrayLength }, () => randomNumber(1, 6));

    /**
     * Takes an array of rolls from diceRollsArr and maps damage to it
     *
     * @private
     * @param {Array<number>} diceRolls Array of numbers from diceRollsArr
     * @memberof PlayerDice
     * @returns PlayerRoundsData
     */
    private static damageCalc = (
        diceRolls: Array<number>
    ): DarumaTrainingPlugin.PlayerRoundsData => {
        // set up variables
        let totalScore = 0;
        let rollIndex = 0;
        let roundIndex = 0;
        let isWin = false;

        // temp storage for round rolls
        let roundRolls: Array<DarumaTrainingPlugin.RollData> = [];
        // set up return value
        const roundsData: DarumaTrainingPlugin.PlayerRoundsData = {
            rounds: [],
            gameWinRollIndex: 0,
            gameWinRoundIndex: 0,
        };

        for (let index = 0; index < diceRolls.length; index++) {
            const roll = diceRolls[index];
            // grab damage value
            const damage = PlayerDice.diceValues[roll];
            // iterate total score
            totalScore += damage;

            // reset total score to 15 if over 21
            if (totalScore > 21 && roundsData.gameWinRoundIndex === 0) {
                totalScore = 15;
            }

            // set game index if win
            if (totalScore === 21) {
                roundsData.gameWinRoundIndex = roundIndex;
                roundsData.gameWinRollIndex = rollIndex;
                isWin = true;
            }

            // push new roll to round rolls
            roundRolls.push({ damage, roll, totalScore });

            // if we're starting a new round, push the round to roundsData
            // clear roundRolls, increment roundIndex, reset rollIndex
            // push last rolls in if it's a winning roll
            if (rollIndex === 2 || isWin) {
                const roundData = {
                    roundNumber: roundIndex + 1,
                    totalDamageSoFar: totalScore,
                    rolls: roundRolls,
                };

                roundsData.rounds.push(roundData);
                roundRolls = [];
                roundIndex++;
                rollIndex = 0;
            } else {
                rollIndex++;
            }
            // stop loop if win, else increment rollIndex
            if (isWin) {
                break;
            }
        }
        return roundsData;
    };

    public static completeGameForPlayer = (): DarumaTrainingPlugin.PlayerRoundsData => {
        if (process.env.MOCK_DICE_ROLLS === 'true') {
            logger.error('MOCK_DICE_ROLLS is set to true');
            return mockSevenRound;
        }
        return PlayerDice.damageCalc(PlayerDice.diceRollsArr(100));
    };
}

const _mockZen = {
    rounds: [
        {
            roundNumber: 1,
            totalDamageSoFar: 9,
            rolls: [
                { damage: 3, roll: 6, totalScore: 3 },
                { damage: 3, roll: 6, totalScore: 6 },
                { damage: 3, roll: 6, totalScore: 9 },
            ],
        },
        {
            roundNumber: 2,
            totalDamageSoFar: 18,
            rolls: [
                { damage: 3, roll: 6, totalScore: 12 },
                { damage: 3, roll: 6, totalScore: 15 },
                { damage: 3, roll: 6, totalScore: 18 },
            ],
        },
        {
            roundNumber: 3,
            totalDamageSoFar: 21,
            rolls: [{ damage: 3, roll: 1, totalScore: 21 }],
        },
    ],
    gameWinRollIndex: 0,
    gameWinRoundIndex: 2,
};

const mockSevenRound = {
    rounds: [
        {
            roundNumber: 1,
            totalDamageSoFar: 3,
            rolls: [
                { damage: 1, roll: 1, totalScore: 1 },
                { damage: 1, roll: 1, totalScore: 2 },
                { damage: 1, roll: 1, totalScore: 3 },
            ],
        },
        {
            roundNumber: 2,
            totalDamageSoFar: 6,
            rolls: [
                { damage: 1, roll: 1, totalScore: 4 },
                { damage: 1, roll: 1, totalScore: 5 },
                { damage: 1, roll: 1, totalScore: 6 },
            ],
        },
        {
            roundNumber: 3,
            totalDamageSoFar: 9,
            rolls: [
                { damage: 1, roll: 1, totalScore: 7 },
                { damage: 1, roll: 1, totalScore: 8 },
                { damage: 1, roll: 1, totalScore: 9 },
            ],
        },
        {
            roundNumber: 4,
            totalDamageSoFar: 12,
            rolls: [
                { damage: 1, roll: 1, totalScore: 10 },
                { damage: 1, roll: 1, totalScore: 11 },
                { damage: 1, roll: 1, totalScore: 12 },
            ],
        },
        {
            roundNumber: 5,
            totalDamageSoFar: 15,
            rolls: [
                { damage: 1, roll: 1, totalScore: 13 },
                { damage: 1, roll: 1, totalScore: 14 },
                { damage: 1, roll: 1, totalScore: 15 },
            ],
        },
        {
            roundNumber: 6,
            totalDamageSoFar: 18,
            rolls: [
                { damage: 1, roll: 1, totalScore: 16 },
                { damage: 1, roll: 1, totalScore: 17 },
                { damage: 1, roll: 1, totalScore: 18 },
            ],
        },
        {
            roundNumber: 7,
            totalDamageSoFar: 21,
            rolls: [
                { damage: 1, roll: 1, totalScore: 19 },
                { damage: 1, roll: 1, totalScore: 20 },
                { damage: 1, roll: 1, totalScore: 21 },
            ],
        },
    ],
    gameWinRollIndex: 2,
    gameWinRoundIndex: 6,
};
