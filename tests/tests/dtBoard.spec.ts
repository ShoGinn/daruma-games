import type { RollData } from '../../src/model/types/darumaTraining.js';
import { describe, expect, it } from '@jest/globals';

import { RenderPhases } from '../../src/enums/dtEnums.js';
import { DarumaTrainingBoard } from '../../src/utils/classes/dtBoard.js';
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
    });
    describe('getImageType', () => {
        // Test 1 - Get image type for previous roll
        it('should return `roll_damage.png` for a previous roll', () => {
            const roll = { damage: 5 } as RollData;
            const result = board.getImageType(roll, true, false, false, RenderPhases.GIF, false);
            expect(result).toEqual(`${roll.damage}png`);
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
});
