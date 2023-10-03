import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { DtEncounters } from '../../entities/dt-encounters.entity.js';
import { GameTypes, GameTypesNames } from '../../enums/daruma-training.js';
import { CustomCache } from '../../services/custom-cache.js';

interface IGameRoundsDistribution {
	rounds: number;
	count: number;
}
type GameTypeRoundsDistribution = Record<
	GameTypes,
	Array<IGameRoundsDistribution>
>;

export function nftHoldersPieChart(topNFTHolders: Map<string, number>): string {
	// Create a mapping of NFT count to number of users with that count
	const nftCountToNumberUsersMap = nftCountToNumberOfUsers(topNFTHolders);
	// Generate chart data
	const chartData = [...nftCountToNumberUsersMap].map(
		([nftCount, numberUsers]) => ({
			label: `${numberUsers} wallets with ${nftCount} Darumas`,
			value: numberUsers,
		}),
	);
	// Generate chart URL
	const chartParameters = {
		type: 'doughnut',
		options: {
			legend: {
				display: true,
				position: 'left',
				align: 'start',
				fullWidth: true,
				reverse: false,
				labels: {
					fontSize: 8,
					fontFamily: 'sans-serif',
					fontColor: '#666666',
					fontStyle: 'normal',
					padding: 10,
				},
			},
		},
		data: {
			labels: chartData.map((d) => d.label),
			datasets: [
				{
					data: chartData.map((d) => d.value),
				},
			],
		},
	};
	return getChartUrl(chartParameters);
}
export function nftCountToNumberOfUsers(
	topNFTHolders: Map<string, number>,
): Map<number, number> {
	const nftCountToNumberUsers = new Map<number, number>();
	for (const [_, nftCount] of topNFTHolders) {
		if (nftCount === 0) {
			continue;
		}
		if (nftCountToNumberUsers.has(nftCount)) {
			const numberUsers = nftCountToNumberUsers.get(nftCount) as number;
			nftCountToNumberUsers.set(nftCount, numberUsers + 1);
		} else {
			nftCountToNumberUsers.set(nftCount, 1);
		}
	}
	return nftCountToNumberUsers;
}

async function getAllDtEncounters(): Promise<DtEncounters[]> {
	const orm = container.resolve(MikroORM);
	const database = orm.em.fork().getRepository(DtEncounters);
	return await database.findAll();
}
export function generateEncounterData(
	gameData: DtEncounters[],
): GameTypeRoundsDistribution {
	const result: GameTypeRoundsDistribution = {
		[GameTypes.OneVsNpc]: [],
		[GameTypes.OneVsOne]: [],
		[GameTypes.FourVsNpc]: [],
	};

	for (const entry of gameData) {
		const entryMinRounds = Math.min(
			...Object.values(entry.gameData).map(
				(data) => data.gameWinRoundIndex + 1,
			),
		);

		const existingData = result[entry.gameType].find(
			(data) => data.rounds === entryMinRounds,
		);
		if (existingData) {
			existingData.count++;
		} else {
			result[entry.gameType].push({ rounds: entryMinRounds, count: 1 });
		}
	}
	return result;
}
export async function getRoundsDistributionPerGameTypeData(): Promise<GameTypeRoundsDistribution> {
	const cache = container.resolve(CustomCache);
	const cachedData = (await cache.get(
		'roundsDistributionPerGameType',
	)) as Record<GameTypes, Array<IGameRoundsDistribution>>;
	if (cachedData) {
		return cachedData;
	}
	const gameData = await getAllDtEncounters();
	const result = generateEncounterData(gameData);
	cache.set('roundsDistributionPerGameType', result);
	return result;
}

export async function darumaGameDistributionsPerGameType(): Promise<
	[string, string][]
> {
	const data = await getRoundsDistributionPerGameTypeData();
	// create a chartUrl tuple with gameType and chartUrl
	const chartUrls: Array<[string, string]> = [];
	for (const [gameType, roundsData] of Object.entries(data)) {
		chartUrls.push([
			GameTypesNames[gameType as GameTypes],
			createGameDistroChart(roundsData, GameTypesNames[gameType as GameTypes]),
		]);
	}
	return chartUrls;
}
function createGameDistroChart(
	data: Array<{ rounds: number; count: number }>,
	gameType: string,
): string {
	const chartData = [];
	const rounds = [];
	chartData.push({
		label: gameType,
		data: data.map((entry) => entry.count),
	});
	rounds.push(...data.map((entry) => entry.rounds));
	const maxRounds = Math.max(...rounds);
	const minRounds = Math.min(...rounds);
	const roundLabels = [];
	for (let index = minRounds; index <= maxRounds; index++) {
		roundLabels.push(index.toString());
	}
	const chartType = 'bar';
	const chartTitle = 'Winning Rounds per Game Type';
	const chartParameters = {
		type: chartType,
		data: {
			labels: roundLabels,
			datasets: chartData,
		},
		options: {
			title: {
				display: true,
				text: chartTitle,
			},
			scales: {
				xAxes: [
					{
						position: 'bottom',
						scaleLabel: {
							display: true,
							labelString: 'Winning Round',
						},
					},
				],
				yAxes: [
					{
						scaleLabel: {
							display: true,
							labelString: 'Total Games',
						},
					},
				],
			},
		},
	};
	return getChartUrl(chartParameters);
}

function getChartUrl(chartParameters: unknown): string {
	const chartWidth = 800;
	const chartHeight = 600;
	const backgroundColor = '#ffffff';

	return `https://quickchart.io/chart?bkg=${encodeURIComponent(
		backgroundColor,
	)}&c=${encodeURIComponent(
		JSON.stringify(chartParameters),
	)}&w=${chartWidth}&h=${chartHeight}`;
}
