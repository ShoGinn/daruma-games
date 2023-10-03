import { PlayerDice } from '../../src/utils/classes/dt-player-dice.js';

describe('PlayerDice', () => {
	describe('completeGameForPlayer', () => {
		it('returns an object with rounds and game win roll and round indices', () => {
			const result = PlayerDice.completeGameForPlayer();
			expect(result).toHaveProperty('rounds');
			expect(result).toHaveProperty('gameWinRollIndex');
			expect(result).toHaveProperty('gameWinRoundIndex');
		});
	});
	describe('check damage and total score in playerRounds', () => {
		const playerRounds = PlayerDice.completeGameForPlayer();
		for (const round of playerRounds.rounds) {
			for (const roll of round.rolls) {
				it('returns a damage value between 1 and 6', () => {
					expect(roll.damage).toBeGreaterThanOrEqual(1);
					expect(roll.damage).toBeLessThanOrEqual(6);
				});
				it('returns a total score between 1 and 21', () => {
					expect(roll.totalScore).toBeGreaterThanOrEqual(1);
					expect(roll.totalScore).toBeLessThanOrEqual(21);
				});
			}
		}
	});
});
