import { inlineCode } from 'discord.js';

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

export interface IChampion {
  assetNumber: number;
  ownerWallet: WalletAddress;
  databaseUser: DatabaseUser;
}
export interface IPulledChampions {
  championDate: Date;
  totalChampions: number;
  championsAssets: number[];
}
export interface IChampionEmbed {
  pulledChampions: IPulledChampions;
  champions: IChampion[];
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
  async getChampionsByDate(date: Date): Promise<number[]> {
    const encountersByDate = await this.dtEncountersService.getAllByDate(date);
    return this.filterChampionsByWinners(encountersByDate);
  }
  async getRandomNumberOfChampionsByDate(
    date: Date,
    numberOfChamps: number,
  ): Promise<IPulledChampions> {
    const champions = await this.getChampionsByDate(date);
    const sampleSize = Math.min(numberOfChamps, champions.length);
    const sampleOfChampions = RandomUtils.random.sample(champions, sampleSize);

    return {
      championDate: date,
      totalChampions: champions.length,
      championsAssets: sampleOfChampions.sort(),
    };
  }
  async createChampionRecord(pulledChampions: IPulledChampions): Promise<IChampionEmbed> {
    const championsPromises = pulledChampions.championsAssets.map((assetNumber) =>
      this.createChampion(assetNumber),
    );
    const championResults = await Promise.all(championsPromises);
    const champions = championResults.filter((champion) => champion !== null) as IChampion[];
    return { pulledChampions, champions };
  }

  async createChampion(assetNumber: number): Promise<IChampion | null> {
    try {
      const ownerWallet = await this.assetService.getOwnerWalletFromAssetIndex(assetNumber);
      const databaseUser = await this.userService.getUserByWallet(ownerWallet);
      return { assetNumber, ownerWallet, databaseUser };
    } catch {
      return null;
    }
  }
  async buildChampionString(champion: IChampion): Promise<string> {
    const { assetNumber, databaseUser, ownerWallet } = champion;
    const userMention = await getUserMention(databaseUser._id);
    return `Daruma Asset#: ${inlineCode(assetNumber.toString())}\nDiscord User: ${userMention}\nOwner Wallet: ${inlineCode(ownerWallet)}\n\n`;
  }
  async buildChampionEmbed(champEmbedInterface: IChampionEmbed): Promise<string> {
    const { pulledChampions, champions } = champEmbedInterface;
    const { totalChampions, championDate } = pulledChampions;

    if (totalChampions === 0) {
      return `No Champions for Date: ${inlineCode(championDate.toISOString())}`;
    }

    const championsString = await Promise.all(
      champions.map((element) => this.buildChampionString(element)),
    );

    return `${inlineCode(
      champions.length.toString(),
    )} Random Champions Picked for Date: ${inlineCode(
      championDate.toISOString(),
    )}\n\nTotal Champions Who Played During That Period: ${inlineCode(totalChampions.toString())}\n\n${championsString.join(
      '\n',
    )}`;
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
