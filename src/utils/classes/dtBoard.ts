import type { RollData, RoundData } from '../../model/types/darumaTraining.js';

import { Player } from './dtPlayer.js';
import { RenderPhases } from '../../enums/dtEnums.js';
import { emojiConvert, emojis } from '../functions/dtEmojis.js';

export class DarumaTrainingBoard {
    TURNS_IN_ROUND = 3;
    ROUNDS_IN_EMBED = 2;
    ROUND_WIDTH = 20;
    ATTACK_ROW_SPACER = '\t';
    ROUND_AND_TOTAL_SPACER = '\t';

    /**
     * Centers a string within the given amount of space
     * using the delimiter to fill the space to both the left & right of the string
     *
     * @param {number} space - the desired amount of space that the string should be centered within.
     * @param {string} [content=''] - the string to be centered.
     * @param {string} [delimiter=' '] - the character used to fill the space on either side of the string.
     * @returns {*}  {string}
     * @memberof DarumaTrainingBoard
     */
    centerString(space: number, content: string = '', delimiter: string = ' '): string {
        const len = content.length;
        const padSpace = Math.floor((space - len) / 2);
        return content.padStart(len + padSpace, delimiter).padEnd(space, delimiter);
    }

    /**
     * Gets the Image based upon the phase of the game
     *
     * @param {RollData} roll
     * @param {boolean} isPrevRoll
     * @param {boolean} isCurrentRoll
     * @param {boolean} isTurnRoll
     * @param {RenderPhases} renderPhase
     * @param {boolean} hasBeenTurn
     * @memberof DarumaTrainingBoard
     * @returns {string}
     */
    getImageType = (
        roll: RollData,
        isPrevRoll: boolean,
        isCurrentRoll: boolean,
        isTurnRoll: boolean,
        renderPhase: RenderPhases,
        hasBeenTurn: boolean
    ): string => {
        const emoji = 'ph';

        // if it's a previous roll, just show png
        if (isPrevRoll) {
            return `${roll.damage}png`;
        }
        // if it's the current players roll and we're in gif render phase add gif
        if (isCurrentRoll && isTurnRoll) {
            if (renderPhase === RenderPhases.GIF) {
                return `roll`;
            } else if (renderPhase === RenderPhases.EMOJI) {
                return `${roll.damage}png`;
            }
        } else if (isCurrentRoll && !isTurnRoll) {
            return hasBeenTurn ? `${roll.damage}png` : 'ph';
        }

        return emoji;
    };
    /**
     * Creates a row of attack numbers for each player
     *
     * @param {(number | string)} [roundNum]
     * @memberof DarumaTrainingBoard
     * @returns {string}
     */
    createRoundCell = (roundNum?: number | string): string => {
        let stringNum = roundNum || ' ';
        if (typeof stringNum === 'number') {
            stringNum = stringNum.toString();
        }
        return this.centerString(this.ROUND_WIDTH, stringNum);
    };

    /**
     * Creates a row of attack numbers for each player
     *
     * @param {number} roundIndex
     * @returns {*}  {string}
     * @memberof DarumaTrainingBoard
     */
    createRoundNumberRow(roundIndex: number): string {
        const isFirstRound = roundIndex === 0;
        const roundNumber = roundIndex + 1;
        const roundNumberEmoji = emojiConvert(roundNumber.toString());
        const prevRoundNumberEmoji = emojiConvert((roundNumber - 1).toString());
        const roundNumberRow: Array<string> = [];
        // for each row
        for (let i = 0; i <= this.ROUNDS_IN_EMBED - 1; i++) {
            // if first round, only the first element should have a label
            if (isFirstRound && i === 1) {
                roundNumberRow.push(this.createRoundCell());
            } else if (!isFirstRound && i === 0) {
                // as long as we're not in the first round, the first round features
                // the previous round number
                roundNumberRow.push(this.createRoundCell(prevRoundNumberEmoji));
            } else {
                roundNumberRow.push(this.createRoundCell(roundNumberEmoji));
            }
        }
        roundNumberRow.splice(1, 0, this.ROUND_AND_TOTAL_SPACER);
        return roundNumberRow.join('');
    }
    /**
     * Creates a row of attack numbers for each player
     *
     * @param {Array<RoundData>} playerRounds
     * @param {number} roundIndex
     * @param {number} rollIndex
     * @param {boolean} isTurn
     * @param {RenderPhases} renderPhase
     * @param {boolean} hasBeenTurn
     * @memberof DarumaTrainingBoard
     * @returns {Array<string>}
     */
    createAttackRow = (
        playerRounds: Array<RoundData>,
        roundIndex: number,
        rollIndex: number,
        isTurn: boolean,
        renderPhase: RenderPhases,
        hasBeenTurn: boolean
    ): Array<string> => {
        const row: Array<string> = [];
        const joinSpaces = ` `;
        // grab the previous round
        const prevRound = playerRounds[roundIndex - 1];
        // grab the current round
        const currentRound = playerRounds[roundIndex];

        // ROUND POSITION 0
        if (prevRound) {
            const prevRoundArr: Array<string> = [];
            for (let index = 0; index < this.TURNS_IN_ROUND; index++) {
                const roll = prevRound.rolls[index];
                if (roll?.damage) {
                    prevRoundArr.push(emojis[`${roll.damage}png`]);
                } else {
                    prevRoundArr.push(emojis.ph);
                }
            }
            row.push(prevRoundArr.join(joinSpaces));
        }

        // ROUND POSITION 1
        const curRoundArr: Array<string> = [];
        for (let index = 0; index < this.TURNS_IN_ROUND; index++) {
            // if the round is too high or the roll is too high, return a blank cell
            const isCurrentRoll = index === rollIndex;
            const isPrevRoll = index < rollIndex;
            const isTurnRoll = isCurrentRoll && isTurn;

            // if it is the current players turn, and we are on the current round
            const roll = currentRound.rolls[index];
            const emoji = this.getImageType(
                roll,
                isPrevRoll,
                isCurrentRoll,
                isTurnRoll,
                renderPhase,
                hasBeenTurn
            );
            curRoundArr.push(emojis[emoji]);
        }
        row.push(curRoundArr.join(joinSpaces));

        // ROUND POSITION 1 PLACEHOLDERS
        if (!prevRound) {
            const round1PlaceHolders: Array<string> = [];
            for (let index = 0; index < this.TURNS_IN_ROUND; index++) {
                // new array of emoji placeholders
                round1PlaceHolders.push(emojis.ph);
            }
            row.push(round1PlaceHolders.join(joinSpaces));
        }
        return row;
    };

