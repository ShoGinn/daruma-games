import { randomInt } from 'node:crypto';

import {
  ActionRowBuilder,
  APIEmbed,
  APIEmbedField,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Colors,
  CommandInteraction,
  User as DiscordUser,
  EmbedBuilder,
  inlineCode,
  spoiler,
  userMention,
} from 'discord.js';

import { Pagination, PaginationType } from '@discordx/pagination';
import { Client } from 'discordx';

import chunk from 'lodash/chunk.js';
import { container } from 'tsyringe';

import {
  AlgoNFTAsset,
  IAlgoNFTAsset,
} from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import {
  GameStatus,
  GameTypesNames,
  WaitingRoomInteractionIds,
} from '../../enums/daruma-training.js';
import { TenorImageManager } from '../../manager/tenor-image.js';
import { AlgoNFTAssetService } from '../../services/algo-nft-assets.js';
import { Algorand } from '../../services/algorand.js';
import { StatsService } from '../../services/stats.js';
import { UserService } from '../../services/user.js';
import { DiscordId } from '../../types/core.js';
import type { EmbedOptions, GameWinInfo, IdtGames } from '../../types/daruma-training.js';
import { version } from '../../version.js';
import { Game } from '../classes/dt-game.js';
import { Player } from '../classes/dt-player.js';
import { InteractionUtils } from '../classes/interaction-utils.js';
import { ObjectUtil } from '../classes/object-utils.js';
import { RandomUtils } from '../classes/random-utils.js';

import { emojiConvert } from './dt-emojis.js';
import { gameStatusHostedUrl, getAssetUrl } from './dt-images.js';
import {
  assetCurrentRank,
  filterCoolDownOrRegistered,
  filterNotCooledDownOrRegistered,
  isPlayerAssetRegisteredInGames,
} from './dt-utils.js';
import logger from './logger-factory.js';

const tenorImageManager = container.resolve(TenorImageManager);
const client = container.resolve(Client);
const algorand = container.resolve(Algorand);
const algoNFTAssetService = container.resolve(AlgoNFTAssetService);
const statsService = container.resolve(StatsService);
const userService = container.resolve(UserService);

