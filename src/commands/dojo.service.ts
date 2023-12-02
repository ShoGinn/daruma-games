import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  inlineCode,
  InteractionReplyOptions,
} from 'discord.js';
import type { MessageReplyOptions } from 'discord.js';

import { Client } from 'discordx';

import chunk from 'lodash/chunk.js';
import { inject, injectable } from 'tsyringe';

import { AlgoNFTAsset } from '../database/algo-nft-asset/algo-nft-asset.schema.js';
import { AlgoStdAsset } from '../database/algo-std-asset/algo-std-asset.schema.js';
import { DarumaTrainingCacheKeys } from '../enums/daruma-training.js';
import { CustomCache } from '../services/custom-cache.js';
import { DarumaTrainingChannelService } from '../services/dt-channel.js';
import { QuickChartsService } from '../services/quick-charts.js';
import { StatsService } from '../services/stats.js';
import { UserService } from '../services/user.js';
import { DiscordId } from '../types/core.js';
import { ObjectUtil } from '../utils/classes/object-utils.js';
import { RandomUtils } from '../utils/classes/random-utils.js';
import { assetName } from '../utils/functions/dt-embeds.js';
import { getAssetUrl } from '../utils/functions/dt-images.js';
import {
  buildGameType,
  coolDownsDescending,
  karmaPayoutCalculator,
} from '../utils/functions/dt-utils.js';

