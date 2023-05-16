import type { RollData, RoundData } from '../../model/types/daruma-training.js';
import { blockQuote, bold, strikethrough } from 'discord.js';
import pad from 'lodash/pad.js';

import {
    EMOJI_RENDER_PHASE,
    GIF_RENDER_PHASE,
    IGameBoardRender,
    IGameTurnState,
    RenderPhase,
} from '../../enums/daruma-training.js';
import { emojiConvert, getGameEmoji } from '../functions/dt-emojis.js';

export class DarumaTrainingBoard {
    TURNS_IN_ROUND = 3;
    ROUNDS_IN_EMBED = 2;
    ROUND_WIDTH = 20;
    ATTACK_ROW_SPACER = '\t';
    ROUND_AND_TOTAL_SPACER = '\t';
    BLANK_ROW = ' '.repeat(this.ROUND_WIDTH);
    HORIZONTAL_RULE = `${strikethrough(
        `${this.BLANK_ROW}${this.ROUND_AND_TOTAL_SPACER}${this.BLANK_ROW}`
    )}`;

    getImageType = (
        roll: RollData | undefined,
        isPreviousRoll: boolean,
        isCurrentRoll: boolean,
        isTurnRoll: boolean,
        renderPhase: RenderPhase,
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
            if (renderPhase === GIF_RENDER_PHASE) {
                return `roll`;
            } else if (renderPhase === EMOJI_RENDER_PHASE) {
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
        return pad(roundNumber, this.ROUND_WIDTH);
    };
    createRoundRow(): string {
        const centeredRound = pad(bold('ROUND'.toUpperCase()), this.ROUND_WIDTH * 2);
        return blockQuote(centeredRound) + '\u200B';
    }

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
        // Add the zero width space to the end of the row to prevent discord from
        // collapsing the row
        return roundNumberRow.join('') + '\u200B';
    }
    createAttackRow = (
        playerRounds: Array<RoundData>,
        gameBoardRender: IGameBoardRender,
        turnState: IGameTurnState
    ): Array<string> => {
        const { roundState } = gameBoardRender;
        const { roundIndex, rollIndex, phase } = roundState;
        const { isTurn, hasBeenTurn } = turnState;
        const attackRow: Array<string> = [];
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
            attackRow.push(previousRoundArray.join(joinSpaces));
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
                phase,
                hasBeenTurn
            );
            currentRoundArray.push(getGameEmoji(emoji));
        }
        attackRow.push(currentRoundArray.join(joinSpaces));

        // ROUND POSITION 1 PLACEHOLDERS
        if (!previousRound) {
            const round1PlaceHolders: Array<string> = [];
            for (let index = 0; index < this.TURNS_IN_ROUND; index++) {
                // new array of emoji placeholders
                round1PlaceHolders.push(getGameEmoji('ph'));
            }
            attackRow.push(round1PlaceHolders.join(joinSpaces));
        }
        attackRow.splice(1, 0, this.ATTACK_ROW_SPACER);

        return attackRow;
    };

    createTotalRow = (
        playerRounds: Array<RoundData>,
        gameBoardRender: IGameBoardRender,
        turnState: IGameTurnState
    ): Array<string> => {
        const { roundState } = gameBoardRender;
        const { roundIndex, rollIndex, phase } = roundState;
        const { notTurnYet, hasBeenTurn } = turnState;
        const isFirstRound = roundIndex === 0;
        const totalRow: Array<string> = [];
        // for each round
        for (let index = 0; index <= this.ROUNDS_IN_EMBED - 1; index++) {
            // previous total is static as round has been completed
            const rolls = playerRounds[roundIndex - 1]?.rolls || [];

            const previousRoundTotal = rolls.at(-1)?.totalScore || undefined;

            const totalRollIndex =
                (phase !== EMOJI_RENDER_PHASE || notTurnYet) && !hasBeenTurn
                    ? rollIndex - 1
                    : rollIndex;

            const currentRoundTotal =
                playerRounds[roundIndex]?.rolls[totalRollIndex]?.totalScore || undefined;

            const boldedCurrentRoundTotal = currentRoundTotal
                ? bold(currentRoundTotal.toString().padStart(2))
                : undefined;
            const boldedPreviousRoundTotal = previousRoundTotal
                ? bold(previousRoundTotal.toString().padStart(2))
                : undefined;
            // if first round, only the first element should have a label
            if (isFirstRound && index === 1) {
                totalRow.push(this.createRoundCell());
            } else if (!isFirstRound && index === 0) {
                // as long as we're not in the first round, the first round is previous
                totalRow.push(this.createRoundCell(boldedPreviousRoundTotal));
            } else {
                totalRow.push(this.createRoundCell(boldedCurrentRoundTotal));
            }
        }
        totalRow.splice(1, 0, this.ROUND_AND_TOTAL_SPACER);

        return totalRow;
    };
    createAttackAndTotalRows = (
        turnState: IGameTurnState,
        playerRounds: Array<RoundData>,
        gameBoardRender: IGameBoardRender
    ): Array<string> => {
        const attackAndTotalRows: Array<string> = [];
        const attackRow = this.createAttackRow(playerRounds, gameBoardRender, turnState);
        const totalRow = this.createTotalRow(playerRounds, gameBoardRender, turnState);
        // Add the zero width space to the end of the row to prevent discord from
        // collapsing the row
        const attackRowString = attackRow.join('') + '\u200B';
        const totalRowString = totalRow.join('') + '\u200B';
        attackAndTotalRows.push(attackRowString, totalRowString, this.HORIZONTAL_RULE);
        return attackAndTotalRows;
    };
    createPlayerRows = (gameBoardRender: IGameBoardRender): string => {
        const { players, roundState } = gameBoardRender;
        const { playerIndex } = roundState;
        const playerRows: Array<string> = [];

        if (!players) {
            throw new Error('No players found');
        }

        for (const [index, player] of players.entries()) {
            const { rounds: playerRounds } = player.roundsData;

            // check if it is or has been players turn yet to determine if we should show the attack roll
            const turnState: IGameTurnState = {
                isTurn: index === playerIndex,
                hasBeenTurn: index < playerIndex,
                notTurnYet: index > playerIndex,
            };
            const playerRow = this.createAttackAndTotalRows(
                turnState,
                playerRounds,
                gameBoardRender
            );
            playerRows.push(playerRow.join('\n'));
        }
        return playerRows.join('\n');
    };

    public renderBoard(gameBoardRender: IGameBoardRender): string {
        const { roundState } = gameBoardRender;

        const board: Array<string> = [];
        // create a row representing the current round
        board.push(
            this.createRoundRow(),
            this.createRoundNumberRow(roundState.roundIndex),
            this.HORIZONTAL_RULE,
            this.createPlayerRows(gameBoardRender)
        );
        return board.join('\n');
    }
}
