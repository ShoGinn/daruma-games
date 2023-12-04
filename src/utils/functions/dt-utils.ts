import { produce } from 'immer';
import { container } from 'tsyringe';

import {
  AlgoNFTAsset,
  IAlgoNFTAsset,
} from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import { AlgoStdAsset } from '../../database/algo-std-asset/algo-std-asset.schema.js';
import { DarumaTrainingChannel } from '../../database/dt-channel/dt-channel.schema.js';
import { DarumaTrainingEncounters } from '../../database/dt-encounter/dt-encounters.schema.js';
import {
  GameTypes,
  GIF_RENDER_PHASE,
  renderConfig,
  RenderPhase,
} from '../../enums/daruma-training.js';
import { AlgoNFTAssetService } from '../../services/algo-nft-assets.js';
import { StatsService } from '../../services/stats.js';
import { DiscordId } from '../../types/core.js';
import {
  ChannelSettings,
  ChannelTokenSettings,
  IdtGames,
  IGameStats,
} from '../../types/daruma-training.js';
import { ObjectUtil } from '../classes/object-utils.js';

export function isPlayerAssetRegisteredInGames(
  games: IdtGames,
  discordUserId: DiscordId,
  assetId: string,
): boolean {
  return [...games.values()].some((game) => {
    const player = game.state.playerManager.getPlayer(discordUserId);
    return player?.playableNFT._id === Number(assetId);
  });
}
export function isCoolDownOrRegistered(
  daruma: AlgoNFTAsset,
  discordId: DiscordId,
  games: IdtGames,
): boolean {
  const isCooledDown = daruma.dojoCoolDown < new Date();
  const isRegistered = isPlayerAssetRegisteredInGames(games, discordId, daruma._id.toString());
  return isCooledDown && !isRegistered;
}

export function isNotCooledDownOrRegistered(
  daruma: AlgoNFTAsset,
  discordId: DiscordId,
  games: IdtGames,
): boolean {
  const isNotCooledDown = daruma.dojoCoolDown > new Date();
  const isRegistered = isPlayerAssetRegisteredInGames(games, discordId, daruma._id.toString());
  return isNotCooledDown && !isRegistered;
}

export function filterDarumaIndex(
  darumaIndex: AlgoNFTAsset[],
  discordId: DiscordId,
  games: IdtGames,
  filterFunction: (daruma: AlgoNFTAsset, discordId: DiscordId, games: IdtGames) => boolean,
): AlgoNFTAsset[] {
  return darumaIndex.filter((daruma) => filterFunction(daruma, discordId, games));
}
export function filterCoolDownOrRegistered(
  darumaIndex: AlgoNFTAsset[],
  discordId: DiscordId,
  games: IdtGames,
): AlgoNFTAsset[] {
  return filterDarumaIndex(darumaIndex, discordId, games, isCoolDownOrRegistered);
}

export function filterNotCooledDownOrRegistered(
  darumaIndex: AlgoNFTAsset[],
  discordId: DiscordId,
  games: IdtGames,
): AlgoNFTAsset[] {
  return filterDarumaIndex(darumaIndex, discordId, games, isNotCooledDownOrRegistered);
}
export function buildGameType(
  darumaTrainingChannel: DarumaTrainingChannel,
  gameAsset: AlgoStdAsset,
): ChannelSettings {
  // Default settings
  const cooldownInMilli = 21_600_000; // 6 hours in milliseconds
  const defaults: ChannelSettings = {
    minCapacity: 0,
    maxCapacity: 0,
    channelId: darumaTrainingChannel._id,
    gameType: darumaTrainingChannel.gameType,
    coolDown: cooldownInMilli,
    token: {
      gameAsset,
      baseAmount: 5,
      roundModifier: 5,
      zenMultiplier: 1.5,
      zenRoundModifier: 0.5,
    },
  };
  return produce(defaults, (draft) => {
    switch (darumaTrainingChannel.gameType) {
      case GameTypes.OneVsNpc: {
        draft.minCapacity = 2;
        draft.maxCapacity = 2;
        draft.token.zenMultiplier = 1;
        break;
      }
      case GameTypes.OneVsOne: {
        draft.token.baseAmount = 20;
        draft.minCapacity = 2;
        draft.maxCapacity = 2;
        break;
      }
      case GameTypes.FourVsNpc: {
        draft.minCapacity = 5;
        draft.maxCapacity = 5;
        draft.coolDown = 5_400_000; // 1.5 hours in milliseconds;
        draft.token.baseAmount = 30;
        draft.token.zenMultiplier = 3.5;
        break;
      }
    }
  });
}

/**
 * This is the game payout rules for the game
 * It takes the game winning round (not index)
 * as well as the game channel settings to produce a payout
 *
 * @param {number} winningRound
 * @param {ChannelTokenSettings} tokenSettings
 * @param {boolean} zen
 * @param {number} [payoutModifier]
 * @returns {*}  {number}
 */
