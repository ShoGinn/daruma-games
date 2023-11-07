import { EntityManager, MikroORM } from '@mikro-orm/core';

import {
  EMOJI_RENDER_PHASE,
  GIF_RENDER_PHASE,
  IGameBoardRender,
  IGameTurnState,
  RenderPhase,
} from '../../src/enums/daruma-training.js';
import type { PlayerRoundsData, RollData } from '../../src/model/types/daruma-training.js';
import { boardConstants, darumaTrainingBoard } from '../../src/utils/classes/dt-board.js';
import { playerRoundsDataIncrementingRolls } from '../mocks/mock-player-rounds-data.js';
import { initORM } from '../utils/bootstrap.js';
import { createRandomPlayer } from '../utils/test-funcs.js';

describe('DarumaTrainingBoard', () => {
  let gameData: PlayerRoundsData;
  let gameBoardRender: IGameBoardRender;
  let turnState: IGameTurnState;
  let blankRow: string;
  let spacerRow: string;
  let horizontalRule: string;
  let round1Result: string;
  let round2Result: string;

  beforeEach(() => {
    // create the DarumaTrainingBoard object
    gameData = playerRoundsDataIncrementingRolls;
    blankRow = darumaTrainingBoard.blankRow();
    spacerRow = boardConstants.ATTACK_ROW_SPACER;
    horizontalRule = darumaTrainingBoard.horizontalRule();
    round1Result = ':red_circle: :red_circle: :red_circle:';
    round2Result = ':red_circle: :red_circle: :red_circle:';
    turnState = {
      isTurn: false,
      hasBeenTurn: false,
      notTurnYet: true,
    };
    gameBoardRender = {
      roundState: {
        playerIndex: -1,
        rollIndex: -1,
        roundIndex: -1,
        phase: GIF_RENDER_PHASE,
      },
    };
  });
  describe('getImageType', () => {
    // Test 1 - Get image type for previous roll
    test('should return `roll_damage.png` for a previous roll', () => {
      const roll = { damage: 5 } as RollData;
      const result = darumaTrainingBoard.getImageType(
        roll,
        true,
        false,
        false,
        GIF_RENDER_PHASE,
        false,
      );
      expect(result).toEqual(roll.damage);
    });

    // Test 2 - Get image type for current roll and turn roll
    test('should return `roll` for a current roll in gif render phase', () => {
      const roll = { damage: 5 } as RollData;
      const result = darumaTrainingBoard.getImageType(
        roll,
        false,
        true,
        true,
        GIF_RENDER_PHASE,
        false,
      );
      expect(result).toBe('roll');
    });

    // Test 3 - Get image type for current roll and not turn roll
    test('should return `ph` for a current roll that is not turn roll', () => {
      const roll = { damage: 5 } as RollData;
      const result = darumaTrainingBoard.getImageType(
        roll,
        false,
        true,
        false,
        EMOJI_RENDER_PHASE,
        false,
      );
      expect(result).toBe(`ph`);
    });
    test('should return `ph` for a damage that is undefined', () => {
      const roll = { damage: undefined } as RollData;
      const result = darumaTrainingBoard.getImageType(
        roll,
        false,
        true,
        false,
        EMOJI_RENDER_PHASE,
        false,
      );
      expect(result).toBe(`ph`);
    });
  });
  describe('createRoundCell', () => {
    test('should return a string with the round number centered in the cell equal to the ROUND_WIDTH in length', () => {
      const roundNumber = 1;
      const result = darumaTrainingBoard.createRoundCell(roundNumber);
      expect(result).toContain('         1          ');
      expect(result).toHaveLength(boardConstants.ROUND_WIDTH);
    });
  });
  describe('createRoundRow', () => {
    test('should create the round row with the round number centered in the cell equal to the ROUND_WIDTH in length', () => {
      const result = darumaTrainingBoard.createRoundRow();
      expect(result).toBe('>>>                **ROUND**                \u200B');
    });
  });
  describe('createRoundNumberRow', () => {
    test('First round creates expected string', () => {
      const roundNumberRow = darumaTrainingBoard.createRoundNumberRow(0);
      expect(roundNumberRow).toEqual('       :one:        \t' + blankRow + '\u200B');
      expect(roundNumberRow).toHaveLength(boardConstants.ROUND_WIDTH * 2 + 2);
    });

    test('Non-first round creates expected string', () => {
      const roundNumberRow = darumaTrainingBoard.createRoundNumberRow(1);
      expect(roundNumberRow).toBe('       :one:        \t       :two:        \u200B');
      expect(roundNumberRow).toHaveLength(boardConstants.ROUND_WIDTH * 2 + 2);
    });
    test('Non-first round (2) creates expected string', () => {
      const roundNumberRow = darumaTrainingBoard.createRoundNumberRow(2);
      expect(roundNumberRow).toBe('       :two:        \t      :three:       \u200B');
      expect(roundNumberRow).toHaveLength(boardConstants.ROUND_WIDTH * 2 + 2);
    });
    test('Non-first round (3) creates expected string', () => {
      const roundNumberRow = darumaTrainingBoard.createRoundNumberRow(3);
      expect(roundNumberRow).toBe('      :three:       \t       :four:       \u200B');
      expect(roundNumberRow).toHaveLength(boardConstants.ROUND_WIDTH * 2 + 2);
    });
  });
  describe('createAttackRow', () => {
    describe('should return an attack row at round 0 of game play', () => {
      beforeEach(() => {
        gameBoardRender.roundState.roundIndex = 0;
        gameBoardRender.roundState.rollIndex = 0;
      });
      test('with all placeholders', () => {
        gameBoardRender.roundState.phase = EMOJI_RENDER_PHASE;
        const result = darumaTrainingBoard.createAttackRow(
          gameData.rounds,
          gameBoardRender,
          turnState,
        );
        expect(result).toHaveLength(3);
        expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
      });
      describe('gif phase', () => {
        beforeEach(() => {
          gameBoardRender.roundState.phase = GIF_RENDER_PHASE;
          round1Result = ':one: :red_circle: :red_circle:';
        });
        test('players first turn', () => {
          turnState.isTurn = true;
          round1Result = ':game_die: :red_circle: :red_circle:';
          const result = darumaTrainingBoard.createAttackRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
        });
        test('after players first turn', () => {
          turnState.isTurn = false;
          turnState.hasBeenTurn = true;
          const result = darumaTrainingBoard.createAttackRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
        });
      });
      describe('emoji phase', () => {
        beforeEach(() => {
          gameBoardRender.roundState.phase = EMOJI_RENDER_PHASE;
          round1Result = ':one: :red_circle: :red_circle:';
        });
        test('players first turn', () => {
          turnState.isTurn = true;

          const result = darumaTrainingBoard.createAttackRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
        });
        test('after players first turn', () => {
          turnState.isTurn = false;
          turnState.hasBeenTurn = true;

          const result = darumaTrainingBoard.createAttackRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
        });
      });
    });
    describe('should return an attack row at round 1 of game play', () => {
      beforeEach(() => {
        gameBoardRender.roundState.roundIndex = 1;
        gameBoardRender.roundState.rollIndex = 0;
        round1Result = ':one: :two: :three:';
        round2Result = ':two: :red_circle: :red_circle:';
      });
      test('round 1 equals the rounds and round 2 is all placeholders', () => {
        round2Result = ':red_circle: :red_circle: :red_circle:';
        gameBoardRender.roundState.phase = EMOJI_RENDER_PHASE;
        const result = darumaTrainingBoard.createAttackRow(
          gameData.rounds,
          gameBoardRender,
          turnState,
        );
        expect(result).toHaveLength(3);
        expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
      });
      describe('gif phase', () => {
        beforeEach(() => {
          gameBoardRender.roundState.phase = GIF_RENDER_PHASE;
          round2Result = ':two: :red_circle: :red_circle:';
        });
        test('players first turn', () => {
          turnState.isTurn = true;
          round2Result = ':game_die: :red_circle: :red_circle:';
          const result = darumaTrainingBoard.createAttackRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
        });
        test('after players first turn', () => {
          turnState.isTurn = false;
          turnState.hasBeenTurn = true;
          const result = darumaTrainingBoard.createAttackRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
        });
      });
      describe('emoji phase', () => {
        beforeEach(() => {
          gameBoardRender.roundState.phase = EMOJI_RENDER_PHASE;
        });
        test('players first turn', () => {
          turnState.isTurn = true;
          const result = darumaTrainingBoard.createAttackRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
        });
        test('after players first turn', () => {
          turnState.isTurn = false;
          turnState.hasBeenTurn = true;
          const result = darumaTrainingBoard.createAttackRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
        });
      });
    });
    describe('should return an attack row at round 2 of game play', () => {
      beforeEach(() => {
        gameBoardRender.roundState.roundIndex = 2;
        gameBoardRender.roundState.rollIndex = 3;
        round2Result = ':three: :three: :three:';
        round1Result = ':two: :one: :three:';
      });
      test('round 1 equals the rounds and round 2 is all placeholders', () => {
        gameBoardRender.roundState.phase = EMOJI_RENDER_PHASE;
        const result = darumaTrainingBoard.createAttackRow(
          gameData.rounds,
          gameBoardRender,
          turnState,
        );
        expect(result).toHaveLength(3);
        expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
      });
    });
  });
  describe('createTotalRow', () => {
    describe('should return a total row at round 0 of game play', () => {
      beforeEach(() => {
        gameBoardRender.roundState.roundIndex = 0;
        gameBoardRender.roundState.rollIndex = 0;
      });

      describe('emoji phase', () => {
        beforeEach(() => {
          gameBoardRender.roundState.phase = EMOJI_RENDER_PHASE;
        });

        test('should return two blank lines since its not their turn', () => {
          turnState.notTurnYet = true;
          turnState.hasBeenTurn = false;
          const result = darumaTrainingBoard.createTotalRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual([blankRow, spacerRow, blankRow]);
        });
        test('should return a number line and a blank line as it is their turn', () => {
          turnState.notTurnYet = false;
          turnState.hasBeenTurn = false;
          const result = darumaTrainingBoard.createTotalRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual(['       ** 1**       ', spacerRow, blankRow]);
        });
        test('should return a number line and a blank line as it has been there turn (same as other)', () => {
          turnState.hasBeenTurn = true;
          const result = darumaTrainingBoard.createTotalRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual(['       ** 1**       ', spacerRow, blankRow]);
        });
      });
      describe('gif phase', () => {
        beforeEach(() => {
          gameBoardRender.roundState.phase = GIF_RENDER_PHASE;
        });
        test('should return a 2 blank lines as it is their turn and waiting on the roll', () => {
          const result = darumaTrainingBoard.createTotalRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual([blankRow, spacerRow, blankRow]);
        });
      });
    });
    describe('should return a total row at round 1 of game play', () => {
      beforeEach(() => {
        gameBoardRender.roundState.roundIndex = 1;
        gameBoardRender.roundState.rollIndex = 0;
      });
      describe('emoji phase', () => {
        beforeEach(() => {
          gameBoardRender.roundState.phase = EMOJI_RENDER_PHASE;
        });

        test('should return the total from the previous round and a blank line', () => {
          turnState.hasBeenTurn = false;
          const result = darumaTrainingBoard.createTotalRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual(['       ** 6**       ', spacerRow, blankRow]);
        });
        test('should return the total from the previous round and the total adding this round', () => {
          turnState.hasBeenTurn = false;
          turnState.notTurnYet = false;
          const result = darumaTrainingBoard.createTotalRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual(['       ** 6**       ', spacerRow, '       ** 8**       ']);
        });
        test('should return a number line and a blank line as it has been there turn (same as other)', () => {
          turnState.hasBeenTurn = true;
          turnState.notTurnYet = false;

          const result = darumaTrainingBoard.createTotalRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual(['       ** 6**       ', spacerRow, '       ** 8**       ']);
        });
      });
      describe('gif phase', () => {
        beforeEach(() => {
          gameBoardRender.roundState.phase = GIF_RENDER_PHASE;
        });
        test('should return the total from the previous round and blank row as it is rolling', () => {
          const result = darumaTrainingBoard.createTotalRow(
            gameData.rounds,
            gameBoardRender,
            turnState,
          );
          expect(result).toHaveLength(3);
          expect(result).toStrictEqual(['       ** 6**       ', spacerRow, blankRow]);
        });
      });
    });
    describe('should return a total row at round 2 and roll 2 (3) of game play (end game)', () => {
      beforeEach(() => {
        gameBoardRender.roundState.roundIndex = 2;
        gameBoardRender.roundState.rollIndex = 2;
      });

      test('should return the total from the previous round and a blank line', () => {
        turnState.hasBeenTurn = true;
        const result = darumaTrainingBoard.createTotalRow(
          gameData.rounds,
          gameBoardRender,
          turnState,
        );
        expect(result).toHaveLength(3);
        expect(result).toStrictEqual(['       **12**       ', spacerRow, '       **21**       ']);
      });
    });
  });
  describe('createAttackAndTotalRows', () => {
    describe('should return an attack and total row at round 0 of game play', () => {
      beforeEach(() => {
        gameBoardRender.roundState.roundIndex = 0;
        gameBoardRender.roundState.rollIndex = 0;
        gameBoardRender.roundState.phase = EMOJI_RENDER_PHASE;
      });

      test('should return the attack and total rows at the start of the game', () => {
        const result = darumaTrainingBoard.createAttackAndTotalRows(
          turnState,
          gameData.rounds,
          gameBoardRender,
        );
        expect(result).toHaveLength(3);
        expect(result).toStrictEqual([
          `${round1Result}${spacerRow}${round2Result}\u200B`,
          `${blankRow}${spacerRow}${blankRow}\u200B`,
          horizontalRule,
        ]);
      });
      test('should return the attack and total rows at the players turn', () => {
        turnState.notTurnYet = false;
        turnState.hasBeenTurn = false;
        turnState.isTurn = true;
        round1Result = ':one: :red_circle: :red_circle:';
        const totalRow = '       ** 1**       ';

        const result = darumaTrainingBoard.createAttackAndTotalRows(
          turnState,
          gameData.rounds,
          gameBoardRender,
        );
        expect(result).toHaveLength(3);
        expect(result).toStrictEqual([
          `${round1Result}${spacerRow}${round2Result}\u200B`,
          `${totalRow}${spacerRow}${blankRow}\u200B`,
          horizontalRule,
        ]);
      });
    });
  });
  describe('Render Board and Player Functions', () => {
    let orm: MikroORM;
    let database: EntityManager;
    let firstRoundPlayerRow: string;
    let roundRow: string;
    beforeAll(async () => {
      orm = await initORM();
    });
    afterAll(async () => {
      await orm.close(true);
    });
    beforeEach(() => {
      database = orm.em.fork();
      firstRoundPlayerRow = `${round1Result}${spacerRow}${round2Result}\u200B\n${blankRow}${spacerRow}${blankRow}\u200B\n${horizontalRule}`;
      roundRow = `>>>                **ROUND**                \u200B`;
    });
    afterEach(async () => {
      await orm.schema.clearDatabase();
    });
    describe('createPlayerRows', () => {
      test('should throw an error if there are no players', () => {
        expect.assertions(1);

        expect(() => darumaTrainingBoard.createPlayerRows(gameBoardRender)).toThrow(
          'No players found',
        );
      });
      test('should create a player row for 1 player in the game', async () => {
        const randomPlayer = await createRandomPlayer(database);
        const { player } = randomPlayer;
        const renderedBoard = {
          players: [player],
          ...gameBoardRender,
        };

        const result = darumaTrainingBoard.createPlayerRows(renderedBoard);
        expect(result).toStrictEqual(firstRoundPlayerRow);
      });
      test('should create a player row for 2 players in the game', async () => {
        const randomPlayer = await createRandomPlayer(database);
        const { player } = randomPlayer;
        const player2 = await createRandomPlayer(database);
        const renderedBoard = {
          players: [player, player2.player],
          ...gameBoardRender,
        };

        const result = darumaTrainingBoard.createPlayerRows(renderedBoard);
        expect(result).toBe(`${firstRoundPlayerRow}\n${firstRoundPlayerRow}`);
      });
    });
    describe('renderBoard', () => {
      test('should render a board for 1 player at round 0', async () => {
        const randomPlayer = await createRandomPlayer(database);
        const { player } = randomPlayer;
        player.roundsData = playerRoundsDataIncrementingRolls;
        const renderedBoard = {
          players: [player],
          roundState: {
            playerIndex: 0,
            roundIndex: 0,
            rollIndex: 0,
            phase: EMOJI_RENDER_PHASE as RenderPhase,
          },
        };
        const result = darumaTrainingBoard.renderBoard(renderedBoard);
        const thisRound = '       :one:        \t                    \u200B';
        round1Result = ':one: :red_circle: :red_circle:';
        const totalRow = '       ** 1**       ';

        const player1String = `${round1Result}${spacerRow}${round2Result}\u200B\n${totalRow}${spacerRow}${blankRow}\u200B\n${horizontalRule}`;
        expect(result).toBe(`${roundRow}\n${thisRound}\n${horizontalRule}\n${player1String}`);
      });
      test('should render a board for 2 players at round 0', async () => {
        const randomPlayer = await createRandomPlayer(database);
        const { player } = randomPlayer;
        player.roundsData = playerRoundsDataIncrementingRolls;
        const player2 = await createRandomPlayer(database);
        player2.player.roundsData = playerRoundsDataIncrementingRolls;
        const renderedBoard = {
          players: [player, player2.player],
          roundState: {
            playerIndex: 0,
            roundIndex: 0,
            rollIndex: 0,
            phase: EMOJI_RENDER_PHASE as RenderPhase,
          },
        };
        const result = darumaTrainingBoard.renderBoard(renderedBoard);
        const thisRound = '       :one:        \t                    \u200B';
        const round1ResultPlayer1 = ':one: :red_circle: :red_circle:';
        const totalRowPlayer1 = '       ** 1**       ';

        const player1String = `${round1ResultPlayer1}${spacerRow}${round2Result}\u200B\n${totalRowPlayer1}${spacerRow}${blankRow}\u200B\n${horizontalRule}`;
        const player2String = `${round1Result}${spacerRow}${round2Result}\u200B\n${blankRow}${spacerRow}${blankRow}\u200B\n${horizontalRule}`;
        expect(result).toBe(
          `${roundRow}\n${thisRound}\n${horizontalRule}\n${player1String}\n${player2String}`,
        );
      });
    });
  });
});