export async function getUserMention(discordUserId: DiscordId): Promise<string> {
  try {
    const user: DiscordUser = await client.users.fetch(discordUserId);
    return `${user.username}`;
  } catch (error) {
    logger.error(`Error getting user mention for ID ${discordUserId}: ${JSON.stringify(error)}`);
    return userMention(discordUserId);
  }
}
export async function doEmbed<T extends EmbedOptions>(
  game: Game,
  data?: T,
): Promise<BaseMessageOptions> {
  const embed = createBaseEmbed();
  const playerArray = game.state.playerManager.getAllPlayers();
  const playerArrayFields = await getPlayerArrayFields(game, playerArray);
  const playerCount = game.getNPC ? playerArray.length - 1 : playerArray.length;

  switch (game.state.status) {
    case GameStatus.waitingRoom: {
      return getWaitingRoomEmbed(game, embed, playerArrayFields, playerCount);
    }
    case GameStatus.activeGame:
    case GameStatus.finished: {
      return getFinishedGameEmbed(game, embed, playerArrayFields);
    }
    case GameStatus.win: {
      return await getWinEmbed(game.state.gameWinInfo, embed, data as Player);
    }
    case GameStatus.maintenance: {
      return await getMaintenanceEmbed(embed);
    }
  }
}
function createBaseEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Daruma-Games`)
    .setColor('DarkAqua')
    .setFooter({ text: `v${version}` })
    .setTimestamp();
}
async function getPlayerArrayFields(game: Game, playerArray: Player[]): Promise<APIEmbedField[]> {
  const fieldPromises = playerArray.map(
    async (player, index) =>
      await createPlayerField(game.state.status, game.state.gameWinInfo.zen, player, index),
  );
  const playerFields = await Promise.all(fieldPromises);

  const remainingCapacity = game.settings.maxCapacity - playerArray.length;
  const placeholderFields = createPlaceholderFields(remainingCapacity, playerArray.length);

  return [...playerFields, ...placeholderFields, { name: '\u200B', value: '\u200B' }];
}

export async function createPlayerField(
  gameStatus: GameStatus,
  zen: boolean,
  player: Player,
  index: number,
): Promise<APIEmbedField> {
  const userMention = player.isNpc ? 'NPC' : await getUserMention(player.dbUser._id);
  const gameFinished = gameStatus === GameStatus.finished;
  const winnerCheckBox = gameFinished
    ? player.isWinner
      ? zen
        ? ':yin_yang::white_check_mark:'
        : ':white_check_mark:'
      : ':x:'
    : '';

  const playerNumber = `${winnerCheckBox} ${emojiConvert((index + 1).toString())}`;
  const embedMessage = [playerNumber, `***${assetName(player.playableNFT)}***`, `(${userMention})`];

  return {
    name: '\u200B',
    value: embedMessage.join(' - '),
  };
}

function createPlaceholderFields(remainingCapacity: number, playerCount: number): APIEmbedField[] {
  const placeholderFields = [];
  for (let index = 0; index < remainingCapacity; index++) {
    placeholderFields.push({
      name: '\u200B',
      value: `${emojiConvert((playerCount + index + 1).toString())} - ${spoiler('Waiting...')}`,
    });
  }
  return placeholderFields;
}

function getWaitingRoomEmbed(
  game: Game,
  embed: EmbedBuilder,
  playerArrayFields: APIEmbedField[],
  playerCount: number,
  gameTypeTitle: string = GameTypesNames[game.settings.gameType] || 'Unknown',
): BaseMessageOptions {
  const quickJoin = (): ButtonBuilder[] => {
    const buttons: ButtonBuilder[] = [];
    buttons.push(
      new ButtonBuilder()
        .setCustomId(WaitingRoomInteractionIds.quickJoin)
        .setLabel(`Quick Join`)
        .setStyle(ButtonStyle.Success),
    );
    return buttons;
  };
  const setupButtons = (): ButtonBuilder[] => {
    const buttons: ButtonBuilder[] = [];
    buttons.push(
      new ButtonBuilder()
        .setCustomId(WaitingRoomInteractionIds.registerPlayer)
        .setLabel(`Choose your Daruma`)
        .setStyle(ButtonStyle.Primary),
    );

    if (playerCount > 0) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(WaitingRoomInteractionIds.withdrawPlayer)
          .setLabel(`Withdraw Daruma`)
          .setStyle(ButtonStyle.Danger),
      );
    }
    return buttons;
  };
  embed
    .setTitle(`${gameTypeTitle} - Waiting Room`)
    .setImage(gameStatusHostedUrl(game.state.status, game.state.status))
    .setFields(playerArrayFields);

  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(setupButtons()),
    new ActionRowBuilder<ButtonBuilder>().addComponents(quickJoin()),
  ];
  return { embeds: [embed.toJSON()], components };
}

function getFinishedGameEmbed(
  game: Game,
  embed: EmbedBuilder,
  playerArrayFields: APIEmbedField[],
  gameTypeTitle: string = GameTypesNames[game.settings.gameType] || 'Unknown',
): BaseMessageOptions {
  let titleMessage = `The Training has started!`;
  let embedImage: string | null = gameStatusHostedUrl(
    game.settings.gameType,
    game.state.status.toString(),
  );
  if (game.state.status !== GameStatus.activeGame) {
    titleMessage = 'The training has ended!';
    embedImage = null;
  }

  embed
    .setTitle(titleMessage)
    .setFooter({
      text: `Dojo Training Event #${game.state.encounterId?.toLocaleString() ?? 'unk'}`,
    })
    .setDescription(`${gameTypeTitle}`)
    .setFields(playerArrayFields)
    .setImage(embedImage);
  return { embeds: [embed.toJSON()] };
}

async function getWinEmbed(
  gameWinInfo: GameWinInfo,
  embed: EmbedBuilder,
  player: Player,
): Promise<BaseMessageOptions> {
  const payoutFields = [];
  const sampledWinningTitles = RandomUtils.random.pick(winningTitles);
  const sampledWinningReasons = RandomUtils.random.pick(winningReasons);
  embed
    .setDescription(`${assetName(player.playableNFT)} ${sampledWinningReasons}`)
    .setImage(await getAssetUrl(player.playableNFT));

  if (gameWinInfo.zen) {
    embed
      .setThumbnail(gameStatusHostedUrl('zen', GameStatus.win))
      .setDescription(`${assetName(player.playableNFT)} has achieved Zen!`)
      .setImage(await getAssetUrl(player.playableNFT, true));
  }
  if (!player.isNpc) {
    payoutFields.push(...(await darumaStats(player.playableNFT)), {
      name: 'Payout',
      value: `${gameWinInfo.payout.toLocaleString()} KARMA`,
    });
  }
  embed.setTitle(sampledWinningTitles).setFields(payoutFields);
  return { embeds: [embed.toJSON()] };
}

