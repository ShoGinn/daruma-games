import type { EmbedOptions, IdtGames } from '../../model/types/daruma-training.js';
import { Pagination, PaginationType } from '@discordx/pagination';
import { MikroORM } from '@mikro-orm/core';
import {
    ActionRowBuilder,
    APIEmbed,
    APIEmbedField,
    BaseMessageOptions,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CommandInteraction,
    User as DiscordUser,
    EmbedBuilder,
    inlineCode,
    MessageActionRowComponentBuilder,
    spoiler,
} from 'discord.js';
import { Client } from 'discordx';
import chunk from 'lodash/chunk.js';
import sample from 'lodash/sample.js';
import { randomInt } from 'node:crypto';
import { container } from 'tsyringe';

import { emojiConvert } from './dt-emojis.js';
import { gameStatusHostedUrl, getAssetUrl } from './dt-images.js';
import { assetCurrentRank } from './dt-utils.js';
import logger from './logger-factory.js';
import { AlgoNFTAsset } from '../../entities/algo-nft-asset.entity.js';
import { AlgoStdToken } from '../../entities/algo-std-token.entity.js';
import { AlgoWallet } from '../../entities/algo-wallet.entity.js';
import { User } from '../../entities/user.entity.js';
import {
    GameStatus,
    GameTypesNames,
    waitingRoomInteractionIds,
} from '../../enums/daruma-training.js';
import { PropertyResolutionManager } from '../../model/framework/manager/property-resolution-manager.js';
import { TenorImageManager } from '../../model/framework/manager/tenor-image.js';
import { GameAssets } from '../../model/logic/game-assets.js';
import { Game } from '../classes/dt-game.js';
import { Player } from '../classes/dt-player.js';
import { InteractionUtils, ObjectUtil } from '../utils.js';
const propertyResolutionManager = container.resolve(PropertyResolutionManager);
const tenorImageManager = container.resolve(TenorImageManager);
const client = container.resolve(Client);
async function getUserMention(userId: string): Promise<string> {
    try {
        const user: DiscordUser = await client.users.fetch(userId);
        return `${user.username}`;
    } catch (error) {
        logger.error(`Error getting user mention for ID ${userId}: ${JSON.stringify(error)}`);
        return `<@${userId}>`;
    }
}

/**
 * Get the embed for the game status.
 *
 * @template T
 * @param {GameStatus} gameStatus
 * @param {Game} game
 * @param {T} [data]
 * @returns {*}  {Promise<{
 *     embed: EmbedBuilder;
 *     components: Array<ActionRowBuilder<MessageActionRowComponentBuilder>>;
 * }>}
 */
