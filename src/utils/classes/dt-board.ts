import type { RollData, RoundData } from '../../model/types/daruma-training.js';
import { blockQuote, bold, strikethrough, underscore } from 'discord.js';

import { Player } from './dt-player.js';
import { RenderPhases } from '../../enums/daruma-training.js';
import { emojiConvert, getGameEmoji } from '../functions/dt-emojis.js';

export class DarumaTrainingBoard {
    TURNS_IN_ROUND = 3;
    ROUNDS_IN_EMBED = 2;
    ROUND_WIDTH = 20;
    ATTACK_ROW_SPACER = '\t';
    ROUND_AND_TOTAL_SPACER = '\t';

    centerString(space: number, content: string = '', delimiter: string = ' '): string {
        const length = content.length;
        const padSpace = Math.floor((space - length) / 2);
        return content.padStart(length + padSpace, delimiter).padEnd(space, delimiter);
    }

    getImageType = (
        roll: RollData | undefined,
        isPreviousRoll: boolean,
        isCurrentRoll: boolean,
        isTurnRoll: boolean,
        renderPhase: RenderPhases,
        hasBeenTurn: boolean
    ): string | number => {
        const emoji = 'ph';
        const rollDamage = roll?.damage ?? emoji;
        // if it's a previous roll, just show png
        if (isPreviousRoll) {
            return rollDamage;
        }
        // if it's the current players roll and we're in gif render phase add gif
        if (isCurrentRoll && isTurnRoll) {
            if (renderPhase === RenderPhases.GIF) {
                return `roll`;
            } else if (renderPhase === RenderPhases.EMOJI) {
                return rollDamage;
            }
        } else if (isCurrentRoll && !isTurnRoll) {
            return hasBeenTurn ? rollDamage : 'ph';
        }

        return emoji;
    };
    createRoundCell = (roundNumber: string | number = ' '): string => {
        if (typeof roundNumber === 'number') {
            roundNumber = roundNumber.toString();
        }
        return this.centerString(this.ROUND_WIDTH, roundNumber);
    };

    createRoundNumberRow(roundIndex: number): string {
        const isFirstRound = roundIndex === 0;
        const roundNumber = roundIndex + 1;
        const roundNumberEmoji = emojiConvert(roundNumber.toString());
        const previousRoundNumberEmoji = emojiConvert((roundNumber - 1).toString());
        const roundNumberRow: Array<string> = [];
        // for each row
        for (let index = 0; index <= this.ROUNDS_IN_EMBED - 1; index++) {
            // if first round, only the first element should have a label
            if (isFirstRound && index === 1) {
                roundNumberRow.push(this.createRoundCell());
            } else if (!isFirstRound && index === 0) {
                // as long as we're not in the first round, the first round features
                // the previous round number
                roundNumberRow.push(this.createRoundCell(previousRoundNumberEmoji));
            } else {
                roundNumberRow.push(this.createRoundCell(roundNumberEmoji));
            }
        }
        roundNumberRow.splice(1, 0, this.ROUND_AND_TOTAL_SPACER);
        return roundNumberRow.join('');
    }
    createAttackRow = (
        playerRounds: Array<RoundData>,
        roundIndex: number,
        rollIndex: number,
        renderPhase: RenderPhases,
        hasBeenTurn: boolean,
        isTurn: boolean
    ): Array<string> => {
        const row: Array<string> = [];
        const joinSpaces = ` `;
        // grab the previous round
        const previousRound = playerRounds[roundIndex - 1];
        // grab the current round
        const currentRound = playerRounds[roundIndex];

        // ROUND POSITION 0
        if (previousRound) {
            const previousRoundArray: Array<string> = [];
            for (let index = 0; index < this.TURNS_IN_ROUND; index++) {
                const roll = previousRound?.rolls[index];
                previousRoundArray.push(getGameEmoji(roll?.damage));
            }
            row.push(previousRoundArray.join(joinSpaces));
        }

        // ROUND POSITION 1
        const currentRoundArray: Array<string> = [];
        for (let index = 0; index < this.TURNS_IN_ROUND; index++) {
            // if the round is too high or the roll is too high, return a blank cell
            const isCurrentRoll = index === rollIndex;
            const isPreviousRoll = index < rollIndex;
            const isTurnRoll = isCurrentRoll && isTurn;

            // if it is the current players turn, and we are on the current round
            const roll = currentRound?.rolls[index];
            const emoji = this.getImageType(
                roll,
                isPreviousRoll,
                isCurrentRoll,
                isTurnRoll,
                renderPhase,
                hasBeenTurn
            );
            currentRoundArray.push(getGameEmoji(emoji));
        }
        row.push(currentRoundArray.join(joinSpaces));

        // ROUND POSITION 1 PLACEHOLDERS
        if (!previousRound) {
            const round1PlaceHolders: Array<string> = [];
            for (let index = 0; index < this.TURNS_IN_ROUND; index++) {
                // new array of emoji placeholders
                round1PlaceHolders.push(getGameEmoji('ph'));
            }
            row.push(round1PlaceHolders.join(joinSpaces));
        }
        return row;
    };

