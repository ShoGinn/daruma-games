import { inject, injectable, singleton } from 'tsyringe';

import { DarumaTrainingEncounters } from '../database/dt-encounter/dt-encounters.schema.js';
import { DatabaseUser } from '../database/user/user.schema.js';
import { gameNPCs } from '../enums/daruma-training.js';
import { WalletAddress } from '../types/core.js';
import { RandomUtils } from '../utils/classes/random-utils.js';
import { getUserMention } from '../utils/functions/dt-embeds.js';

import { AlgoNFTAssetService } from './algo-nft-assets.js';
import { DarumaTrainingEncountersService } from './dt-encounters.js';
import { UserService } from './user.js';

interface IChampion {
  assetNumber: number;
  ownerWallet: WalletAddress;
  databaseUser: DatabaseUser;
}
@injectable()
@singleton()
export class DarumaTrainingChampions {
  constructor(
    @inject(DarumaTrainingEncountersService)
    private dtEncountersService: DarumaTrainingEncountersService,
    @inject(UserService) private userService: UserService,
    @inject(AlgoNFTAssetService) private assetService: AlgoNFTAssetService,
  ) {}
  async getRandomNumberOfChampionsByDate(date: Date, numberOfChamps: number): Promise<number[]> {
    if (numberOfChamps <= 0) {
      return [];
    }
    const encountersByDate = await this.dtEncountersService.getAllByDate(date);
    const champions = this.filterChampionsByWinners(encountersByDate);
    if (champions.length <= numberOfChamps) {
      return champions;
    }
    return RandomUtils.random.sample(champions, numberOfChamps);
  }
  async createChampionRecord(assetNumbers: number[]): Promise<IChampion[]> {
    const newChampions: IChampion[] = [];
    for (const assetNumber of assetNumbers) {
      try {
        const ownerWallet = await this.assetService.getOwnerWalletFromAssetIndex(assetNumber);
        const databaseUser = await this.userService.getUserByWallet(ownerWallet);
        newChampions.push({
          assetNumber,
          ownerWallet,
          databaseUser,
        });
      } catch {
        continue;
      }
    }
    return newChampions;
  }
  async buildChampionEmbed(champions: IChampion[]): Promise<string> {
    let championString = '';
    for (const champion of champions) {
      const { assetNumber, databaseUser, ownerWallet } = champion;
      const userMention = await getUserMention(databaseUser._id);
      championString += `Asset: ${assetNumber}\nDiscord User: ${userMention}\nOwner Wallet: ${ownerWallet}\n\n`;
    }
    return championString;
  }
  filterChampionsByWinners(encounters: DarumaTrainingEncounters[]): number[] {
    const winnersSet = new Set<number>();
    const npcAssetNumbers = new Set(gameNPCs.map((npc) => npc.assetIndex)); // Get the asset numbers of the NPCs
    // Add the legacy NPC asset numbers to the set
    npcAssetNumbers.add(3);
    npcAssetNumbers.add(4);

    for (const encounter of encounters) {
      let minRollsLength = Number.POSITIVE_INFINITY;
      let winners: number[] = [];

      for (const assetNumber in encounter.gameData) {
        const rolls = encounter.gameData[assetNumber]!.rolls;
        if (rolls.length < minRollsLength) {
          minRollsLength = rolls.length;
          winners = [Number.parseInt(assetNumber)];
        } else if (rolls.length === minRollsLength) {
          winners.push(Number.parseInt(assetNumber));
        }
      }

      for (const winner of winners) {
        // Only add the winner to the set if they are not an NPC
        if (!npcAssetNumbers.has(winner)) {
          winnersSet.add(winner);
        }
      }
    }

    return [...winnersSet];
  }
}