async function getMaintenanceEmbed(embed: EmbedBuilder): Promise<BaseMessageOptions> {
  const tenorUrl = await tenorImageManager.fetchRandomTenorGif('maintenance');
  embed
    .setTitle('Maintenance -- Waiting Room Closed')
    .setColor('Red')
    .setDescription(
      `The Dojo is currently undergoing maintenance. Please check back later.\n\nIf you have any questions, please contact the Dojo staff.\n\nThank you for your patience.`,
    )
    .setImage(tenorUrl);
  return { embeds: [embed.toJSON()] };
}
export async function postGameWinEmbeds(game: Game): Promise<BaseMessageOptions> {
  if (game.payoutModifier) {
    await game.waitingRoomManager.sendToChannel('**Karma Bonus modifier is active!**');
  }
  const postGameWinEmbeds: APIEmbed[] = [];
  const players = game.state.playerManager.getAllPlayers();
  for (const player of players) {
    if (player.coolDownModified) {
      postGameWinEmbeds.push(await coolDownModified(player, game.settings.coolDown));
    }
    if (player.isWinner) {
      const isWinnerEmbed = await doEmbed<Player>(game, player);
      if (isWinnerEmbed.embeds && isWinnerEmbed.embeds[0]) {
        postGameWinEmbeds.push(isWinnerEmbed.embeds[0] as APIEmbed);
      }
    }
  }
  return { embeds: postGameWinEmbeds };
}
async function coolDownCheckEmbed(
  filteredDaruma: AlgoNFTAsset[],
  allDarumas: AlgoNFTAsset[] | undefined,
): Promise<BaseMessageOptions[] | undefined> {
  if (filteredDaruma.length === 0) {
    let whyMessage = 'You need to register your Daruma wallet first!';
    if (allDarumas) {
      const onCooldown = allDarumas.length - filteredDaruma.length;
      if (onCooldown > 0) {
        whyMessage = `Your ${inlineCode(
          onCooldown.toLocaleString(),
        )} Daruma are unavailable for training right now.`;
      }
    }
    const tenorUrl = await tenorImageManager.fetchRandomTenorGif('sad');
    return [
      {
        embeds: [
          new EmbedBuilder()
            .setTitle('No Darumas available')
            .setDescription('Please try again later')
            .setFields([{ name: 'Why?', value: whyMessage }])
            .setColor('Red')
            .setImage(tenorUrl),
        ],
        components: [
          ...(whyMessage.includes('register') ? walletSetupButton() : randomCoolDownOfferButton()),
          ...showCoolDownsButton(),
        ],
      },
    ];
  }
  return undefined;
}
function embedButton(
  assetId: string,
  buttonName: string,
  buttonLabel: string,
): ActionRowBuilder<ButtonBuilder> {
  const trainButton = new ButtonBuilder()
    .setCustomId(`daruma-${buttonName}_${assetId}`)
    .setLabel(buttonLabel)
    .setStyle(ButtonStyle.Primary);
  const flexButton = new ButtonBuilder()
    .setCustomId(`daruma-flex_${assetId}`)
    .setLabel('Flex your Daruma!')
    .setStyle(ButtonStyle.Secondary);
  const allStats = new ButtonBuilder()
    .setCustomId(`daruma-all-stats`)
    .setLabel('All Daruma Stats!')
    .setStyle(ButtonStyle.Success);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(trainButton, flexButton, allStats);
}

