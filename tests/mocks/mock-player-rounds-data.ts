import { PlayerRoundsData } from '../../src/model/types/daruma-training.js';

export const playerRoundsDataRandomGame: PlayerRoundsData = {
	rounds: [
		{
			rolls: [
				{ damage: 2, roll: 3, totalScore: 2 },
				{ damage: 2, roll: 4, totalScore: 4 },
				{ damage: 3, roll: 5, totalScore: 7 },
			],
		},
		{
			rolls: [
				{ damage: 2, roll: 4, totalScore: 9 },
				{ damage: 2, roll: 4, totalScore: 11 },
				{ damage: 2, roll: 4, totalScore: 13 },
			],
		},
		{
			rolls: [
				{ damage: 3, roll: 5, totalScore: 16 },
				{ damage: 2, roll: 3, totalScore: 18 },
				{ damage: 2, roll: 3, totalScore: 20 },
			],
		},
		{
			rolls: [
				{ damage: 2, roll: 4, totalScore: 15 },
				{ damage: 3, roll: 5, totalScore: 18 },
				{ damage: 2, roll: 4, totalScore: 20 },
			],
		},
		{
			rolls: [
				{ damage: 3, roll: 5, totalScore: 15 },
				{ damage: 1, roll: 1, totalScore: 16 },
				{ damage: 2, roll: 3, totalScore: 18 },
			],
		},
		{
			rolls: [
				{ damage: 1, roll: 2, totalScore: 19 },
				{ damage: 1, roll: 1, totalScore: 20 },
				{ damage: 2, roll: 3, totalScore: 15 },
			],
		},
		{
			rolls: [
				{ damage: 3, roll: 5, totalScore: 18 },
				{ damage: 1, roll: 1, totalScore: 19 },
				{ damage: 1, roll: 2, totalScore: 20 },
			],
		},
		{
			rolls: [
				{ damage: 2, roll: 4, totalScore: 15 },
				{ damage: 1, roll: 1, totalScore: 16 },
				{ damage: 2, roll: 3, totalScore: 18 },
			],
		},
		{ rolls: [{ damage: 3, roll: 5, totalScore: 21 }] },
	],
	gameWinRollIndex: 0,
	gameWinRoundIndex: 8,
};
export const playerRoundsDataPerfectGame: PlayerRoundsData = {
	rounds: [
		{
			rolls: [
				{ damage: 3, roll: 6, totalScore: 3 },
				{ damage: 3, roll: 6, totalScore: 6 },
				{ damage: 3, roll: 6, totalScore: 9 },
			],
		},
		{
			rolls: [
				{ damage: 3, roll: 6, totalScore: 12 },
				{ damage: 3, roll: 6, totalScore: 15 },
				{ damage: 3, roll: 6, totalScore: 18 },
			],
		},
		{
			rolls: [{ damage: 3, roll: 6, totalScore: 21 }],
		},
	],
	gameWinRollIndex: 0,
	gameWinRoundIndex: 2,
};
export const playerRoundsDataLongestGame: PlayerRoundsData = {
	rounds: [
		{
			rolls: [
				{ damage: 1, roll: 1, totalScore: 1 },
				{ damage: 1, roll: 1, totalScore: 2 },
				{ damage: 1, roll: 1, totalScore: 3 },
			],
		},
		{
			rolls: [
				{ damage: 1, roll: 1, totalScore: 4 },
				{ damage: 1, roll: 1, totalScore: 5 },
				{ damage: 1, roll: 1, totalScore: 6 },
			],
		},
		{
			rolls: [
				{ damage: 1, roll: 1, totalScore: 7 },
				{ damage: 1, roll: 1, totalScore: 8 },
				{ damage: 1, roll: 1, totalScore: 9 },
			],
		},
		{
			rolls: [
				{ damage: 1, roll: 1, totalScore: 10 },
				{ damage: 1, roll: 1, totalScore: 11 },
				{ damage: 1, roll: 1, totalScore: 12 },
			],
		},
		{
			rolls: [
				{ damage: 1, roll: 1, totalScore: 13 },
				{ damage: 1, roll: 1, totalScore: 14 },
				{ damage: 1, roll: 1, totalScore: 15 },
			],
		},
		{
			rolls: [
				{ damage: 1, roll: 1, totalScore: 16 },
				{ damage: 1, roll: 1, totalScore: 17 },
				{ damage: 1, roll: 1, totalScore: 18 },
			],
		},
		{
			rolls: [
				{ damage: 1, roll: 1, totalScore: 19 },
				{ damage: 1, roll: 1, totalScore: 20 },
				{ damage: 1, roll: 1, totalScore: 21 },
			],
		},
	],
	gameWinRollIndex: 2,
	gameWinRoundIndex: 6,
};
export const playerRoundsDataAlmostPerfectGame: PlayerRoundsData = {
	rounds: [
		{
			rolls: [
				{ damage: 3, roll: 6, totalScore: 3 },
				{ damage: 3, roll: 6, totalScore: 6 },
				{ damage: 3, roll: 6, totalScore: 9 },
			],
		},
		{
			rolls: [
				{ damage: 3, roll: 6, totalScore: 12 },
				{ damage: 3, roll: 6, totalScore: 15 },
				{ damage: 3, roll: 6, totalScore: 18 },
			],
		},
		{
			rolls: [
				{ damage: 2, roll: 3, totalScore: 20 },
				{ damage: 3, roll: 6, totalScore: 15 },
				{ damage: 3, roll: 6, totalScore: 18 },
			],
		},
		{
			rolls: [{ damage: 3, roll: 6, totalScore: 21 }],
		},
	],
	gameWinRollIndex: 0,
	gameWinRoundIndex: 3,
};
export const playerRoundsDataIncrementingRolls: PlayerRoundsData = {
	rounds: [
		{
			rolls: [
				{ damage: 1, roll: 1, totalScore: 1 },
				{ damage: 2, roll: 3, totalScore: 3 },
				{ damage: 3, roll: 6, totalScore: 6 },
			],
		},
		{
			rolls: [
				{ damage: 2, roll: 3, totalScore: 8 },
				{ damage: 1, roll: 1, totalScore: 9 },
				{ damage: 3, roll: 6, totalScore: 12 },
			],
		},
		{
			rolls: [
				{ damage: 3, roll: 6, totalScore: 15 },
				{ damage: 3, roll: 6, totalScore: 18 },
				{ damage: 3, roll: 6, totalScore: 21 },
			],
		},
	],
	gameWinRollIndex: 2,
	gameWinRoundIndex: 2,
};