export function karmaPayoutCalculator(
  winningRound: number,
  tokenSettings: ChannelTokenSettings,
  zen: boolean,
  payoutModifier?: number | undefined,
): number {
  const { baseAmount, roundModifier, zenMultiplier, zenRoundModifier } = tokenSettings;
  const roundMultiplier = Math.max(0, winningRound - 5);
  const regularPayout = baseAmount + roundModifier * roundMultiplier;
  const zenPayout = regularPayout * (zenRoundModifier * roundMultiplier + zenMultiplier);
  const payout = zen ? zenPayout : regularPayout;
  return Math.floor(payoutModifier ? payout * payoutModifier : payout);
}
/**
 * This function gets the current rank of an asset
 *

 * @param {AlgoNFTAsset} asset
 * @returns {*}  {Promise<{ currentRank: string; totalAssets: string }>}
 */
export async function assetCurrentRank(
  asset: AlgoNFTAsset | IAlgoNFTAsset,
): Promise<{ currentRank: string; totalAssets: string }> {
  const statsService = container.resolve(StatsService);

  const allAssetRanks = await statsService.assetRankingByWinsTotalGames();
  const assetRank =
    allAssetRanks.findIndex((rankedAsset: AlgoNFTAsset) => rankedAsset._id === asset._id) + 1;
  return {
    currentRank: assetRank.toLocaleString(),
    totalAssets: allAssetRanks.length.toLocaleString(),
  };
}

/**
 * This function gets the assets that are in cool down for a user
 * and sorts them in descending order
 *

 * @param {DiscordId} discordId
 * @returns {*}  {Promise<Array<AlgoNFTAsset>>}
 */
export async function coolDownsDescending(discordId: DiscordId): Promise<AlgoNFTAsset[]> {
  const algoNFTAssetService = container.resolve(AlgoNFTAssetService);

  const playableAssets = await algoNFTAssetService.getAllAssetsByOwner(discordId);

  // remove assets that are not in cool down
  const assetsInCoolDown = playableAssets.filter((asset) => {
    return asset.dojoCoolDown > new Date();
  });
  return assetsInCoolDown.sort((a, b) => b.dojoCoolDown.getTime() - a.dojoCoolDown.getTime());
}

export const phaseDelay = async (
  gameType: GameTypes,
  phase: RenderPhase,
  executeWait: boolean = true,
  randomDelayFor: (minTime: number, maxTime: number) => Promise<void> = ObjectUtil.randomDelayFor,
): Promise<[number, number]> => {
  const minTime = getMinTime(gameType, phase);
  const maxTime = getMaxTime(gameType, phase);

  if (executeWait) {
    await randomDelayFor(minTime, maxTime);
  }

  return [minTime, maxTime];
};
export const getMinTime = (
  gameType: GameTypes,
  phase: RenderPhase,
  defaultDelay: number = 1000,
): number => {
  if (GameTypes.FourVsNpc === gameType && phase === GIF_RENDER_PHASE) {
    return defaultDelay;
  }
  return renderConfig[phase]?.durMin ?? 0;
};

export const getMaxTime = (
  gameType: GameTypes,
  phase: RenderPhase,
  defaultDelay: number = 1000,
): number => {
  if (GameTypes.FourVsNpc === gameType && phase === GIF_RENDER_PHASE) {
    return defaultDelay;
  }
  return renderConfig[phase]?.durMax ?? 0;
};

export function processEncounters(
  encounters: DarumaTrainingEncounters[],
): Record<string, IGameStats> {
  const playerStats: Record<string, IGameStats> = {};

  for (const encounter of encounters) {
    let minRolls = Number.POSITIVE_INFINITY;
    const rollsCount: Record<string, number> = {};

    // Count rolls for each player and find the minimum rolls
    for (const playerId in encounter.gameData) {
      const rollCount = encounter.gameData[playerId]!.rolls.length;
      rollsCount[playerId] = rollCount;
      if (rollCount < minRolls) {
        minRolls = rollCount;
      }
    }

    // Determine winners, losers, and zen players
    const winners = [];
    const losers = [];
    for (const playerId in rollsCount) {
      if (rollsCount[playerId] === minRolls) {
        winners.push(playerId);
      } else {
        losers.push(playerId);
      }

      // Initialize player stats if not already present
      if (!playerStats[playerId]) {
        playerStats[playerId] = { wins: 0, losses: 0, zen: 0 };
      }
    }

    // Update stats based on this encounter's results
    for (const playerId of winners) {
      playerStats[playerId]!.wins++;
      if (winners.length > 1) {
        playerStats[playerId]!.zen++;
      }
    }
    for (const playerId of losers) {
      playerStats[playerId]!.losses++;
    }
  }

  return playerStats;
}
