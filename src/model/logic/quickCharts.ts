import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { DtEncounters } from '../../entities/DtEncounters.entity.js';
import { GameTypes, GameTypesNames } from '../../enums/dtEnums.js';
import { CustomCache } from '../../services/CustomCache.js';

const chartWidth = 800;
const chartHeight = 600;
const backgroundColor = '#ffffff';

export function nftHoldersPieChart(topNFTHolders: Map<string, number>): string {
    // Create a mapping of NFT count to number of users with that count
    const nftCountToNumUsers = new Map<number, number>();
    for (const [_, nftCount] of topNFTHolders) {
        if (nftCount === 0) {
            continue;
        }
        if (nftCountToNumUsers.has(nftCount)) {
            const numUsers = nftCountToNumUsers.get(nftCount) ?? 0;
            nftCountToNumUsers.set(nftCount, numUsers + 1);
        } else {
            nftCountToNumUsers.set(nftCount, 1);
        }
    }
    // Generate chart data
    const chartData = [...nftCountToNumUsers].map(([nftCount, numUsers]) => ({
        label: `${numUsers} wallets with ${nftCount} Darumas`,
        value: numUsers,
    }));
    // Generate chart URL
    const chartParams = {
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
            labels: chartData.map(d => d.label),
            datasets: [
                {
                    data: chartData.map(d => d.value),
                },
            ],
        },
    };
    return getChartUrl(chartParams);
}
async function getAllDtEncounters(): Promise<DtEncounters[]> {
    const orm = container.resolve(MikroORM);
    const db = orm.em.fork().getRepository(DtEncounters);
    return await db.findAll();
}
async function getRoundsDistributionPerGameTypeData(): Promise<
    Record<GameTypes, { rounds: number; count: number }[]>
> {
    const cache = container.resolve(CustomCache);
    const cachedData = (await cache.get('roundsDistributionPerGameType')) as Record<
        GameTypes,
        Array<{
            rounds: number;
            count: number;
        }>
    >;
    if (cachedData) {
        return cachedData;
    }
    const gameData = await getAllDtEncounters();
    const result: Record<GameTypes, Array<{ rounds: number; count: number }>> = {
        [GameTypes.OneVsNpc]: [],
        [GameTypes.OneVsOne]: [],
        [GameTypes.FourVsNpc]: [],
    };

    for (const entry of gameData) {
        const entryMinRounds = Math.min(
            ...Object.values(entry.gameData).map(data => data.gameWinRoundIndex + 1)
        );

        const existingData = result[entry.gameType].find(data => data.rounds === entryMinRounds);
        if (existingData) {
            existingData.count++;
        } else {
            result[entry.gameType].push({ rounds: entryMinRounds, count: 1 });
        }
    }
    cache.set('roundsDistributionPerGameType', result);
    return result;
}
async function __maxRoundsPerGameType(): Promise<
    Record<GameTypes, { id: number; maxRounds: number }>
> {
    const gameData = await getAllDtEncounters();
    const result: Record<GameTypes, { id: number; maxRounds: number }> = {
        [GameTypes.OneVsNpc]: { id: 0, maxRounds: 0 },
        [GameTypes.OneVsOne]: { id: 0, maxRounds: 0 },
        [GameTypes.FourVsNpc]: { id: 0, maxRounds: 0 },
    };

    for (const entry of gameData) {
        const entryMinRounds = Math.min(
            ...Object.values(entry.gameData).map(data => data.gameWinRoundIndex + 1)
        );

        if (entryMinRounds > result[entry.gameType].maxRounds) {
            result[entry.gameType].id = entry.id;
            result[entry.gameType].maxRounds = entryMinRounds;
        }
    }

    return result;
}

export async function darumaGameDistributionsPerGameType(): Promise<[string, string][]> {
    const data = await getRoundsDistributionPerGameTypeData();
    // create a chartUrl tuple with gameType and chartUrl
    const chartUrls: Array<[string, string]> = [];
    for (const [gameType, roundsData] of Object.entries(data)) {
        chartUrls.push([
            GameTypesNames[gameType as GameTypes],
            createChart(roundsData, GameTypesNames[gameType as GameTypes]),
        ]);
    }
    return chartUrls;
}
function createChart(data: Array<{ rounds: number; count: number }>, gameType: string): string {
    const chartData = [];
    const rounds = [];
    chartData.push({
        label: gameType,
        data: data.map(entry => entry.count),
    });
    rounds.push(...data.map(entry => entry.rounds));
    const maxRounds = Math.max(...rounds);
    const minRounds = Math.min(...rounds);
    const roundLabels = [];
    for (let i = minRounds; i <= maxRounds; i++) {
        roundLabels.push(i.toString());
    }
    const chartType = 'bar';
    const chartTitle = 'Winning Rounds per Game Type';
    const chartParams = {
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
    return getChartUrl(chartParams);
}

function getChartUrl(chartParams: unknown): string {
    return `https://quickchart.io/chart?bkg=${encodeURIComponent(
        backgroundColor
    )}&c=${encodeURIComponent(JSON.stringify(chartParams))}&w=${chartWidth}&h=${chartHeight}`;
}
