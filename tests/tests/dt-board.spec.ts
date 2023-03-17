import type { RollData } from '../../src/model/types/daruma-training.js';
import { describe, expect, it } from '@jest/globals';

import { RenderPhases } from '../../src/enums/daruma-training.js';
import { DarumaTrainingBoard } from '../../src/utils/classes/dt-board.js';
import { playerRoundsDataAlmostPerfectGame } from '../mocks/mock-player-rounds-data.js';
describe('DarumaTrainingBoard', () => {
    let board: DarumaTrainingBoard;
    beforeAll(() => {
        // create the DarumaTrainingBoard object
        board = new DarumaTrainingBoard();
    });
    describe('centerString', () => {
        it('returns the content centered within the given space using the delimiter to fill the space on either side of the string', () => {
            const content = 'Hello World';
            const delimiter = ' ';
            const result = board.centerString(board.ROUND_WIDTH, content, delimiter);
            expect(result).toBe('    Hello World     ');
            expect(result).toHaveLength(board.ROUND_WIDTH);
        });
        it('returns the content centered when no content or delimiter is given', () => {
            const result = board.centerString(board.ROUND_WIDTH);
            expect(result).toBe('                    ');
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
    describe('createRoundNumberRow', () => {
        it('First round creates expected string', () => {
            const roundNumberRow = board.createRoundNumberRow(0);
            expect(roundNumberRow).toContain('       :one:        	                    ');
            expect(roundNumberRow).toHaveLength(board.ROUND_WIDTH * 2 + 1);
        });

        it('Non-first round creates expected string', () => {
            const roundNumberRow = board.createRoundNumberRow(1);
            expect(roundNumberRow).toContain('       :one:        	       :two:        ');
            expect(roundNumberRow).toHaveLength(board.ROUND_WIDTH * 2 + 1);
        });
        it('Non-first round creates expected string', () => {
            const roundNumberRow = board.createRoundNumberRow(2);
            expect(roundNumberRow).toContain('       :two:        	      :three:       ');
            expect(roundNumberRow).toHaveLength(board.ROUND_WIDTH * 2 + 1);
        });
        it('Non-first round creates expected string', () => {
            const roundNumberRow = board.createRoundNumberRow(3);
            expect(roundNumberRow).toContain('      :three:       	       :four:       ');
            expect(roundNumberRow).toHaveLength(board.ROUND_WIDTH * 2 + 1);
        });
    });
    describe('createAttackRow', () => {
        let roundIndex: number;
        let rollIndex: number;
        let renderPhase: RenderPhases;
        let round1Result: string;
        let round2Result: string;

        describe('should return an attack row at round 0 of game play', () => {
            beforeAll(() => {
                roundIndex = 0;
                rollIndex = 0;
                round1Result = '🔴 🔴 🔴';
                round2Result = '🔴 🔴 🔴';
            });
            it('with all placeholders', () => {
                renderPhase = RenderPhases.EMOJI;
                const result = board.createAttackRow(
                    playerRoundsDataAlmostPerfectGame.rounds,
                    roundIndex,
                    rollIndex,
                    renderPhase,
                    false,
                    false
                );
                expect(result).toHaveLength(2);
                expect(result).toStrictEqual([round1Result, round2Result]);
            });
            describe('gif phase', () => {
                beforeEach(() => {
                    renderPhase = RenderPhases.GIF;
                    round1Result = ':three: 🔴 🔴';
                });
                it('players first turn', () => {
                    round1Result = '🎲 🔴 🔴';
                    const result = board.createAttackRow(
                        playerRoundsDataAlmostPerfectGame.rounds,
                        roundIndex,
                        rollIndex,
                        renderPhase,
                        false,
                        true
                    );
                    expect(result).toHaveLength(2);
                    expect(result).toStrictEqual([round1Result, round2Result]);
                });
                it('after players first turn', () => {
                    const result = board.createAttackRow(
                        playerRoundsDataAlmostPerfectGame.rounds,
                        roundIndex,
                        rollIndex,
                        renderPhase,
                        true,
                        false
                    );
                    expect(result).toHaveLength(2);
                    expect(result).toStrictEqual([round1Result, round2Result]);
                });
            });
            describe('emoji phase', () => {
                beforeEach(() => {
                    renderPhase = RenderPhases.EMOJI;
                });
                it('players first turn', () => {
                    const result = board.createAttackRow(
                        playerRoundsDataAlmostPerfectGame.rounds,
                        roundIndex,
                        rollIndex,
                        renderPhase,
                        false,
                        true
                    );
                    expect(result).toHaveLength(2);
                    expect(result).toStrictEqual([round1Result, round2Result]);
                });
                it('after players first turn', () => {
                    const result = board.createAttackRow(
                        playerRoundsDataAlmostPerfectGame.rounds,
                        roundIndex,
                        rollIndex,
                        renderPhase,
                        true,
                        false
                    );
                    expect(result).toHaveLength(2);
                    expect(result).toStrictEqual([round1Result, round2Result]);
                });
            });
        });
        describe('should return an attack row at round 1 of game play', () => {
            beforeAll(() => {
                roundIndex = 1;
                rollIndex = 0;
                round1Result = ':three: :three: :three:';
                round2Result = ':three: 🔴 🔴';
            });
            it('with all placeholders', () => {
                round2Result = '🔴 🔴 🔴';
                renderPhase = RenderPhases.EMOJI;
                const result = board.createAttackRow(
                    playerRoundsDataAlmostPerfectGame.rounds,
                    roundIndex,
                    rollIndex,
                    renderPhase,
                    false,
                    false
                );
                expect(result).toHaveLength(2);
                expect(result).toStrictEqual([round1Result, round2Result]);
            });
            describe('gif phase', () => {
                beforeEach(() => {
                    renderPhase = RenderPhases.GIF;
                    round2Result = ':three: 🔴 🔴';
                });
                it('players first turn', () => {
                    round2Result = '🎲 🔴 🔴';
                    const result = board.createAttackRow(
                        playerRoundsDataAlmostPerfectGame.rounds,
                        roundIndex,
                        rollIndex,
                        renderPhase,
                        false,
                        true
                    );
                    expect(result).toHaveLength(2);
                    expect(result).toStrictEqual([round1Result, round2Result]);
                });
                it('after players first turn', () => {
                    const result = board.createAttackRow(
                        playerRoundsDataAlmostPerfectGame.rounds,
                        roundIndex,
                        rollIndex,
                        renderPhase,
                        true,
                        false
                    );
                    expect(result).toHaveLength(2);
                    expect(result).toStrictEqual([round1Result, round2Result]);
                });
            });
            describe('emoji phase', () => {
                beforeEach(() => {
                    renderPhase = RenderPhases.EMOJI;
                });
                it('players first turn', () => {
                    const result = board.createAttackRow(
                        playerRoundsDataAlmostPerfectGame.rounds,
                        roundIndex,
                        rollIndex,
                        renderPhase,
                        false,
                        true
                    );
                    expect(result).toHaveLength(2);
                    expect(result).toStrictEqual([round1Result, round2Result]);
                });
                it('after players first turn', () => {
                    const result = board.createAttackRow(
                        playerRoundsDataAlmostPerfectGame.rounds,
                        roundIndex,
                        rollIndex,
                        renderPhase,
                        true,
                        false
                    );
                    expect(result).toHaveLength(2);
                    expect(result).toStrictEqual([round1Result, round2Result]);
                });
            });
        });
    });
    describe('createTotalRow', () => {
        let roundIndex: number;
        let rollIndex: number;
        let renderPhase: RenderPhases;

        describe('should return a total row at round 0 of game play', () => {
            beforeAll(() => {
                roundIndex = 0;
                rollIndex = 0;
            });

            it('should return two blank lines since its not their turn', () => {
                renderPhase = RenderPhases.EMOJI;
                const result = board.createTotalRow(
                    playerRoundsDataAlmostPerfectGame.rounds,
                    roundIndex,
                    rollIndex,
                    renderPhase,
                    false,
                    true
                );
                expect(result).toHaveLength(3);
                expect(result).toStrictEqual([
                    '                    ',
                    '                    ',
                    '		**Hits**',
                ]);
            });
            it('should return a number line and a blank line as it is their turn', () => {
                renderPhase = RenderPhases.EMOJI;
                const result = board.createTotalRow(
                    playerRoundsDataAlmostPerfectGame.rounds,
                    roundIndex,
                    rollIndex,
                    renderPhase,
                    false,
                    false
                );
                expect(result).toHaveLength(3);
                expect(result).toStrictEqual([
                    '       **3**        ',
                    '                    ',
                    '		**Hits**',
                ]);
            });
            it('should return a number line and a blank line as it has been there turn (same as other)', () => {
                renderPhase = RenderPhases.EMOJI;
                const result = board.createTotalRow(
                    playerRoundsDataAlmostPerfectGame.rounds,
                    roundIndex,
                    rollIndex,
                    renderPhase,
                    true,
                    false
                );
                expect(result).toHaveLength(3);
                expect(result).toStrictEqual([
                    '       **3**        ',
                    '                    ',
                    '		**Hits**',
                ]);
            });
        });
        describe('should return a total row at round 1 of game play', () => {
            beforeAll(() => {
                roundIndex = 1;
                rollIndex = 0;
            });

            it('should return the total from the previous round and a blank line', () => {
                renderPhase = RenderPhases.EMOJI;
                const result = board.createTotalRow(
                    playerRoundsDataAlmostPerfectGame.rounds,
                    roundIndex,
                    rollIndex,
                    renderPhase,
                    false,
                    true
                );
                expect(result).toHaveLength(3);
                expect(result).toStrictEqual([
                    '       **9**        ',
                    '                    ',
                    '		**Hits**',
                ]);
            });
            it('should return the total from the previous round and the total adding this round', () => {
                renderPhase = RenderPhases.EMOJI;
                const result = board.createTotalRow(
                    playerRoundsDataAlmostPerfectGame.rounds,
                    roundIndex,
                    rollIndex,
                    renderPhase,
                    false,
                    false
                );
                expect(result).toHaveLength(3);
                expect(result).toStrictEqual([
                    '       **9**        ',
                    '       **12**       ',
                    '		**Hits**',
                ]);
            });
            it('should return a number line and a blank line as it has been there turn (same as other)', () => {
                renderPhase = RenderPhases.EMOJI;
                const result = board.createTotalRow(
                    playerRoundsDataAlmostPerfectGame.rounds,
                    roundIndex,
                    rollIndex,
                    renderPhase,
                    true,
                    false
                );
                expect(result).toHaveLength(3);
                expect(result).toStrictEqual([
                    '       **9**        ',
                    '       **12**       ',
                    '		**Hits**',
                ]);
            });
        });
    });
});