export async function doEmbed<T extends EmbedOptions>(
    gameStatus: GameStatus,
    game: Game,
    data?: T
): Promise<{
    embed: EmbedBuilder;
    components: Array<ActionRowBuilder<MessageActionRowComponentBuilder>>;
}> {
    game.status = GameStatus[gameStatus];
    const botVersion = propertyResolutionManager.getProperty('version') as string;
    const embed = new EmbedBuilder().setTitle(`Daruma-Games`).setColor('DarkAqua');
    const gameTypeTitle = GameTypesNames[game.settings.gameType] || 'Unknown';
    const playerArray = game.players;
    const playerCount = game.getNPC ? playerArray.length - 1 : playerArray.length;
    let components: Array<ActionRowBuilder<MessageActionRowComponentBuilder>> = [];
    const playerArrayFields = async (
        playerArray_: Array<Player>
    ): Promise<Array<{ name: string; value: string }>> => {
        let playerPlaceholders = game.settings.maxCapacity;
        const fieldPromises = playerArray_.map(async (player, index) => {
            const userMention = player.isNpc ? 'NPC' : await getUserMention(player.dbUser.id);
            const gameFinished = GameStatus.finished === gameStatus;
            const winnerCheckBox = gameFinished
                ? player.isWinner
                    ? game.gameWinInfo.zen
                        ? '☯️✅'
                        : '✅'
                    : '❌'
                : '';
            const playerNumber = `${winnerCheckBox} ${emojiConvert((index + 1).toString())}`;
            const embedMessage = [
                playerNumber,
                `***${assetName(player.playableNFT)}***`,
                `(${userMention})`,
            ];
            playerPlaceholders--;
            return {
                name: '\u200B',
                value: embedMessage.join(' - '),
            };
        });
        const theFields = await Promise.all(fieldPromises);
        if (playerPlaceholders > 0) {
            for (let index = 0; index < playerPlaceholders; index++) {
                theFields.push({
                    name: '\u200B',
                    value: `${emojiConvert(
                        (playerArray_.length + index + 1).toString()
                    )} - ${spoiler('Waiting...')}`,
                });
            }
        }
        theFields.push({ name: '\u200B', value: '\u200B' });
        return theFields;
    };

    switch (gameStatus) {
        case GameStatus.waitingRoom: {
            const quickJoin = (): Array<ButtonBuilder> => {
                const buttons: Array<ButtonBuilder> = [];
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(waitingRoomInteractionIds.quickJoin)
                        .setLabel(`Quick Join`)
                        .setStyle(ButtonStyle.Success)
                );
                return buttons;
            };
            const setupButtons = (): Array<ButtonBuilder> => {
                const buttons: Array<ButtonBuilder> = [];
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(waitingRoomInteractionIds.registerPlayer)
                        .setLabel(`Choose your Daruma`)
                        .setStyle(ButtonStyle.Primary)
                );

                if (playerCount > 0) {
                    buttons.push(
                        new ButtonBuilder()
                            .setCustomId(waitingRoomInteractionIds.withdrawPlayer)
                            .setLabel(`Withdraw Daruma`)
                            .setStyle(ButtonStyle.Danger)
                    );
                }
                return buttons;
            };
            embed
                .setTitle(`${gameTypeTitle} - Waiting Room`)
                .setImage(gameStatusHostedUrl(gameStatus, gameStatus))
                .setFooter({ text: `v${botVersion}` })
                .setTimestamp()
                .setFields(await playerArrayFields(playerArray));

            components = [
                new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                    setupButtons()
                ),
                new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(quickJoin()),
            ];
            break;
        }
        case GameStatus.activeGame:
        case GameStatus.finished: {
            let titleMessage = `The Training has started!`;
            let embedImage: string | null = gameStatusHostedUrl(
                game.settings.gameType,
                gameStatus.toString()
            );
            if (game.status !== GameStatus.activeGame) {
                titleMessage = 'The training has ended!';
                embedImage = null;
            }

            embed
                .setTitle(titleMessage)
                .setFooter({ text: `Dojo Training Event #${game.encounterId ?? 'unk'}` })
                .setDescription(`${gameTypeTitle}`)
                .setFields(await playerArrayFields(playerArray))
                .setImage(embedImage);
            break;
        }
        case GameStatus.win: {
            const player = data as Player;
            const payoutFields = [];
            const sampledWinningTitles = sample(winningTitles) || '';
            const sampledWinningReasons = sample(winningReasons) || '';
            embed
                .setDescription(`${assetName(player.playableNFT)} ${sampledWinningReasons}`)
                .setImage(await getAssetUrl(player.playableNFT));

            if (game.gameWinInfo.zen) {
                embed
                    .setThumbnail(gameStatusHostedUrl('zen', GameStatus.win))
                    .setDescription(`${assetName(player.playableNFT)} has achieved Zen!`)
                    .setImage(await getAssetUrl(player.playableNFT, true));
            }
            if (!player.isNpc) {
                payoutFields.push(...(await darumaStats(player.playableNFT)), {
                    name: 'Payout',
                    value: `${game.gameWinInfo.payout.toLocaleString()} KARMA`,
                });
            }
            embed.setTitle(sampledWinningTitles).setFields(payoutFields);
            break;
        }
        case GameStatus.maintenance: {
            const tenorUrl = await tenorImageManager.fetchRandomTenorGif('maintenance');
            embed
                .setTitle('Maintenance')
                .setColor('#ff0000')
                .setFooter({ text: `v${botVersion}` })
                .setTimestamp()
                .setDescription(
                    `The Dojo is currently undergoing maintenance. Please check back later.\n\nIf you have any questions, please contact the Dojo staff.\n\nThank you for your patience.`
                )
                .setImage(tenorUrl);
            break;
        }
    }
    return { embed, components };
}
async function coolDownCheckEmbed(
    filteredDaruma: AlgoNFTAsset[],
    allDarumas: AlgoNFTAsset[] | undefined
): Promise<Array<BaseMessageOptions> | undefined> {
    if (filteredDaruma.length === 0) {
        let whyMessage = 'You need to register your Daruma wallet first!';
        if (allDarumas) {
            const onCooldown = allDarumas.length - filteredDaruma.length;
            if (onCooldown > 0) {
                whyMessage = `Your ${inlineCode(
                    onCooldown.toLocaleString()
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
                    ...(whyMessage.includes('register')
                        ? walletSetupButton()
                        : randomCoolDownOfferButton()),
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
    buttonLabel: string
): ActionRowBuilder<MessageActionRowComponentBuilder> {
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

    return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        trainButton,
        flexButton,
        allStats
    );
}

async function darumaPagesEmbed(
    interaction: CommandInteraction | ButtonInteraction,
    darumas: Array<AlgoNFTAsset> | AlgoNFTAsset,
    darumaIndex?: Array<AlgoNFTAsset> | undefined,
    flex: boolean = false,
    noButtons: boolean = false
): Promise<Array<BaseMessageOptions>> {
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
                                    ...parseTraits(daruma)
                                )
                                .setImage(await getAssetUrl(daruma))
                                .setColor('DarkAqua')
                                .setFooter({ text: `Daruma ${index + 1}/${darumas.length}` }),
                        ],
                        components: noButtons
                            ? []
                            : [embedButton(daruma.id.toString(), buttonName, buttonLabel)],
                    };
                })
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
                            url: `${algoExplorerURL}${darumas.id}`,
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
                            ...parseTraits(darumas)
                        )
                        .setImage(await getAssetUrl(darumas))
                        .setColor('DarkAqua'),
                ],
                components: [],
            },
        ];
    }
}
function walletSetupButton(): Array<ActionRowBuilder<MessageActionRowComponentBuilder>> {
    const walletButton = new ButtonBuilder()
        .setCustomId('walletSetup')
        .setLabel('Setup Wallet')
        .setStyle(ButtonStyle.Primary);
    return [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(walletButton)];
}
function parseTraits(asset: AlgoNFTAsset): Array<{ name: string; value: string; inline: boolean }> {
    const traits = asset.arc69?.properties;
    // If trait properties exist create array of fields
    if (traits) {
        return Object.keys(traits).map(trait => {
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
async function darumaStats(
    asset: AlgoNFTAsset
): Promise<Array<{ name: string; value: string; inline: boolean }>> {
    const darumaRanking = await getAssetRankingForEmbed(asset);
    return [
        {
            name: '\u200B',
            value: '\u200B',
            inline: true,
        },
        {
            name: 'Daruma Ranking',
            value: inlineCode(darumaRanking),
            inline: true,
        },
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
            name: '\u200B',
            value: '\u200B',
            inline: true,
        },
    ];
}
async function getAssetRankingForEmbed(asset: AlgoNFTAsset): Promise<string> {
    const { currentRank, totalAssets } = await assetCurrentRank(asset);
    const rankingIndex = Number.parseInt(currentRank, 10) - 1;
    const rankingMessages = [
        'Number 1!!!\n🥇',
        'Number 2!\n🥈',
        'Number 3!\n🥉',
        'Number 4!\n🏅',
        'Number 5!\n🏅',
    ];
    const message = rankingMessages[rankingIndex] || '';
    return `${message}${message ? ' ' : ''}${currentRank}/${totalAssets}`;
}
function filterCoolDownOrRegistered(
    darumaIndex: Array<AlgoNFTAsset>,
    discordId: string,
    games: IdtGames
): Array<AlgoNFTAsset> {
    return darumaIndex.filter(
        daruma =>
            daruma.dojoCoolDown < new Date() &&
            !checkIfRegisteredPlayer(games, discordId, daruma.id.toString())
    );
}
function filterNotCooledDownOrRegistered(
    darumaIndex: Array<AlgoNFTAsset>,
    discordId: string,
    games: IdtGames
): Array<AlgoNFTAsset> {
    return darumaIndex.filter(
        daruma =>
            daruma.dojoCoolDown > new Date() &&
            !checkIfRegisteredPlayer(games, discordId, daruma.id.toString())
    );
}

export async function allDarumaStats(interaction: ButtonInteraction): Promise<void> {
    // get users playable assets
    const caller = await InteractionUtils.getInteractionCaller(interaction);
    const database = container.resolve(MikroORM).em.fork();
    const userAssets = await database
        .getRepository(AlgoWallet)
        .getPlayableAssets(interaction.user.id);
    const rankedAssets = await database.getRepository(AlgoNFTAsset).assetRankingByWinsTotalGames();
    // filter ranked assets to only include assets that are the same as assets in the users wallet

    const assets = rankedAssets.filter(rankedAsset =>
        userAssets.some(asset => rankedAsset.id === asset.id)
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

    const fields: Array<APIEmbedField> = [];
    for (const element of assets) {
        const assetRanking = await getAssetRankingForEmbed(element);

        // convert wins, losses, and zen to locale string
        const winsString = inlineCode(element.dojoWins.toLocaleString());
        const lossesString = inlineCode(element.dojoLosses.toLocaleString());
        const zenString = inlineCode(element.dojoZen.toLocaleString());

        fields.push({
            name: assetName(element),
            value: `W/L: ${winsString}/${lossesString} | Zen: ${zenString} | Rank: ${inlineCode(
                assetRanking
            )}`,
        });
    }
    // split fields into 25 fields per embed
    const splitFields = chunk(fields, 25);
    const embeds: Array<EmbedBuilder> = [];
    for (const element of splitFields) {
        const embed = new EmbedBuilder(baseEmbed);
        embeds.push(embed.setFields(element));
    }
    // convert embeds to api embeds
    const embeded = embeds.map(embed => {
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
            logger.error(
                `${interaction.user.username} (${interaction.user.id}) ran into an error!`
            );
            logger.error(error.stack);
        }
    }
}
export async function coolDownModified(player: Player, orgCoolDown: number): Promise<EmbedBuilder> {
    // convert the cooldown from ms to human readable
    const coolDown = ObjectUtil.timeToHuman(player.randomCoolDown);
    // if player.RandomCoolDown is higher than its bad
    const badDay = player.randomCoolDown > orgCoolDown;
    // If badDay set color to red otherwise set color to green
    const color = badDay ? 'Red' : 'Green';
    // make message to say increased or decreased
    const newCoolDownMessage = badDay
        ? `Increased Cool Down this time to ${coolDown}.`
        : `Decreased Cool Down this time to ${coolDown}.`;
    return new EmbedBuilder()
        .setDescription(
            spoiler(
                `${newCoolDownMessage} for ${assetName(
                    player.playableNFT
                )}\n\nNote: This is a random event and may not happen every time.`
            )
        )
        .setColor(color)
        .setThumbnail(await getAssetUrl(player.playableNFT));
}
function randomCoolDownOfferButton(): Array<ActionRowBuilder<MessageActionRowComponentBuilder>> {
    // Return a button with a 1 in 3 chance otherwise return undefined
    const random = randomInt(1, 3);
    if (random !== 1) {
        return [];
    }

    const randomOffer = new ButtonBuilder()
        .setCustomId(`randomCoolDownOffer`)
        .setLabel('A Shady Offer')
        .setStyle(ButtonStyle.Secondary);

    const randomOfferButton =
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(randomOffer);
    return [randomOfferButton];
}
function showCoolDownsButton(): Array<ActionRowBuilder<MessageActionRowComponentBuilder>> {
    const showCoolDowns = new ButtonBuilder()
        .setCustomId(`showCoolDowns`)
        .setLabel('Show Cool Downs')
        .setStyle(ButtonStyle.Primary);

    const showCoolDownsButton =
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(showCoolDowns);
    return [showCoolDownsButton];
}
export async function quickJoinDaruma(
    interaction: ButtonInteraction,
    games: IdtGames
): Promise<void> {
    const database = container.resolve(MikroORM).em.fork();

    const allAssets = await database
        .getRepository(AlgoWallet)
        .getPlayableAssets(interaction.user.id);
    const filteredDaruma = filterCoolDownOrRegistered(allAssets, interaction.user.id, games);
    const randomDaruma = sample(filteredDaruma);
    const coolDownCheck = await coolDownCheckEmbed(filteredDaruma, allAssets);
    if (coolDownCheck && coolDownCheck[0]) {
        await InteractionUtils.replyOrFollowUp(interaction, coolDownCheck[0]);
    } else {
        if (!randomDaruma) {
            await InteractionUtils.replyOrFollowUp(interaction, {
                content: 'Hmm our records seem to be empty!',
            });
            return;
        }
        await registerPlayer(interaction, games, randomDaruma);
    }

    return;
}

export async function paginatedDarumaEmbed(
    interaction: ButtonInteraction | CommandInteraction,
    games?: IdtGames | undefined,
    assets?: Array<AlgoNFTAsset>
): Promise<void> {
    const database = container.resolve(MikroORM).em.fork();
    let noButtons = false;
    if (assets) {
        noButtons = true;
    } else {
        assets = await database.getRepository(AlgoWallet).getPlayableAssets(interaction.user.id);
    }
    if (games) {
        const filteredDaruma = filterCoolDownOrRegistered(assets, interaction.user.id, games);
        const darumaPages = await darumaPagesEmbed(interaction, filteredDaruma, assets);
        await paginateDaruma(interaction, darumaPages, filteredDaruma, 10);
        return;
    }
    const darumaPages = await darumaPagesEmbed(interaction, assets, undefined, false, noButtons);
    await paginateDaruma(interaction, darumaPages, assets);
}
async function getRemainingPlayableDarumaCountAndNextCoolDown(
    interaction: ButtonInteraction | CommandInteraction,
    games: IdtGames
): Promise<{ darumaLength: number; nextDarumaMessage: string }> {
    const database = container.resolve(MikroORM).em.fork();
    const allAssets = await database
        .getRepository(AlgoWallet)
        .getPlayableAssets(interaction.user.id);
    // Get all the Assets in cooldown or in a game
    const assetsInCoolDown = filterNotCooledDownOrRegistered(allAssets, interaction.user.id, games);
    // Get all the Assets not in cooldown or in a game
    const filteredDaruma = filterCoolDownOrRegistered(allAssets, interaction.user.id, games);
    let nextDarumaCoolDown = 0;
    let nextDarumaCoolDownMessage = '';
    const remainingDarumaLength = filteredDaruma.length;
    // Sort the assets by Date() and use GetTime() and sort them by the soonest cool down
    assetsInCoolDown.sort((a, b) => a.dojoCoolDown.getTime() - b.dojoCoolDown.getTime());

    if (remainingDarumaLength === 0 && assetsInCoolDown.length > 0) {
        const nextDaruma = assetsInCoolDown[0];
        nextDarumaCoolDown = nextDaruma?.dojoCoolDown.getTime() || 0;
        nextDarumaCoolDownMessage = `\nYour next Daruma (${assetName(
            nextDaruma
        )}) will be available ${ObjectUtil.timeFromNow(nextDarumaCoolDown)}`;
    }
    return { darumaLength: remainingDarumaLength, nextDarumaMessage: nextDarumaCoolDownMessage };
}
async function paginateDaruma(
    interaction: ButtonInteraction | CommandInteraction,
    darumaPages: Array<BaseMessageOptions>,
    assets: Array<AlgoNFTAsset>,
    timeOut: number = 60
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
    const database = container.resolve(MikroORM).em.fork();
    const assetId = interaction.customId.split('_')[1];
    const userAsset = await database
        .getRepository(AlgoNFTAsset)
        .findOneOrFail({ id: Number(assetId) });
    const darumaEmbed = await darumaPagesEmbed(interaction, userAsset, undefined, true);
    // Check if the bot has permissions to send messages in the channel
    const singleEmbed = darumaEmbed[0];

    const sendEmbed = singleEmbed
        ? { embeds: singleEmbed.embeds ?? [] }
        : { content: 'Hmm our records seem to be empty!' };
    try {
        await interaction.channel?.send(sendEmbed);
    } catch {
        await InteractionUtils.replyOrFollowUp(
            interaction,
            'I do not have permissions to send messages in this channel!'
        );
    }
}
/**
 * Register a player to a game
 *
 * @param {ButtonInteraction} interaction
 * @param {IdtGames} games
 * @param {AlgoNFTAsset} [randomDaruma]
 * @returns {*}  {Promise<void>}
 */
export async function registerPlayer(
    interaction: ButtonInteraction,
    games: IdtGames,
    randomDaruma?: AlgoNFTAsset
): Promise<void> {
    const { channelId, customId } = interaction;
    const game = games[channelId];
    if (!game || game.status !== GameStatus.waitingRoom) {
        return;
    }

    const caller = await InteractionUtils.getInteractionCaller(interaction);
    const assetId = randomDaruma ? randomDaruma.id.toString() : customId.split('_')[1] || '';
    const { maxCapacity } = game.settings;

    const gamePlayer = game.getPlayer(caller.id);

    const database = container.resolve(MikroORM).em.fork();
    const databaseUser = await database.getRepository(User).getUserById(caller.id);
    const userAssetDatabase = database.getRepository(AlgoNFTAsset);
    const stdTokenDatabase = database.getRepository(AlgoStdToken);
    const userAsset = await userAssetDatabase.findOneOrFail({ id: Number(assetId) });
    const ownerWallet = await userAssetDatabase.getOwnerWalletFromAssetIndex(userAsset.id);
    const gameAssets = container.resolve(GameAssets);
    const { karmaAsset } = gameAssets;
    if (!karmaAsset) {
        throw new Error('Karma Asset Not Found');
    }

    const optedIn = await stdTokenDatabase.isWalletWithAssetOptedIn(ownerWallet, karmaAsset.id);
    if (!optedIn) {
        await InteractionUtils.replyOrFollowUp(interaction, {
            content: `You need to opt-in to ${karmaAsset.name} asset ${karmaAsset.id} before you can register for the game. https://algoxnft.com/asset/${karmaAsset.id}`,
        });
        return;
    }
    //Check if user is another game
    if (checkIfRegisteredPlayer(games, caller.id, assetId)) {
        await InteractionUtils.replyOrFollowUp(interaction, {
            content: `You can't register with the same asset in two games at a time`,
        });
        return;
    }

    // check again for capacity once added
    if (game.players.length >= maxCapacity && !gamePlayer) {
        await InteractionUtils.replyOrFollowUp(interaction, {
            content: 'Sorry, the game is at capacity, please wait until the next round',
        });
        return;
    }

    // Finally, add player to game
    const newPlayer = new Player(databaseUser, userAsset);
    game.addPlayer(newPlayer);
    // Create a Message to notify play of their next cooldown
    const { darumaLength: remainingPlayableDaruma, nextDarumaMessage } =
        await getRemainingPlayableDarumaCountAndNextCoolDown(interaction, games);
    const remainingPlayableDarumaLengthMessage = `${
        remainingPlayableDaruma > 0 ? inlineCode(remainingPlayableDaruma.toLocaleString()) : 'No'
    } playable Darumas available for training after this round!!`;

    // Send a message to the channel
    await InteractionUtils.replyOrFollowUp(interaction, {
        content: `${assetName(
            userAsset
        )} has entered the game.\n\n${remainingPlayableDarumaLengthMessage}${nextDarumaMessage}`,
    });
    setTimeout(() => {
        interaction.deleteReply().catch(() => null);
    }, 60_000);

    await game.updateEmbed();
    return;
}

