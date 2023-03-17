import type { PlayerRoundsData, RollData } from '../../src/model/types/daruma-training.js';
import { describe, expect, it } from '@jest/globals';

import { IGameBoardRender, IGameTurnState, RenderPhases } from '../../src/enums/daruma-training.js';
import { DarumaTrainingBoard } from '../../src/utils/classes/dt-board.js';
import { playerRoundsDataIncrementingRolls } from '../mocks/mock-player-rounds-data.js';
describe('DarumaTrainingBoard', () => {
    let gameData: PlayerRoundsData;
    let gameBoardRender: IGameBoardRender;
    let turnState: IGameTurnState;
    let board: DarumaTrainingBoard;
    let blankRow: string;
    let spacerRow: string;
    let horizontalRule: string;
    let round1Result: string;
    let round2Result: string;

    beforeEach(() => {
        // create the DarumaTrainingBoard object
        gameData = playerRoundsDataIncrementingRolls;
        board = new DarumaTrainingBoard();
        blankRow = board.BLANK_ROW;
        spacerRow = board.ATTACK_ROW_SPACER;
        horizontalRule = board.HORIZONTAL_RULE;
        round1Result = '🔴 🔴 🔴';
        round2Result = '🔴 🔴 🔴';
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
                phase: RenderPhases.GIF,
            },
        };
    });
    describe('centerString', () => {
        it('returns the content centered when no content or delimiter is given', () => {
            const result = board.centerString(board.ROUND_WIDTH);
            expect(result).toBe(blankRow);
            expect(result).toHaveLength(board.ROUND_WIDTH);
        });
        it('returns the single digit content centered within the given space using the delimiter to fill the space on either side of the string', () => {
            const content = '1';
            const delimiter = ' ';
            const result = board.centerString(board.ROUND_WIDTH, content, delimiter);
            expect(result).toBe('         1          ');
            expect(result).toHaveLength(board.ROUND_WIDTH);
        });
        it('returns the 2 digits content centered within the given space using the delimiter to fill the space on either side of the string', () => {
            const content = '12';
            const delimiter = ' ';
            const result = board.centerString(board.ROUND_WIDTH, content, delimiter);
            expect(result).toBe('         12         ');
            expect(result).toHaveLength(board.ROUND_WIDTH);
        });
    });
    describe('getImageType', () => {
        // Test 1 - Get image type for previous roll
        it('should return `roll_damage.png` for a previous roll', () => {
            const roll = { damage: 5 } as RollData;
            const result = board.getImageType(roll, true, false, false, RenderPhases.GIF, false);
            expect(result).toEqual(roll.damage);
        });

        // Test 2 - Get image type for current roll and turn roll
        it('should return `roll` for a current roll in gif render phase', () => {
            const roll = { damage: 5 } as RollData;
            const result = board.getImageType(roll, false, true, true, RenderPhases.GIF, false);
            expect(result).toEqual('roll');
        });

        // Test 3 - Get image type for current roll and not turn roll
        it('should return `ph` for a current roll that is not turn roll', () => {
            const roll = { damage: 5 } as RollData;
            const result = board.getImageType(roll, false, true, false, RenderPhases.EMOJI, false);
            expect(result).toEqual(`ph`);
        });
        it('should return `ph` for a damage that is undefined', () => {
            const roll = { damage: undefined } as RollData;
            const result = board.getImageType(roll, false, true, false, RenderPhases.EMOJI, false);
            expect(result).toEqual(`ph`);
        });
    });
    describe('createRoundCell', () => {
        it('should return a string with the round number centered in the cell equal to the ROUND_WIDTH in length', () => {
            const roundNumber = 1;
            const result = board.createRoundCell(roundNumber);
            expect(result).toContain('         1          ');
            expect(result).toHaveLength(board.ROUND_WIDTH);
        });
    });
    describe('createRoundRow', () => {
        it('should create the round row with the round number centered in the cell equal to the ROUND_WIDTH in length', () => {
            const result = board.createRoundRow();
            expect(result).toStrictEqual('>>>                **ROUND**                \u200B');
        });
    });
    describe('createRoundNumberRow', () => {
        it('First round creates expected string', () => {
            const roundNumberRow = board.createRoundNumberRow(0);
            expect(roundNumberRow).toContain('       :one:        \t' + blankRow);
            expect(roundNumberRow).toHaveLength(board.ROUND_WIDTH * 2 + 2);
        });

        it('Non-first round creates expected string', () => {
            const roundNumberRow = board.createRoundNumberRow(1);
            expect(roundNumberRow).toContain('       :one:        \t       :two:        ');
            expect(roundNumberRow).toHaveLength(board.ROUND_WIDTH * 2 + 2);
        });
        it('Non-first round creates expected string', () => {
            const roundNumberRow = board.createRoundNumberRow(2);
            expect(roundNumberRow).toContain('       :two:        \t      :three:       ');
            expect(roundNumberRow).toHaveLength(board.ROUND_WIDTH * 2 + 2);
        });
        it('Non-first round creates expected string', () => {
            const roundNumberRow = board.createRoundNumberRow(3);
            expect(roundNumberRow).toContain('      :three:       \t       :four:       ');
            expect(roundNumberRow).toHaveLength(board.ROUND_WIDTH * 2 + 2);
        });
    });
    describe('createAttackRow', () => {
        describe('should return an attack row at round 0 of game play', () => {
            beforeEach(() => {
                gameBoardRender.roundState.roundIndex = 0;
                gameBoardRender.roundState.rollIndex = 0;
            });
            it('with all placeholders', () => {
                gameBoardRender.roundState.phase = RenderPhases.EMOJI;
                const result = board.createAttackRow(gameData.rounds, gameBoardRender, turnState);
                expect(result).toHaveLength(3);
                expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
            });
            describe('gif phase', () => {
                beforeEach(() => {
                    gameBoardRender.roundState.phase = RenderPhases.GIF;
                    round1Result = ':one: 🔴 🔴';
                });
                it('players first turn', () => {
                    turnState.isTurn = true;
                    round1Result = '🎲 🔴 🔴';
                    const result = board.createAttackRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
                });
                it('after players first turn', () => {
                    turnState.isTurn = false;
                    turnState.hasBeenTurn = true;
                    const result = board.createAttackRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
                });
            });
            describe('emoji phase', () => {
                beforeEach(() => {
                    gameBoardRender.roundState.phase = RenderPhases.EMOJI;
                    round1Result = ':one: 🔴 🔴';
                });
                it('players first turn', () => {
                    turnState.isTurn = true;

                    const result = board.createAttackRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
                });
                it('after players first turn', () => {
                    turnState.isTurn = false;
                    turnState.hasBeenTurn = true;

                    const result = board.createAttackRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
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
                round2Result = ':two: 🔴 🔴';
            });
            it('round 1 equals the rounds and round 2 is all placeholders', () => {
                round2Result = '🔴 🔴 🔴';
                gameBoardRender.roundState.phase = RenderPhases.EMOJI;
                const result = board.createAttackRow(gameData.rounds, gameBoardRender, turnState);
                expect(result).toHaveLength(3);
                expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
            });
            describe('gif phase', () => {
                beforeEach(() => {
                    gameBoardRender.roundState.phase = RenderPhases.GIF;
                    round2Result = ':two: 🔴 🔴';
                });
                it('players first turn', () => {
                    turnState.isTurn = true;
                    round2Result = '🎲 🔴 🔴';
                    const result = board.createAttackRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
                });
                it('after players first turn', () => {
                    turnState.isTurn = false;
                    turnState.hasBeenTurn = true;
                    const result = board.createAttackRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
                });
            });
            describe('emoji phase', () => {
                beforeEach(() => {
                    gameBoardRender.roundState.phase = RenderPhases.EMOJI;
                });
                it('players first turn', () => {
                    turnState.isTurn = true;
                    const result = board.createAttackRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual([round1Result, spacerRow, round2Result]);
                });
                it('after players first turn', () => {
                    turnState.isTurn = false;
                    turnState.hasBeenTurn = true;
                    const result = board.createAttackRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
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
            it('round 1 equals the rounds and round 2 is all placeholders', () => {
                gameBoardRender.roundState.phase = RenderPhases.EMOJI;
                const result = board.createAttackRow(gameData.rounds, gameBoardRender, turnState);
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
                    gameBoardRender.roundState.phase = RenderPhases.EMOJI;
                });

                it('should return two blank lines since its not their turn', () => {
                    turnState.notTurnYet = true;
                    turnState.hasBeenTurn = false;
                    const result = board.createTotalRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual([blankRow, spacerRow, blankRow]);
                });
                it('should return a number line and a blank line as it is their turn', () => {
                    turnState.notTurnYet = false;
                    turnState.hasBeenTurn = false;
                    const result = board.createTotalRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual(['       ** 1**       ', spacerRow, blankRow]);
                });
                it('should return a number line and a blank line as it has been there turn (same as other)', () => {
                    turnState.hasBeenTurn = true;
                    const result = board.createTotalRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual(['       ** 1**       ', spacerRow, blankRow]);
                });
            });
            describe('gif phase', () => {
                beforeEach(() => {
                    gameBoardRender.roundState.phase = RenderPhases.GIF;
                });
                it('should return a 2 blank lines as it is their turn and waiting on the roll', () => {
                    const result = board.createTotalRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
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
                    gameBoardRender.roundState.phase = RenderPhases.EMOJI;
                });

                it('should return the total from the previous round and a blank line', () => {
                    turnState.hasBeenTurn = false;
                    const result = board.createTotalRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual(['       ** 6**       ', spacerRow, blankRow]);
                });
                it('should return the total from the previous round and the total adding this round', () => {
                    turnState.hasBeenTurn = false;
                    turnState.notTurnYet = false;
                    const result = board.createTotalRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual([
                        '       ** 6**       ',
                        spacerRow,
                        '       ** 8**       ',
                    ]);
                });
                it('should return a number line and a blank line as it has been there turn (same as other)', () => {
                    turnState.hasBeenTurn = true;
                    turnState.notTurnYet = false;

                    const result = board.createTotalRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
                    );
                    expect(result).toHaveLength(3);
                    expect(result).toStrictEqual([
                        '       ** 6**       ',
                        spacerRow,
                        '       ** 8**       ',
                    ]);
                });
            });
            describe('gif phase', () => {
                beforeEach(() => {
                    gameBoardRender.roundState.phase = RenderPhases.GIF;
                });
                it('should return the total from the previous round and blank row as it is rolling', () => {
                    const result = board.createTotalRow(
                        gameData.rounds,
                        gameBoardRender,
                        turnState
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

            it('should return the total from the previous round and a blank line', () => {
                turnState.hasBeenTurn = true;
                const result = board.createTotalRow(gameData.rounds, gameBoardRender, turnState);
                expect(result).toHaveLength(3);
                expect(result).toStrictEqual([
                    '       **12**       ',
                    spacerRow,
                    '       **21**       ',
                ]);
            });
        });
    });
    describe('createAttackAndTotalRows', () => {
        describe('should return an attack and total row at round 0 of game play', () => {
            beforeEach(() => {
                gameBoardRender.roundState.roundIndex = 0;
                gameBoardRender.roundState.rollIndex = 0;
                gameBoardRender.roundState.phase = RenderPhases.EMOJI;
            });

            it('should return the attack and total rows at the start of the game', () => {
                const result = board.createAttackAndTotalRows(
                    turnState,
                    gameData.rounds,
                    gameBoardRender
                );
                expect(result).toHaveLength(3);
                expect(result).toStrictEqual([
                    `${round1Result}${spacerRow}${round2Result}\u200B`,
                    `${blankRow}${spacerRow}${blankRow}\u200B`,
                    horizontalRule,
                ]);
            });
            it('should return the attack and total rows at the players turn', () => {
                turnState.notTurnYet = false;
                turnState.hasBeenTurn = false;
                turnState.isTurn = true;
                round1Result = ':one: 🔴 🔴';
                const totalRow = '       ** 1**       ';

                const result = board.createAttackAndTotalRows(
                    turnState,
                    gameData.rounds,
                    gameBoardRender
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
});