@injectable()
export class DojoCommandService {
  constructor(
    @inject(DarumaTrainingChannelService) private dtChannelService: DarumaTrainingChannelService,
    @inject(StatsService) private statsService: StatsService,
    @inject(UserService) private userService: UserService,
    @inject(QuickChartsService) private quickChartsService: QuickChartsService,

    @inject(CustomCache) private cache: CustomCache,
  ) {}
  async channelSettings(channelId: string): Promise<InteractionReplyOptions> {
    // Get channel settings for current channel
    const currentChannelSettings = await this.dtChannelService.getChannelById(channelId);
    // If no settings found, return
    const channelSettingsEmbed = new EmbedBuilder();
    channelSettingsEmbed.setTitle(`Channel Settings`);
    channelSettingsEmbed.setDescription(`Current settings for this channel are:`);

    if (!currentChannelSettings) {
      channelSettingsEmbed.addFields({
        name: 'Channel not found',
        value: `No settings found for this channel`,
      });
      return { embeds: [channelSettingsEmbed] };
    }
    const fakeGameAsset = {
      _id: 'fake',
      name: 'fake',
      unitName: 'fake',
      url: 'fake',
      decimals: 0,
    } as unknown as AlgoStdAsset;
    const gameSettings = buildGameType(currentChannelSettings, fakeGameAsset);
    const randomRound = RandomUtils.random.integer(1, 25);
    const karmaPayoutNoZen = karmaPayoutCalculator(randomRound, gameSettings.token, false);
    const karmaPayoutZen = karmaPayoutCalculator(randomRound, gameSettings.token, true);
    channelSettingsEmbed.addFields(
      {
        name: `Game Type`,
        value: gameSettings.gameType,
        inline: true,
      },
      {
        name: 'Cooldown',
        value: ObjectUtil.timeToHuman(gameSettings.coolDown),
        inline: true,
      },
      {
        name: `\u200B`,
        value: `\u200B`,
      },
      {
        name: 'KARMA Payouts',
        value: '\u200B',
      },
      {
        name: 'Base Payout',
        value: gameSettings.token.baseAmount.toString(),
        inline: true,
      },
      {
        name: 'Achieving Zen multiplies the payout by ',
        value: gameSettings.token.zenMultiplier.toString(),
        inline: true,
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: true,
      },
      {
        name: 'Rounds 6+ Adds an additional',
        value: gameSettings.token.roundModifier.toString(),
        inline: true,
      },
      {
        name: 'Each round 6+ in Zen increases the multiplier by',
        value: gameSettings.token.zenRoundModifier.toString(),
        inline: true,
      },
      {
        name: '\u200B',
        value: 'Example Payouts',
      },
      {
        name: `Round ${randomRound} with Zen`,
        value: karmaPayoutZen.toString(),
        inline: true,
      },
      {
        name: `Round ${randomRound} without Zen`,
        value: karmaPayoutNoZen.toString(),
        inline: true,
      },
    );
    return { embeds: [channelSettingsEmbed] };
  }
  async dojoRankings(client: Client): Promise<InteractionReplyOptions> {
    const algoExplorerURL = 'https://www.nftexplorer.app/asset/';
    // dtCacheKeys.TOTALGAMES is generated in the assetRankingByWinsTotalGames function
    const assetRankingWinsByTotalGames = await this.statsService.assetRankingByWinsTotalGames();
    const winsRatio = assetRankingWinsByTotalGames.slice(0, 20);
    const winnersArray = ['\u200B'];
    for (const [index, element] of winsRatio.entries()) {
      if (!element) {
        continue;
      }
      const ownerWallet = element.wallet;
      if (!ownerWallet) {
        continue;
      }
      const discordUserId = await this.userService.getUserByWallet(ownerWallet).catch(() => null);
      const discordUser =
        client.users.cache.find((user) => user.id === discordUserId?._id)?.toString() ??
        'Unknown User';

      const thisAssetName = assetName(element);
      const paddedIndex = (index + 1).toString().padStart(2, ' ');
      const wins = element.dojoWins.toString() ?? '0';
      const losses = element.dojoLosses.toString() ?? '0';
      const urlTitle = `${thisAssetName}\n${wins} wins\n${losses} losses`;
      const assetNameAndLink = `[***${thisAssetName}***](${algoExplorerURL}${element._id} "${urlTitle}")`;
      winnersArray.push(`${inlineCode(paddedIndex)}. ${assetNameAndLink} - ${discordUser}`);
    }
    const newEmbed = new EmbedBuilder();
    const totalGames: number = this.cache.get(DarumaTrainingCacheKeys.TOTAL_GAMES) ?? 0;
    const timeRemaining = this.cache.humanTimeRemaining(DarumaTrainingCacheKeys.TOTAL_GAMES);
    newEmbed.setTitle(`Top 20 Daruma Dojo Ranking`);
    newEmbed.setDescription(winnersArray.join('\n'));
    newEmbed.setThumbnail(await getAssetUrl(winsRatio[0]));
    newEmbed.setFooter({
      text: `Ranking is based on wins/total game rolls \nTotal Daruma Game Rolls ${totalGames.toLocaleString()}\nNext update ${timeRemaining}`,
    });
    const darumaEmbedButton = new ActionRowBuilder<ButtonBuilder>();
    darumaEmbedButton.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Detailed Info')
        .setCustomId('daruma-top20-stats'),
    );
    return { embeds: [newEmbed], components: [darumaEmbedButton] };
  }
  async top20DarumaStats(): Promise<AlgoNFTAsset[]> {
    const assetRankingWinsByTotalGames = await this.statsService.assetRankingByWinsTotalGames();

    const winsRatio = assetRankingWinsByTotalGames.slice(0, 20);

    return winsRatio;
  }
  async topDarumaHolders(client: Client): Promise<InteractionReplyOptions> {
    // Use Custom Cache
    let rank: string[] | undefined = this.cache.get('topHolderRank');

    if (!rank) {
      const topHolders = await this.statsService.topNFTHolders();
      rank = [...topHolders.entries()]
        .slice(0, 20)
        .map(([userId, totalAsset], _index) => {
          const discordUser = client.users.cache.get(userId);
          return discordUser && totalAsset
            ? `${inlineCode(totalAsset.toString().padStart(2, ' '))} ${discordUser.username}`
            : null;
        })
        .filter(Boolean) as string[];
      if (rank.length === 0) {
        rank.push('No one has a Daruma yet!');
      }
      this.cache.set('topHolderRank', rank, 600);
    }
    const ranks = rank.join('\n');

    const newEmbed = new EmbedBuilder();
    newEmbed.setTitle(`Top 20 Daruma Holders`);
    newEmbed.setDescription(ranks);
    // Set footer with time remaining
    const timeRemaining = this.cache.humanTimeRemaining(DarumaTrainingCacheKeys.TOP_NFT_HOLDERS);
    newEmbed.setFooter({ text: `Next update ${timeRemaining}` });
    return { embeds: [newEmbed] };
  }

  async maxRoundsPerGameType(): Promise<InteractionReplyOptions> {
    const maxRoundsPerGameTypePieChartUrl =
      await this.quickChartsService.darumaGameDistributionsPerGameType();
    const chartEmbed = [];
    for (const element of maxRoundsPerGameTypePieChartUrl) {
      chartEmbed.push(
        new EmbedBuilder().setTitle(`Winning Rounds For ${element[0]}`).setImage(element[1]),
      );
    }
    return { embeds: chartEmbed };
  }
  async allHoldersChart(): Promise<InteractionReplyOptions> {
    const theTopNFTHolders = await this.statsService.topNFTHolders();
    const topNFTHoldersPieChartUrl = this.quickChartsService.nftHoldersPieChart(theTopNFTHolders);
    const chartEmbed = new EmbedBuilder()
      .setTitle('Daruma Holders')
      .setImage(topNFTHoldersPieChartUrl);
    return { embeds: [chartEmbed] };
  }
  async showCoolDowns(discordId: DiscordId): Promise<MessageReplyOptions[]> {
    const coolDowns = await coolDownsDescending(discordId);
    if (coolDowns.length === 0) {
      return [{ content: 'You have no cool downs!' }];
    }
    const coolDownMessages = coolDowns.map((coolDown) => {
      const asset = assetName(coolDown);
      const coolDownTimeLeft = ObjectUtil.timeFromNow(coolDown.dojoCoolDown.getTime());
      return `${asset} is ${coolDownTimeLeft}`;
    });

    const embedsNeeded = Math.ceil(coolDownMessages.join('\n').length / 4096);
    const chunkSize = Math.ceil(coolDownMessages.length / embedsNeeded);

    const chunked = chunk(coolDownMessages, chunkSize);
    return chunked.map((page) => ({
      embeds: [new EmbedBuilder().setTitle('Cool Downs').setDescription(page.join('\n'))],
    }));
  }
}