/**
 * Check if user is already registered in another game
 *
 * @param {IdtGames} games
 * @param {string} discordUser
 * @param {string} assetId
 * @returns {*}  {boolean}
 */
function checkIfRegisteredPlayer(games: IdtGames, discordUser: string, assetId: string): boolean {
    return Object.values(games).some(game => {
        const player = game.getPlayer(discordUser);
        return player?.playableNFT.id === Number(assetId);
    });
}

/**
 * Withdraws the player's asset from the game
 *

 * @param {ButtonInteraction} interaction
 * @param {IdtGames} games
 * @returns {*}  {Promise<void>}
 */
export async function withdrawPlayer(
    interaction: ButtonInteraction,
    games: IdtGames
): Promise<void> {
    const discordUser = interaction.user.id;
    const game = games[interaction.channelId];
    const gamePlayer = game?.getPlayer(discordUser);
    if (!game || !gamePlayer) {
        await InteractionUtils.replyOrFollowUp(interaction, { content: `You are not in the game` });
        return;
    }
    game.removePlayer(discordUser);
    await InteractionUtils.replyOrFollowUp(interaction, {
        content: `${assetName(gamePlayer.playableNFT)} has left the game`,
    });
    await game.updateEmbed();
}

export function assetName(asset: AlgoNFTAsset | undefined): string {
    if (!asset) {
        return '';
    }
    return asset.alias || asset.name;
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