async function darumaPagesEmbed(
  interaction: CommandInteraction | ButtonInteraction,
  darumas: AlgoNFTAsset[] | AlgoNFTAsset,
  darumaIndex?: AlgoNFTAsset[] | undefined,
  flex: boolean = false,
  noButtons: boolean = false,
): Promise<BaseMessageOptions[]> {
  let embedTitle = 'Empower your creativity!';
  let embedDescription = 'You can edit your Daruma with a custom name\nProfanity is discouraged.';
  let embedDarumaName = 'Current Name';
  let buttonName = 'edit-alias';
  let buttonLabel = 'Edit Custom Name!';
  if (noButtons) {
    embedTitle = 'Top Ranked Daruma';
    embedDescription = 'These Daruma are the best of the best!';
  }
  if (darumaIndex) {
    embedTitle = 'Select your Daruma';
    embedDescription = 'Choose your Daruma to train with!';
    embedDarumaName = 'Name';
    buttonName = 'select';
    buttonLabel = 'Train!';
  }
  if (flex && !Array.isArray(darumas)) {
    const battleCry = darumas.battleCry || ' ';
    embedTitle = 'When you got it you got it!';
    embedDescription = battleCry;
    embedDarumaName = 'Name';
  }
  if (Array.isArray(darumas)) {
    const checkCoolDown = await coolDownCheckEmbed(darumas, darumaIndex);
    return (
      checkCoolDown ||
      (await Promise.all(
        darumas.map(async (daruma, index) => {
          return {
            embeds: [
              new EmbedBuilder()
                .setTitle(embedTitle)
                .setDescription(embedDescription)
                .addFields(
                  {
                    name: embedDarumaName,
                    value: assetName(daruma),
                  },
                  {
                    name: 'Battle Cry',
                    value: daruma.battleCry || ' ',
                  },
                  ...(await darumaStats(daruma)),
                  ...parseTraits(daruma),
                )
                .setImage(await getAssetUrl(daruma))
                .setColor('DarkAqua')
                .setFooter({ text: `Daruma ${index + 1}/${darumas.length}` }),
            ],
            components: noButtons
              ? []
              : [embedButton(daruma._id.toString(), buttonName, buttonLabel)],
          };
        }),
      ))
    );
  } else {
    const algoExplorerURL = 'https://www.nftexplorer.app/asset/';
    return [
      {
        embeds: [
          new EmbedBuilder()
            .setAuthor({
              name: `${interaction.user.username} | ${assetName(darumas)}`,
              iconURL: interaction.user.displayAvatarURL(),
              url: `${algoExplorerURL}${darumas._id}`,
            })
            .setFooter({ text: 'Flexed!' })
            .setTitle(embedTitle)
            .setDescription(embedDescription)
            .addFields(
              {
                name: embedDarumaName,
                value: assetName(darumas),
              },
              ...(await darumaStats(darumas)),
              ...parseTraits(darumas),
            )
            .setImage(await getAssetUrl(darumas))
            .setColor('DarkAqua'),
        ],
        components: [],
      },
    ];
  }
}
function walletSetupButton(): Array<ActionRowBuilder<ButtonBuilder>> {
  const walletButton = new ButtonBuilder()
    .setCustomId('walletSetup')
    .setLabel('Setup Wallet')
    .setStyle(ButtonStyle.Primary);
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(walletButton)];
}
function parseTraits(asset: AlgoNFTAsset): APIEmbedField[] {
  const traits = asset.arc69?.properties;
  // If trait properties exist create array of fields
  if (traits) {
    return Object.keys(traits).map((trait) => {
      let traitsValue = traits[trait];
      if (!traitsValue) {
        traitsValue = 'None';
      } else if (typeof traitsValue === 'object') {
        traitsValue = JSON.stringify(traitsValue);
      }
      return {
        name: trait.toString(),
        value: traitsValue.toString(),
        inline: true,
      };
    });
  }
  return [];
}
async function darumaStats(asset: AlgoNFTAsset | IAlgoNFTAsset): Promise<APIEmbedField[]> {
  const darumaRanking = await getAssetRankingForEmbed(asset);
  return [
    {
      name: 'Wins',
      value: inlineCode(asset.dojoWins.toLocaleString() ?? '0'),
      inline: true,
    },
    {
      name: 'Losses',
      value: inlineCode(asset.dojoLosses.toLocaleString() ?? '0'),
      inline: true,
    },
    {
      name: 'Zen',
      value: inlineCode(asset.dojoZen.toLocaleString() ?? '0'),
      inline: true,
    },
    {
      name: 'Daruma Ranking',
      value: inlineCode(darumaRanking),
      inline: false,
    },
  ];
}
async function getAssetRankingForEmbed(asset: AlgoNFTAsset | IAlgoNFTAsset): Promise<string> {
  const { currentRank, totalAssets } = await assetCurrentRank(asset);
  const rankingIndex = Number.parseInt(currentRank, 10) - 1;
  const rankingMessages = [
    'Number 1!!!\n🥇',
    'Number 2!\n🥈',
    'Number 3!\n🥉',
    'Number 4!\n🎈',
    'Number 5!\n🎈',
  ];
  const message = rankingMessages[rankingIndex] || '';
  return `${message}${message ? ' ' : ''}${currentRank}/${totalAssets}`;
}
export async function allDarumaStats(interaction: ButtonInteraction): Promise<void> {
  // get users playable assets
  const caller = await InteractionUtils.getInteractionCaller(interaction);
  const userAssets = await algoNFTAssetService.getAllAssetsByOwner(
    interaction.user.id as DiscordId,
  );
  const rankedAssets = await statsService.assetRankingByWinsTotalGames();
  // filter ranked assets to only include assets that are the same as assets in the users wallet

  const assets = rankedAssets.filter((rankedAsset) =>
    userAssets.some((asset) => rankedAsset._id === asset._id),
  );

  // Build embed with 25 assets per embed!
  const iconUrl = caller.displayAvatarURL();
  const baseEmbed: APIEmbed = {
    title: 'All Daruma Stats',
    description: 'All of your Daruma stats in one place!',
    // get user color
    color: caller.displayColor,
    author: {
      name: interaction.user.username,
      icon_url: iconUrl,
    },
  };

  // build an api embed

  const fields: APIEmbedField[] = [];
  for (const element of assets) {
    const assetRanking = await getAssetRankingForEmbed(element);

    // convert wins, losses, and zen to locale string
    const winsString = inlineCode(element.dojoWins.toLocaleString());
    const lossesString = inlineCode(element.dojoLosses.toLocaleString());
    const zenString = inlineCode(element.dojoZen.toLocaleString());

    fields.push({
      name: assetName(element),
      value: `W/L: ${winsString}/${lossesString} | Zen: ${zenString} | Rank: ${inlineCode(
        assetRanking,
      )}`,
    });
  }
  // split fields into 25 fields per embed
  const splitFields = chunk(fields, 25);
  const embeds: EmbedBuilder[] = [];
  for (const element of splitFields) {
    const embed = new EmbedBuilder(baseEmbed);
    embeds.push(embed.setFields(element));
  }
  // convert embeds to api embeds
  const embeded = embeds.map((embed) => {
    return {
      embeds: [embed],
    };
  });
  if (embeded.length === 0) {
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: 'Hmm our records seem to be empty!',
    });
    return;
  }
  try {
    await new Pagination(interaction, embeded, {
      type: PaginationType.SelectMenu,
      dispose: true,
      onTimeout: () => {
        interaction.deleteReply().catch(() => null);
      },
      // 60 Seconds in ms
      time: 60_000,
    }).send();
  } catch (error) {
    if (error instanceof Error) {
      await InteractionUtils.replyOrFollowUp(interaction, {
        content: 'Something went wrong!',
      });
      logger.error(`${interaction.user.username} (${interaction.user.id}) ran into an error!`);
      logger.error(error.stack);
    }
  }
}
export async function coolDownModified(player: Player, orgCoolDown: number): Promise<APIEmbed> {
  // convert the cooldown from ms to human readable
  const coolDown = ObjectUtil.timeToHuman(player.randomCoolDown);
  // if player.RandomCoolDown is higher than its bad
  const badDay = player.randomCoolDown > orgCoolDown;
  // If badDay set color to red otherwise set color to green
  const color = badDay ? Colors.Red : Colors.Green;
  // make message to say increased or decreased
  const newCoolDownMessage = badDay
    ? `Increased Cool Down this time to ${coolDown}.`
    : `Decreased Cool Down this time to ${coolDown}.`;
  const coolDownModifiedEmbed: APIEmbed = {
    description: spoiler(`${newCoolDownMessage} for ${assetName(player.playableNFT)}`),
    color,
    thumbnail: { url: await getAssetUrl(player.playableNFT) },
  };
  return coolDownModifiedEmbed;
}
function randomCoolDownOfferButton(): Array<ActionRowBuilder<ButtonBuilder>> {
  // Return a button with a 1 in 3 chance otherwise return undefined
  const random = randomInt(1, 3);
  if (random !== 1) {
    return [];
  }

  const randomOffer = new ButtonBuilder()
    .setCustomId(`randomCoolDownOffer`)
    .setLabel('A Shady Offer')
    .setStyle(ButtonStyle.Secondary);

  const randomOfferButton = new ActionRowBuilder<ButtonBuilder>().addComponents(randomOffer);
  return [randomOfferButton];
}
function showCoolDownsButton(): Array<ActionRowBuilder<ButtonBuilder>> {
  const showCoolDowns = new ButtonBuilder()
    .setCustomId(`showCoolDowns`)
    .setLabel('Show Cool Downs')
    .setStyle(ButtonStyle.Primary);

  const showCoolDownsButton = new ActionRowBuilder<ButtonBuilder>().addComponents(showCoolDowns);
  return [showCoolDownsButton];
}
export async function quickJoinDaruma(
  interaction: ButtonInteraction,
  games: IdtGames,
): Promise<void> {
  const interactionUserId = interaction.user.id as DiscordId;

  const allAssets = await algoNFTAssetService.getAllAssetsByOwner(interactionUserId);
  const filteredDaruma = filterCoolDownOrRegistered(allAssets, interactionUserId, games);
  const coolDownCheck = await coolDownCheckEmbed(filteredDaruma, allAssets);
  let randomDaruma;
  if (coolDownCheck && coolDownCheck[0]) {
    await InteractionUtils.replyOrFollowUp(interaction, coolDownCheck[0]);
    return;
  }
  try {
    randomDaruma = RandomUtils.random.pick(filteredDaruma);
  } catch {
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: 'Hmm our records seem to be empty!',
    });
    return;
  }
  await registerPlayer(interaction, games, randomDaruma);
}

