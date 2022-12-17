import { Alignment, RenderPhases } from '../../enums/dtEnums.js';
import { emojis } from '../functions/dtEmojis.js';
import { Player } from './dtPlayer.js';

/**
 * Configuration for board rendering
 * Includes rendering settings and board sizing
 */
export class BoardConfig {
    private cellWidth: number;
    private roundPadding: number;
    private numOfRoundsVisible: number;
    private turnsInRound: number;

    constructor(cellWidth: number, roundPadding: number, numberOfRoundsVisible: number) {
        this.cellWidth = cellWidth;
        this.roundPadding = roundPadding;
        this.numOfRoundsVisible = numberOfRoundsVisible;
        this.turnsInRound = 3;
    }

    getRoundWidth(): number {
        return this.cellWidth * this.turnsInRound + this.roundPadding;
    }

    getSettings(): {
        roundWidth: number;
        cellWidth: number;
        roundPadding: number;
        numOfRoundsVisible: number;
        turnsInRound: number;
    } {
        return {
            roundWidth: this.getRoundWidth(),
            cellWidth: this.cellWidth,
            roundPadding: this.roundPadding,
            numOfRoundsVisible: this.numOfRoundsVisible,
            turnsInRound: this.turnsInRound,
        };
    }
}
const defaultBoard = new BoardConfig(4, 3, 2);

// import in absolute values for board sizing
const { roundWidth, cellWidth, roundPadding, numOfRoundsVisible, turnsInRound } =
    defaultBoard.getSettings();

/**
 * Create a row of total damage with blank spaces factored in
 *
 * @export
 * @param {number} rollIndex
 * @param {number} roundIndex
 * @param {number} playerIndex
 * @param {Player[]} players
 * @param {RenderPhases} renderPhase
 * @returns {*}  {string}
 */
export function renderBoard(
    rollIndex: number,
    roundIndex: number,
    playerIndex: number,
    players: Player[],
    renderPhase: RenderPhases
    // isLastRender: boolean
): string {
    const roundRightColumn = `\t**ROUND**`;
    // create a row representing the current round
    const roundNumberRow = createRoundNumberRow(roundIndex, 2) + roundRightColumn;
    // create a row displaying attack numbers for each player
    // as well as a row displaying the total
    const attackAndTotalRows = createAttackAndTotalRows(
        players,
        playerIndex,
        rollIndex,
        roundIndex,
        renderPhase
    );

    const board = roundNumberRow + '\n' + attackAndTotalRows;

    return board;
}

/**
 * Creates row which takes into account the current and potentially previous row
 * @param roundNumber
 * @param roundsOnEmbed
 * @param isFirstRound
 * @returns {string}
 */
const createRoundNumberRow = (roundIndex: number, roundsOnEmbed: number): string => {
    const isFirstRound = roundIndex === 0;
    const roundNumber = roundIndex + 1;
    let roundNumberRowLabel = '';
    // for each row
    for (let i = 0; i <= roundsOnEmbed - 1; i++) {
        // if first round, only the first element should have a label
        if (isFirstRound && i === 1) {
            roundNumberRowLabel += createRoundCell();
        } else if (!isFirstRound && i === 0) {
            // as long as we're not in the first round, the first round features
            // the previous round number
            roundNumberRowLabel += createRoundCell(roundNumber - 1);
        } else {
            roundNumberRowLabel += createRoundCell(roundNumber);
        }
        // add round padding
        if (i === 0) {
            roundNumberRowLabel += `\t`;
        }
    }
    return roundNumberRowLabel;
};

/**
 * Creates single cell with roundNumber
 * @param roundNum
 * @returns {number}
 */
const createRoundCell = (roundNum?: number): string => {
    let cell = '';
    if (roundNum) {
        const stringNum = roundNum.toString();
        // if shorter than 2 digits prepend a 0
        cell += createCell(roundWidth, Alignment.centered, stringNum, false, '-');
    } else {
        cell = createWhitespace(roundWidth, '-');
    }
    // return just space if no round number
    if (roundNum === 0) {
        cell += `\t`;
    }
    return cell;
};

/**
 * Creates an attack and total damage roll for each player in the game
 * @param players
 * @param playerIndex
 * @param rollIndex
 * @param roundNumber
 * @param isFirstRound
 * @returns {string}
 */
const createAttackAndTotalRows = (
    players: Player[],
    playerIndex: number,
    rollIndex: number,
    roundIndex: number,
    renderPhase: RenderPhases
): string => {
    let rows = ``;
    // For each player
    players.forEach((player: Player, index: number) => {
        const { rounds } = player.roundsData;

        // check if it is or has been players turn yet to determine if we should show the attack roll
        const isTurn = index === playerIndex;
        const hasBeenTurn = index < playerIndex;
        const notTurnYet = index > playerIndex;

        rows +=
            createAttackRow(rounds, roundIndex, rollIndex, isTurn, renderPhase, hasBeenTurn) + '\n';

        const totalRightColumn = `\t**Hits**`;
        // add round total row
        rows +=
            createTotalRow(
                roundIndex,
                rollIndex,
                rounds,
                renderPhase,
                isTurn,
                hasBeenTurn,
                notTurnYet
            ) +
            totalRightColumn +
            '\n';
    });

    return rows;
};

/**
 * Create a row of attacks with blank spaces factored in
 * Currently only works for 2 rounds
 * @param playerRolls
 * @returns {string}
 */
