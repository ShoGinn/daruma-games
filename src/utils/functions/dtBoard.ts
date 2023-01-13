import { emojiConvert, emojis } from './dtEmojis.js';
import { RenderPhases } from '../../enums/dtEnums.js';
import { Player } from '../classes/dtPlayer.js';

const turnsInRound = 3;
const roundsInEmbed = 2;
const roundWidth = 20;
const attackRowSpacer = '\t';
const roundAndTotalSpacer = '\t';
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
    const board = [];
    const blankRow = ' '.repeat(roundWidth);
    const horizontalRule = '~~' + blankRow + roundAndTotalSpacer + blankRow + '~~';
    // create a row representing the current round
    board.push('>>> ' + centerString(horizontalRule.length - 4, '***ROUND***') + '\n');
    board.push(createRoundNumberRow(roundIndex) + '\n');
    // create a row of blank spaces double roundWidth
    board.push(horizontalRule);
    // create a row displaying attack numbers for each player
    // as well as a row displaying the total
    board.push(createAttackAndTotalRows(players, playerIndex, rollIndex, roundIndex, renderPhase));

    return board.join('\n');
}

/**
 * Creates row which takes into account the current and potentially previous row
 * @param roundNumber
\ * @param isFirstRound
 * @returns {string}
 */
function createRoundNumberRow(roundIndex: number): string {
    const isFirstRound = roundIndex === 0;
    const roundNumber = roundIndex + 1;
    const roundNumberEmoji = emojiConvert(roundNumber.toString());
    const prevRoundNumberEmoji = emojiConvert((roundNumber - 1).toString());
    const roundNumberRow: string[] = [];
    // for each row
    for (let i = 0; i <= roundsInEmbed - 1; i++) {
        // if first round, only the first element should have a label
        if (isFirstRound && i === 1) {
            roundNumberRow.push(createRoundCell());
        } else if (!isFirstRound && i === 0) {
            // as long as we're not in the first round, the first round features
            // the previous round number
            roundNumberRow.push(createRoundCell(prevRoundNumberEmoji));
        } else {
            roundNumberRow.push(createRoundCell(roundNumberEmoji));
        }
    }
    roundNumberRow.splice(1, 0, roundAndTotalSpacer);
    return roundNumberRow.join('');
}

/**
 * Creates single cell with roundNumber
 * @param roundNum
 * @returns {number}
 */
const createRoundCell = (roundNum?: number | string): string => {
    let cell = ' ';
    let stringNum = roundNum || ' ';
    if (typeof stringNum === 'number') {
        stringNum = stringNum.toString();
    }
    cell = centerString(roundWidth, stringNum);
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
    const rows: string[] = [];
    // For each player
    players.map((player: Player, index: number) => {
        const { rounds } = player.roundsData;

        // check if it is or has been players turn yet to determine if we should show the attack roll
        const isTurn = index === playerIndex;
        const hasBeenTurn = index < playerIndex;
        const notTurnYet = index > playerIndex;

        const attackRow = createAttackRow(
            rounds,
            roundIndex,
            rollIndex,
            isTurn,
            renderPhase,
            hasBeenTurn
        );
        attackRow.splice(1, 0, attackRowSpacer);
        rows.push(attackRow.join(''));

        // add round total row
        const totalRow = createTotalRow(
            roundIndex,
            rollIndex,
            rounds,
            renderPhase,
            hasBeenTurn,
            notTurnYet
        );
        totalRow.splice(1, 0, roundAndTotalSpacer);
        rows.push(`__${totalRow.join('')}__`);
    });

    return rows.join('\n');
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
): string[] => {
    const row: string[] = [];
    const joinSpaces = ` `;
    // grab the previous round
    const prevRound = playerRounds[roundIndex - 1];
    // grab the current round
    const currentRound = playerRounds[roundIndex];

    // ROUND POSITION 0
    if (prevRound) {
        const prevRoundArr: string[] = [];
        for (let index = 0; index < turnsInRound; index++) {
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
    const curRoundArr: string[] = [];
    for (let index = 0; index < turnsInRound; index++) {
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
        curRoundArr.push(emojis[emoji]);
    }
    row.push(curRoundArr.join(joinSpaces));

    // ROUND POSITION 1 PLACEHOLDERS
    if (!prevRound) {
        const round1PlaceHolders: string[] = [];
        for (let index = 0; index < turnsInRound; index++) {
            // new array of emoji placeholders
            round1PlaceHolders.push(emojis.ph);
        }
        row.push(round1PlaceHolders.join(joinSpaces));
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
 * Creates a row of total damage for each round
 * @param roundIndex
 * @param rollIndex
 * @param rounds
 * @returns
 */
const createTotalRow = (
    roundIndex: number,
    rollIndex: number,
    rounds: DarumaTrainingPlugin.RoundData[],
    renderPhase: RenderPhases,
    hasBeenTurn: boolean,
    notTurnYet: boolean
): string[] => {
    const isFirstRound = roundIndex === 0;
    const totalRowLabel: string[] = [];
    // for each round
    for (let i = 0; i <= roundsInEmbed - 1; i++) {
        // previous total is static as round has been completed
        const rolls = rounds[roundIndex - 1]?.rolls || [];

        const prevRoundTotal = rolls[rolls.length - 1]?.totalScore || ' ';

        let totalRollIndex = rollIndex;

        if ((renderPhase !== RenderPhases.EMOJI || notTurnYet) && !hasBeenTurn) {
            totalRollIndex = rollIndex - 1;
        }

        const currRoundTotal = rounds[roundIndex]?.rolls[totalRollIndex]?.totalScore || ' ';
        // if first round, only the first element should have a label
        if (isFirstRound && i === 1) {
            totalRowLabel.push(createRoundCell());
        } else if (!isFirstRound && i === 0) {
            // as long as we're not in the first round, the first round is previous
            totalRowLabel.push(createRoundCell(`***${prevRoundTotal}***`));
        } else {
            totalRowLabel.push(createRoundCell(`***${currRoundTotal}***`));
        }
    }
    totalRowLabel.push(`\t\t**Hits**`);

    return totalRowLabel;
};
function centerString(space: number, content: string = '', delimiter: string = ' '): string {
    const len = content.length;
    const centered = content
        .padStart(len + Math.floor((space - len) / 2), delimiter)
        .padEnd(space, delimiter);
    return centered;
}