export async function paginatedDarumaEmbed(
  interaction: ButtonInteraction | CommandInteraction,
  games?: IdtGames | undefined,
  assets?: AlgoNFTAsset[],
): Promise<void> {
  const interactionUserId = interaction.user.id as DiscordId;
  let noButtons = false;
  if (assets) {
    noButtons = true;
  } else {
    assets = await algoNFTAssetService.getAllAssetsByOwner(interactionUserId);
  }
  if (games) {
    const filteredDaruma = filterCoolDownOrRegistered(assets, interactionUserId, games);
    const darumaPages = await darumaPagesEmbed(interaction, filteredDaruma, assets);
    await paginateDaruma(interaction, darumaPages, filteredDaruma, 10);
    return;
  }
  const darumaPages = await darumaPagesEmbed(interaction, assets, undefined, false, noButtons);
  await paginateDaruma(interaction, darumaPages, assets);
}
async function getRemainingPlayableDarumaCountAndNextCoolDown(
  interaction: ButtonInteraction | CommandInteraction,
  games: IdtGames,
): Promise<{ darumaLength: number; nextDarumaMessage: string }> {
  const interactionUserId = interaction.user.id as DiscordId;

  const allAssets = await algoNFTAssetService.getAllAssetsByOwner(interactionUserId);
  // Get all the Assets in cooldown or in a game
  const assetsInCoolDown = filterNotCooledDownOrRegistered(allAssets, interactionUserId, games);
  // Get all the Assets not in cooldown or in a game
  const filteredDaruma = filterCoolDownOrRegistered(allAssets, interactionUserId, games);
  let nextDarumaCoolDown = 0;
  let nextDarumaCoolDownMessage = '';
  const remainingDarumaLength = filteredDaruma.length;
  // Sort the assets by Date() and use GetTime() and sort them by the soonest cool down
  assetsInCoolDown.sort((a, b) => a.dojoCoolDown.getTime() - b.dojoCoolDown.getTime());

  if (remainingDarumaLength === 0 && assetsInCoolDown.length > 0) {
    const nextDaruma = assetsInCoolDown[0];
    nextDarumaCoolDown = nextDaruma?.dojoCoolDown.getTime() || 0;
    nextDarumaCoolDownMessage = `\nYour next Daruma (${assetName(
      nextDaruma,
    )}) will be available ${ObjectUtil.timeFromNow(nextDarumaCoolDown)}`;
  }
  return {
    darumaLength: remainingDarumaLength,
    nextDarumaMessage: nextDarumaCoolDownMessage,
  };
}
async function paginateDaruma(
  interaction: ButtonInteraction | CommandInteraction,
  darumaPages: BaseMessageOptions[],
  assets: AlgoNFTAsset[],
  timeOut: number = 60,
): Promise<void> {
  if (darumaPages.length > 1) {
    await new Pagination(interaction, darumaPages, {
      type: PaginationType.SelectMenu,
      dispose: true,
      placeholder: 'Select a Daruma',
      showStartEnd: assets.length > 20,
      labels: {
        start: `First Daruma -- ${assetName(assets[0])}`,
        end: `Last Daruma -- ${assetName(assets.at(-1))}`,
      },
      pageText: assets.map((asset, index) => {
        return `${index + 1} - ${assetName(asset)}`;
      }),
      onTimeout: () => {
        interaction.deleteReply().catch(() => null);
      },
      // 60 Seconds in ms
      time: timeOut * 1000,
    }).send();
  } else {
    let darumaPage0 = darumaPages[0];
    if (!darumaPage0) {
      darumaPage0 = { content: 'Hmm our records seem to be empty!' };
    }
    await InteractionUtils.replyOrFollowUp(interaction, darumaPage0);
    setTimeout(() => {
      interaction.deleteReply().catch(() => null);
    }, timeOut * 1000);
  }
}
export async function flexDaruma(interaction: ButtonInteraction): Promise<void> {
  const assetId = interaction.customId.split('_')[1];
  const userAsset = await algoNFTAssetService.getAssetById(Number(assetId));
  let singleEmbed;
  if (userAsset) {
    const darumaEmbed = await darumaPagesEmbed(interaction, userAsset, undefined, true);
    // Check if the bot has permissions to send messages in the channel
    singleEmbed = darumaEmbed[0];
  }
  const sendEmbed = singleEmbed
    ? { embeds: singleEmbed.embeds ?? [] }
    : { content: 'Hmm our records seem to be empty!' };
  try {
    await interaction.channel?.send(sendEmbed);
  } catch {
    await InteractionUtils.replyOrFollowUp(
      interaction,
      'I do not have permissions to send messages in this channel!',
    );
  }
}
export async function registerPlayer(
  interaction: ButtonInteraction,
  games: IdtGames,
  randomDaruma?: AlgoNFTAsset,
): Promise<void> {
  const { channelId, customId } = interaction;
  const game = games.get(channelId);
  if (!game || game.state.status !== GameStatus.waitingRoom) {
    return;
  }
  const karmaAsset = game.settings.token.gameAsset;
  const caller = await InteractionUtils.getInteractionCaller(interaction);
  const callerId = caller.id as DiscordId;
  const assetId = randomDaruma ? randomDaruma._id.toString() : customId.split('_')[1] || '';
  const { maxCapacity } = game.settings;

  const gamePlayer = game.state.playerManager.getPlayer(callerId);

  const databaseUser = await userService.getUserByID(callerId);
  const userAsset = await algoNFTAssetService.getAssetById(Number(assetId));
  if (!userAsset) {
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: `You don't own this Daruma`,
    });
    return;
  }
  const ownerWallet = await algoNFTAssetService.getOwnerWalletFromAssetIndex(userAsset._id);
  const { optedIn } = await algorand.getTokenOptInStatus(ownerWallet, karmaAsset._id);
  if (!optedIn) {
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: `You need to opt-in to ${karmaAsset.name} asset ${karmaAsset._id} before you can register for the game. https://algoxnft.com/asset/${karmaAsset._id}`,
    });
    return;
  }
  //Check if user is another game
  if (isPlayerAssetRegisteredInGames(games, callerId, assetId)) {
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: `You can't register with the same asset in two games at a time`,
    });
    return;
  }

  // check again for capacity once added
  if (game.state.playerManager.getPlayerCount() >= maxCapacity && !gamePlayer) {
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: 'Sorry, the game is at capacity, please wait until the next round',
    });
    return;
  }

  // Finally, add player to game
  const newPlayer = new Player(databaseUser, userAsset, karmaAsset._id);
  await game.addPlayer(newPlayer);
  // Create a Message to notify play of their next cooldown
  const { darumaLength: remainingPlayableDaruma, nextDarumaMessage } =
    await getRemainingPlayableDarumaCountAndNextCoolDown(interaction, games);
  const remainingPlayableDarumaLengthMessage = `${
    remainingPlayableDaruma > 0 ? inlineCode(remainingPlayableDaruma.toLocaleString()) : 'No'
  } playable Darumas available for training after this round!!`;

  // Send a message to the channel
  await InteractionUtils.replyOrFollowUp(interaction, {
    content: `${assetName(
      userAsset,
    )} has entered the game.\n\n${remainingPlayableDarumaLengthMessage}${nextDarumaMessage}`,
  });
  setTimeout(() => {
    interaction.deleteReply().catch(() => null);
  }, 60_000);

  return;
}