const createAttackRow = (
    playerRounds: DarumaTrainingPlugin.RoundData[],
    roundIndex: number,
    rollIndex: number,
    isTurn: boolean,
    renderPhase: RenderPhases,
    hasBeenTurn: boolean
): string => {
    let row = ' ';
    let spaceBetweenRound = `\t\t\t`;
    // grab the previous round
    const prevRound = playerRounds[roundIndex - 1];
    // grab the current round
    const currentRound = playerRounds[roundIndex];

    // TODO: make this dynamic
    // ROUND POSITION 0
    if (prevRound) {
        Array.from({ length: turnsInRound }).forEach((_, index: number) => {
            const roll = prevRound.rolls[index];
            if (roll?.damage) {
                row += createCell(cellWidth, Alignment.centered, emojis[`${roll.damage}png`], true);
            } else {
                row += createCell(cellWidth, Alignment.centered, emojis.ph, true);
            }
        });
        row += spaceBetweenRound;
    }

    // ROUND POSITION 1
    Array.from({ length: turnsInRound }).forEach((_, index: number) => {
        // if the round is too high or the roll is too high, return a blank cell
        const isCurrentRoll = index === rollIndex;
        const isPrevRoll = index < rollIndex;
        const isTurnRoll = isCurrentRoll && isTurn;

        // if it is the current players turn, and we are on the current round
        const roll = currentRound.rolls[index];
        const emoji = getImageType(
            roll,
            isPrevRoll,
            isCurrentRoll,
            isTurnRoll,
            renderPhase,
            hasBeenTurn
        );
        row += createCell(cellWidth, Alignment.centered, emojis[emoji], true);
    });

    // ROUND POSITION 1 PLACEHOLDERS
    if (!prevRound) {
        row += spaceBetweenRound;
        Array.from({ length: roundPadding }).forEach(() => {
            row += createCell(cellWidth, Alignment.centered, emojis.ph, true);
        });
    }
    return row;
};

const getImageType = (
    roll: DarumaTrainingPlugin.RollData,
    isPrevRoll: boolean,
    isCurrentRoll: boolean,
    isTurnRoll: boolean,
    renderPhase: RenderPhases,
    hasBeenTurn: boolean
): string => {
    let emoji = 'ph';

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
 * Creates a row of total damage for each round
 * @param roundIndex
 * @param rollIndex
 * @param rounds
 * @param isTurn
 * @returns
 */
const createTotalRow = (
    roundIndex: number,
    rollIndex: number,
    rounds: DarumaTrainingPlugin.RoundData[],
    renderPhase: RenderPhases,
    isTurn: boolean,
    hasBeenTurn: boolean,
    notTurnYet: boolean
): string => {
    const isFirstRound = roundIndex === 0;
    let totalRowLabel = '';
    // for each round
    for (let i = 0; i <= numOfRoundsVisible - 1; i++) {
        // previous total is static as round has been completed
        const prevRoundTotal = rounds[roundIndex - 1]?.totalDamageSoFar;

        let totalRollIndex = rollIndex;

        if ((renderPhase !== RenderPhases.EMOJI || notTurnYet) && !hasBeenTurn) {
            totalRollIndex = rollIndex - 1;
        }

        const currRoundTotal = rounds[roundIndex]?.rolls[totalRollIndex]?.totalScore;
        // if first round, only the first element should have a label
        if (isFirstRound && i === 1) {
            totalRowLabel += createRoundCell();
        } else if (!isFirstRound && i === 0) {
            // as long as we're not in the first round, the first round is previous
            totalRowLabel += createRoundCell(prevRoundTotal);
        } else {
            totalRowLabel += createRoundCell(currRoundTotal);
        }
        // add round padding
        if (i === 0) {
            totalRowLabel += `\t`;
        }
    }
    return totalRowLabel;
};
/**
 * Takes a set length and inserts a string into said length
 * can position the string at start, middle or end
 * @export
 * @param {number} space
 * @param {Alignment} [alignment=Alignment.centered]
 * @param {string} [content='']
 * @param {boolean} emoji
 * @param {string} [delimiter]
 * @param {number} [shift=0]
 * @returns {*}  {string}
 */
function createCell(
    space: number,
    alignment: Alignment = Alignment.centered,
    content: string = '',
    emoji: boolean,
    delimiter?: string,
    shift: number = 0
): string {
    let indexToPrintContent: number;
    // create initial space
    const whitespace = createWhitespace(space, delimiter);

    switch (alignment) {
        case Alignment.left:
            indexToPrintContent = 0;
            break;
        case Alignment.right:
            indexToPrintContent = space - content.length;
            break;
        case Alignment.centered: {
            const len = emoji ? 3 : content.length;
            const median = Math.floor(space / 2);
            indexToPrintContent = median - Math.floor(len / 2);
            break;
        }
        default:
            indexToPrintContent = 0;
    }

    return replaceAt(indexToPrintContent + shift, content, whitespace);
}
/**
 * Takes a string and replaces a character at a given index
 *
 * @param {number} index
 * @param {string} [replacement='']
 * @param {string} string
 * @returns {*}  {string}
 */
function replaceAt(index: number, replacement: string = '', string: string): string {
    return string.substring(0, index) + replacement + string.substring(index + replacement.length);
}
/**
 * Takes a number and returns a string of whitespace
 *
 * @export
 * @param {number} spaces
 * @param {string} [delimiter=' ']
 * @returns {*}  {string}
 */
function createWhitespace(spaces: number, delimiter: string = ' '): string {
    let whitespace = '';
    for (let i = 0; i < spaces; i++) {
        whitespace += delimiter;
    }
    return whitespace;
}