    /**
     * Creates a row of total numbers for each player
     *
     * @param {number} roundIndex
     * @param {number} rollIndex
     * @param {Array<RoundData>} rounds
     * @param {RenderPhases} renderPhase
     * @param {boolean} hasBeenTurn
     * @param {boolean} notTurnYet
     * @memberof DarumaTrainingBoard
     * @returns {Array<string>}
     */
    createTotalRow = (
        roundIndex: number,
        rollIndex: number,
        rounds: Array<RoundData>,
        renderPhase: RenderPhases,
        hasBeenTurn: boolean,
        notTurnYet: boolean
    ): Array<string> => {
        const isFirstRound = roundIndex === 0;
        const totalRowLabel: Array<string> = [];
        // for each round
        for (let i = 0; i <= this.ROUNDS_IN_EMBED - 1; i++) {
            // previous total is static as round has been completed
            const rolls = rounds[roundIndex - 1]?.rolls || [];

            const prevRoundTotal = rolls[rolls.length - 1]?.totalScore || ' ';

            const totalRollIndex =
                (renderPhase !== RenderPhases.EMOJI || notTurnYet) && !hasBeenTurn
                    ? rollIndex - 1
                    : rollIndex;

            const currRoundTotal = rounds[roundIndex]?.rolls[totalRollIndex]?.totalScore || ' ';
            // if first round, only the first element should have a label
            if (isFirstRound && i === 1) {
                totalRowLabel.push(this.createRoundCell());
            } else if (!isFirstRound && i === 0) {
                // as long as we're not in the first round, the first round is previous
                totalRowLabel.push(this.createRoundCell(`***${prevRoundTotal}***`));
            } else {
                totalRowLabel.push(this.createRoundCell(`***${currRoundTotal}***`));
            }
        }
        totalRowLabel.push(`\t\t**Hits**`);

        return totalRowLabel;
    };

    /**
     * Create a row of total damage with blank spaces factored in
     *
    
     * @param {number} rollIndex
     * @param {number} roundIndex
     * @param {number} playerIndex
     * @param {Player[]} players
     * @param {RenderPhases} renderPhase
     * @returns {*}  {string}
     */
    public renderBoard(
        rollIndex: number,
        roundIndex: number,
        playerIndex: number,
        players: Array<Player>,
        renderPhase: RenderPhases
        // isLastRender: boolean
    ): string {
        const board = [];
        const blankRow = ' '.repeat(this.ROUND_WIDTH);
        const horizontalRule = `~~${blankRow}${this.ROUND_AND_TOTAL_SPACER}${blankRow}~~`;
        // create a row representing the current round
        board.push(`>>> ${this.centerString(horizontalRule.length - 4, '***ROUND***')}\n`);
        board.push(`${this.createRoundNumberRow(roundIndex)}\n`);
        // create a row of blank spaces double roundWidth
        board.push(horizontalRule);
        // create a row displaying attack numbers for each player
        // as well as a row displaying the total
        board.push(
            this.createAttackAndTotalRows(players, playerIndex, rollIndex, roundIndex, renderPhase)
        );

        return board.join('\n');
    }

    /**
     * Creates a row of attack numbers for each player
     *
     * @param {Array<Player>} players
     * @param {number} playerIndex
     * @param {number} rollIndex
     * @param {number} roundIndex
     * @param {RenderPhases} renderPhase
     * @memberof DarumaTrainingBoard
     * @returns {string}
     */
    createAttackAndTotalRows = (
        players: Array<Player>,
        playerIndex: number,
        rollIndex: number,
        roundIndex: number,
        renderPhase: RenderPhases
    ): string => {
        const rows: Array<string> = [];
        // For each player
        players.map((player: Player, index: number) => {
            const { rounds } = player.roundsData;

            // check if it is or has been players turn yet to determine if we should show the attack roll
            const isTurn = index === playerIndex;
            const hasBeenTurn = index < playerIndex;
            const notTurnYet = index > playerIndex;

            const attackRow = this.createAttackRow(
                rounds,
                roundIndex,
                rollIndex,
                isTurn,
                renderPhase,
                hasBeenTurn
            );
            attackRow.splice(1, 0, this.ATTACK_ROW_SPACER);
            rows.push(attackRow.join(''));

            // add round total row
            const totalRow = this.createTotalRow(
                roundIndex,
                rollIndex,
                rounds,
                renderPhase,
                hasBeenTurn,
                notTurnYet
            );
            totalRow.splice(1, 0, this.ROUND_AND_TOTAL_SPACER);
            rows.push(`__${totalRow.join('')}__`);
        });

        return rows.join('\n');
    };
}