export async function withdrawPlayer(
  interaction: ButtonInteraction,
  games: IdtGames,
): Promise<void> {
  const discordUser = interaction.user.id as DiscordId;
  const game = games.get(interaction.channelId);
  const gamePlayer = game?.state.playerManager.getPlayer(discordUser);
  if (!game || !gamePlayer) {
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: `You are not in the game`,
    });
    return;
  }
  await game.removePlayer(discordUser);
  await InteractionUtils.replyOrFollowUp(interaction, {
    content: `${assetName(gamePlayer.playableNFT)} has left the game`,
  });
}

export function assetName(asset: AlgoNFTAsset | IAlgoNFTAsset | undefined): string {
  if (!asset) {
    return '';
  }
  return asset.alias || asset.name;
}
export function walletButtonCreator(): ActionRowBuilder<ButtonBuilder> {
  const walletButton = new ButtonBuilder()
    .setCustomId('walletSetup')
    .setLabel('Setup Wallet')
    .setStyle(ButtonStyle.Primary);
  return new ActionRowBuilder<ButtonBuilder>().setComponents(walletButton);
}
export function optInButtonCreator(assetId: number, assetName: string): ButtonBuilder {
  return new ButtonBuilder()
    .setLabel(`Opt In -- ${assetName}`)
    .setStyle(ButtonStyle.Link)
    .setURL(`https://algoxnft.com/asset/${assetId}`);
}
const winningReasons = [
  'tired out the other Darumas!',
  'was the last one standing!',
  'was the only one still standing!',
  'was the only one left.',
  'was the last one left.',
  'was the last one standing.',
  'brought the heat!',
  'had the right moves!',
  'was the MVP!',
  'stole the show!',
  'was the top performer!',
  'ruled the arena!',
  'was untouchable!',
  'was a champion!',
  'was the real deal!',
  'had the edge!',
  'was on fire!',
  'was a true winner!',
  'left the competition in the dust!',
  'was the king of the ring!',
  'was a dominant force!',
  'was a powerhouse!',
  'had the game on lock!',
  'was the ultimate winner!',
  'dominated the competition!',
  'won with style!',
  'crushed the competition!',
  'emerged victorious!',
  'claimed the crown!',
  'triumphed over all!',
  'was the ultimate champion!',
  'was the top dog!',
  'reigned supreme!',
  'was the champion of champions!',
  'was the ultimate winner!',
  'was the survivor!',
  'was the sole survivor!',
  'was the winner by default!',
  'was the undisputed champion!',
  'was the final boss!',
  'was the grand champion!',
  'was the top of the food chain!',
  'was the conqueror!',
  'was the boss of bosses!',
];

const winningTitles = [
  'Champion',
  'Victor',
  'Winner',
  'Conqueror',
  'Triumphant',
  'Success',
  'Chievement',
  'Excel',
  'Prodigy',
  'Eminent',
  'Elite',
  'Genius',
  'Mighty',
  'Expert',
  'Guru',
  'Legend',
  'Icon',
  'Superstar',
  'Wizard',
  'Master',
  'Giant',
  'Hero',
  'Titan',
  'Gladiator',
  'Dominator',
  'Crusher',
  'Slayer',
  'Killer',
  'Bruiser',
  'Warrior',
  'Samurai',
  'Ninja',
  'Glory',
  'Majesty',
  'Splendor',
  'Glorious',
  'Radiant',
  'Resplendent',
  'Brilliant',
  'Shining',
  'Luminous',
  'Gleaming',
  'Resplendent',
  'Effulgent',
  'Illuminated',
  'Radiant',
  'Glimmering',
  'Glowing',
  'Dazzling',
  'Beaming',
  'Blazing',
];
