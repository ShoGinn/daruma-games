import { blockQuote, bold, strikethrough } from 'discord.js';

import pad from 'lodash/pad.js';

import {
  EMOJI_RENDER_PHASE,
  GIF_RENDER_PHASE,
  IGameBoardRender,
  IGameTurnState,
  RenderPhase,
} from '../../enums/daruma-training.js';
import type { RollData, RoundData } from '../../model/types/daruma-training.js';
import { EmojiConfig, emojiConvert, GameEmojis } from '../functions/dt-emojis.js';

export const boardConstants = {
  TURNS_IN_ROUND: 3,
  ROUNDS_IN_EMBED: 2,
  ROUND_WIDTH: 20,
  ATTACK_ROW_SPACER: '\t',
  ROUND_AND_TOTAL_SPACER: '\t',
};
export const darumaTrainingBoard = {
  blankRow(): string {
    return ' '.repeat(boardConstants.ROUND_WIDTH);
  },
  horizontalRule(): string {
    return strikethrough(
      `${this.blankRow()}${boardConstants.ROUND_AND_TOTAL_SPACER}${this.blankRow()}`,
    );
  },
  getImageType(
    roll: RollData | undefined,
    isPreviousRoll: boolean,
    isCurrentRoll: boolean,
    isTurnRoll: boolean,
    renderPhase: RenderPhase,
    hasBeenTurn: boolean,
  ): string | number {
    const rollDamage = roll?.damage ?? EmojiConfig.PH;

    if (isPreviousRoll) {
      return rollDamage;
    }

    if (isCurrentRoll && isTurnRoll) {
      if (renderPhase === GIF_RENDER_PHASE) {
        return EmojiConfig.Roll;
      } else if (renderPhase === EMOJI_RENDER_PHASE) {
        return rollDamage;
      }
    } else if (isCurrentRoll && !isTurnRoll) {
      return hasBeenTurn ? rollDamage : EmojiConfig.PH;
    }

    return EmojiConfig.PH;
  },
  createRoundCell(roundNumber: string | number = ' '): string {
    if (typeof roundNumber === 'number') {
      roundNumber = roundNumber.toString();
    }
    return pad(roundNumber, boardConstants.ROUND_WIDTH);
  },

  createRoundRow(): string {
    const centeredRound = pad(bold('ROUND'.toUpperCase()), boardConstants.ROUND_WIDTH * 2);
    return blockQuote(centeredRound) + '\u200B';
  },

  createRoundNumberRow(roundIndex: number): string {
    const isFirstRound = roundIndex === 0;
    const roundNumber = roundIndex + 1;
    const roundNumberEmoji = emojiConvert(roundNumber.toString());
    const previousRoundNumberEmoji = emojiConvert((roundNumber - 1).toString());
    const roundNumberRow: string[] = [];

    for (let index = 0; index < boardConstants.ROUNDS_IN_EMBED; index++) {
      if (isFirstRound && index === 1) {
        roundNumberRow.push(darumaTrainingBoard.createRoundCell());
      } else if (!isFirstRound && index === 0) {
        roundNumberRow.push(darumaTrainingBoard.createRoundCell(previousRoundNumberEmoji));
      } else {
        roundNumberRow.push(darumaTrainingBoard.createRoundCell(roundNumberEmoji));
      }
    }

    roundNumberRow.splice(1, 0, boardConstants.ROUND_AND_TOTAL_SPACER);
    return roundNumberRow.join('') + '\u200B';
  },

  createAttackRow(
    playerRounds: RoundData[],
    gameBoardRender: IGameBoardRender,
    turnState: IGameTurnState,
  ): string[] {
    const { roundState } = gameBoardRender;
    const { roundIndex, rollIndex, phase } = roundState;
    const { isTurn, hasBeenTurn } = turnState;
    const attackRow: string[] = [];
    const joinSpaces = ' ';

    const previousRound = playerRounds[roundIndex - 1];
    const currentRound = playerRounds[roundIndex];

    if (previousRound) {
      const previousRoundArray: string[] = [];
      for (let index = 0; index < boardConstants.TURNS_IN_ROUND; index++) {
        const roll = previousRound?.rolls[index];
        previousRoundArray.push(GameEmojis.getGameEmoji(roll?.damage));
      }
      attackRow.push(previousRoundArray.join(joinSpaces));
    }

    const currentRoundArray: string[] = [];
    for (let index = 0; index < boardConstants.TURNS_IN_ROUND; index++) {
      const isCurrentRoll = index === rollIndex;
      const isPreviousRoll = index < rollIndex;
      const isTurnRoll = isCurrentRoll && isTurn;

      const roll = currentRound?.rolls[index];
      const emoji = this.getImageType(
        roll,
        isPreviousRoll,
        isCurrentRoll,
        isTurnRoll,
        phase,
        hasBeenTurn,
      );
      currentRoundArray.push(GameEmojis.getGameEmoji(emoji));
    }
    attackRow.push(currentRoundArray.join(joinSpaces));

    if (!previousRound) {
      const round1PlaceHolders: string[] = [];
      for (let index = 0; index < boardConstants.TURNS_IN_ROUND; index++) {
        round1PlaceHolders.push(GameEmojis.getGameEmoji(EmojiConfig.PH));
      }
      attackRow.push(round1PlaceHolders.join(joinSpaces));
    }
    attackRow.splice(1, 0, boardConstants.ATTACK_ROW_SPACER);

    return attackRow;
  },

  createTotalRow(
    playerRounds: RoundData[],
    gameBoardRender: IGameBoardRender,
    turnState: IGameTurnState,
  ): string[] {
    const { roundState } = gameBoardRender;
    const { roundIndex, rollIndex, phase } = roundState;
    const { notTurnYet, hasBeenTurn } = turnState;
    const isFirstRound = roundIndex === 0;
    const totalRow: string[] = [];

    for (let index = 0; index < boardConstants.ROUNDS_IN_EMBED; index++) {
      const rolls = playerRounds[roundIndex - 1]?.rolls || [];
      const previousRoundTotal = rolls.at(-1)?.totalScore || undefined;

      const totalRollIndex =
        (phase !== EMOJI_RENDER_PHASE || notTurnYet) && !hasBeenTurn ? rollIndex - 1 : rollIndex;

      const currentRoundTotal =
        playerRounds[roundIndex]?.rolls[totalRollIndex]?.totalScore || undefined;

      const boldedCurrentRoundTotal = currentRoundTotal
        ? bold(currentRoundTotal.toString().padStart(2))
        : undefined;
      const boldedPreviousRoundTotal = previousRoundTotal
        ? bold(previousRoundTotal.toString().padStart(2))
        : undefined;

      if (isFirstRound && index === 1) {
        totalRow.push(darumaTrainingBoard.createRoundCell());
      } else if (!isFirstRound && index === 0) {
        totalRow.push(darumaTrainingBoard.createRoundCell(boldedPreviousRoundTotal));
      } else {
        totalRow.push(darumaTrainingBoard.createRoundCell(boldedCurrentRoundTotal));
      }
    }
    totalRow.splice(1, 0, boardConstants.ROUND_AND_TOTAL_SPACER);

    return totalRow;
  },

  createAttackAndTotalRows(
    turnState: IGameTurnState,
    playerRounds: RoundData[],
    gameBoardRender: IGameBoardRender,
  ): string[] {
    const attackAndTotalRows: string[] = [];
    const attackRow = darumaTrainingBoard.createAttackRow(playerRounds, gameBoardRender, turnState);
    const totalRow = darumaTrainingBoard.createTotalRow(playerRounds, gameBoardRender, turnState);

    const attackRowString = attackRow.join('') + '\u200B';
    const totalRowString = totalRow.join('') + '\u200B';

    attackAndTotalRows.push(attackRowString, totalRowString, darumaTrainingBoard.horizontalRule());

    return attackAndTotalRows;
  },

  createPlayerRows(gameBoardRender: IGameBoardRender): string {
    const { players, roundState } = gameBoardRender;
    const { playerIndex } = roundState;
    const playerRows: string[] = [];

    if (!players) {
      throw new Error('No players found');
    }

    for (const [index, player] of players.entries()) {
      const { rounds: playerRounds } = player.roundsData;

      const turnState: IGameTurnState = {
        isTurn: index === playerIndex,
        hasBeenTurn: index < playerIndex,
        notTurnYet: index > playerIndex,
      };

      const playerRow = darumaTrainingBoard.createAttackAndTotalRows(
        turnState,
        playerRounds,
        gameBoardRender,
      );

      playerRows.push(playerRow.join('\n'));
    }

    return playerRows.join('\n');
  },

  renderBoard(gameBoardRender: IGameBoardRender): string {
    const { roundState } = gameBoardRender;
    const board: string[] = [];

    board.push(
      darumaTrainingBoard.createRoundRow(),
      darumaTrainingBoard.createRoundNumberRow(roundState.roundIndex),
      darumaTrainingBoard.horizontalRule(),
      darumaTrainingBoard.createPlayerRows(gameBoardRender),
    );

    return board.join('\n');
  },
};