    createTotalRow = (
        playerRounds: Array<RoundData>,
        roundIndex: number,
        rollIndex: number,
        renderPhase: RenderPhases,
        hasBeenTurn: boolean,
        notTurnYet: boolean
    ): Array<string> => {
        const isFirstRound = roundIndex === 0;
        const totalRowLabel: Array<string> = [];
        // for each round
        for (let index = 0; index <= this.ROUNDS_IN_EMBED - 1; index++) {
            // previous total is static as round has been completed
            const rolls = playerRounds[roundIndex - 1]?.rolls || [];

            const previousRoundTotal = rolls[rolls.length - 1]?.totalScore || undefined;

            const totalRollIndex =
                (renderPhase !== RenderPhases.EMOJI || notTurnYet) && !hasBeenTurn
                    ? rollIndex - 1
                    : rollIndex;

            const currentRoundTotal =
                playerRounds[roundIndex]?.rolls[totalRollIndex]?.totalScore || undefined;

            const boldedCurrentRoundTotal = currentRoundTotal
                ? bold(currentRoundTotal.toString())
                : undefined;
            const boldedPreviousRoundTotal = previousRoundTotal
                ? bold(previousRoundTotal.toString())
                : undefined;
            // if first round, only the first element should have a label
            if (isFirstRound && index === 1) {
                totalRowLabel.push(this.createRoundCell());
            } else if (!isFirstRound && index === 0) {
                // as long as we're not in the first round, the first round is previous
                totalRowLabel.push(this.createRoundCell(boldedPreviousRoundTotal));
            } else {
                totalRowLabel.push(this.createRoundCell(boldedCurrentRoundTotal));
            }
        }
        totalRowLabel.push(`\t\t${bold('Hits')}`);

        return totalRowLabel;
    };
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
            const { rounds: playerRounds } = player.roundsData;

            // check if it is or has been players turn yet to determine if we should show the attack roll
            const isTurn = index === playerIndex;
            const hasBeenTurn = index < playerIndex;
            const notTurnYet = index > playerIndex;

            const attackRow = this.createAttackRow(
                playerRounds,
                roundIndex,
                rollIndex,
                renderPhase,
                hasBeenTurn,
                isTurn
            );
            attackRow.splice(1, 0, this.ATTACK_ROW_SPACER);
            rows.push(attackRow.join(''));

            // add round total row
            const totalRow = this.createTotalRow(
                playerRounds,
                roundIndex,
                rollIndex,
                renderPhase,
                hasBeenTurn,
                notTurnYet
            );
            totalRow.splice(1, 0, this.ROUND_AND_TOTAL_SPACER);
            rows.push(underscore(totalRow.join('')));
        });

        return rows.join('\n');
    };

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
        const horizontalRule = strikethrough(
            `${blankRow}${this.ROUND_AND_TOTAL_SPACER}${blankRow}`
        );
        // create a row representing the current round
        board.push(
            blockQuote(this.centerString(horizontalRule.length - 4, bold('ROUND'))),
            `\n`,
            `${this.createRoundNumberRow(roundIndex)}`,
            `\n`,
            horizontalRule,
            this.createAttackAndTotalRows(players, playerIndex, rollIndex, roundIndex, renderPhase)
        );
        return board.join('\n');
    }
}
