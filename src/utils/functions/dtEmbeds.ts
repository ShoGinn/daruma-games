import InteractionUtils = DiscordUtils.InteractionUtils;
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
    EmbedBuilder,
    inlineCode,
    MessageActionRowComponentBuilder,
    spoiler,
} from 'discord.js';
import { randomInt } from 'node:crypto';
import { container } from 'tsyringe';

import { emojiConvert } from './dtEmojis.js';
import { gameStatusHostedUrl, getAssetUrl } from './dtImages.js';
import { assetCurrentRank } from './dtUtils.js';
import logger from './LoggerFactory.js';
import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.entity.js';
import { AlgoStdToken } from '../../entities/AlgoStdToken.entity.js';
import { AlgoWallet } from '../../entities/AlgoWallet.entity.js';
import { User } from '../../entities/User.entity.js';
import { GameStatus, GameTypesNames, waitingRoomInteractionIds } from '../../enums/dtEnums.js';
import { PropertyResolutionManager } from '../../model/framework/manager/PropertyResolutionManager.js';
import { TenorImageManager } from '../../model/framework/manager/TenorImage.js';
import { GameAssets } from '../../model/logic/gameAssets.js';
import { Game } from '../classes/dtGame.js';
import { Player } from '../classes/dtPlayer.js';
import { DiscordUtils, ObjectUtil } from '../Utils.js';
const propertyResolutionManager = container.resolve(PropertyResolutionManager);
const tenorImageManager = container.resolve(TenorImageManager);
/**
 * Abstraction for building embeds
 * @param gameStatus {GameStatus}
 * @param game {Game}
 * @param options {any}
 * @returns
 */
export async function doEmbed<T extends DarumaTrainingPlugin.EmbedOptions>(
    gameStatus: GameStatus,
    game: Game,
    data?: T
): Promise<{
    embed: EmbedBuilder;
    components: Array<ActionRowBuilder<MessageActionRowComponentBuilder>>;
}> {
    game.status = GameStatus[gameStatus];
    const botVersion = propertyResolutionManager.getProperty('version');
    const embed = new EmbedBuilder().setTitle(`Daruma-Games`).setColor('DarkAqua');
    const gameTypeTitle = GameTypesNames[game.settings.gameType] || 'Unknown';
    const playerArr = game.playerArray;
    const playerCount = game.hasNpc ? playerArr.length - 1 : playerArr.length;
    let components: Array<ActionRowBuilder<MessageActionRowComponentBuilder>> = [];
    const playerArrFields = (
        playerArr: Array<Player>
    ): Array<{
        name: string;
        value: string;
    }> => {
        let playerPlaceholders = game.settings.maxCapacity;
        const theFields = playerArr
            .map((player, index) => {
                // add emoji checkbox if player.isWinner
                const gameFinished = GameStatus.finished === gameStatus;
                const winnerCheckBox = !gameFinished
                    ? ''
                    : player.isWinner
                    ? game.gameWinInfo.zen
                        ? '☯️✅'
                        : '✅'
                    : '❌';
                const playerNum = `${winnerCheckBox} ${emojiConvert((index + 1).toString())}`;
                const embedMsg = [playerNum, `***${assetName(player.asset)}***`];
                if (!player.isNpc) embedMsg.push(`(${player.userName})`);
                playerPlaceholders--;
                return {
                    name: '\u200b',
                    value: embedMsg.join(' - '),
                };
            })
            .filter(Boolean) as Array<{ name: string; value: string }>;
        if (playerPlaceholders > 0) {
            for (let i = 0; i < playerPlaceholders; i++) {
                theFields.push({
                    name: '\u200b',
                    value: `${emojiConvert((playerArr.length + i + 1).toString())} - ${spoiler(
                        'Waiting...'
                    )}`,
                });
            }
        }
        theFields.push({ name: '\u200b', value: '\u200b' });
        return theFields;
    };

    switch (gameStatus) {
        case GameStatus.waitingRoom: {
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
                .setFields(playerArrFields(playerArr));

            components = [
                new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                    setupButtons()
                ),
            ];
            break;
        }
        case GameStatus.activeGame:
        case GameStatus.finished: {
            let titleMsg = `The Training has started!`;
            let embedImage: string | null = gameStatusHostedUrl(
                game.settings.gameType,
                gameStatus.toString()
            );
            if (game.status !== GameStatus.activeGame) {
                titleMsg = 'The training has ended!';
                embedImage = null;
            }

            embed
                .setTitle(titleMsg)
                .setFooter({ text: `Dojo Training Event #${game.encounterId}` })
                .setDescription(`${gameTypeTitle}`)
                .setFields(playerArrFields(playerArr))
                .setImage(embedImage);
            break;
        }
        case GameStatus.win: {
            const player = data as Player;
            const payoutFields = [];
            embed
                .setDescription(
                    `${assetName(player.asset)} ${ObjectUtil.getRandomElement(winningReasons)}`
                )
                .setImage(await getAssetUrl(player.asset));

            if (game.gameWinInfo.zen) {
                embed
                    .setThumbnail(gameStatusHostedUrl('zen', GameStatus.win))
                    .setDescription(`${assetName(player.asset)} has achieved Zen!`)
                    .setImage(await getAssetUrl(player.asset, true));
            }
            if (!player.isNpc) {
                payoutFields.push(...(await darumaStats(player.asset)), {
                    name: 'Payout',
                    value: `${game.gameWinInfo.payout.toLocaleString()} KARMA`,
                });
                const claimKarmaName = `${player.userName} -- Claim your KARMA!`;
                const howToClaimKarma = `Use the command \`/karma claim\` to claim your KARMA`;
                // user karma rounded down to the nearest 100
                const userKarma = Math.floor(player.unclaimedTokens / 100) * 100;
                if (player.unclaimedTokens >= 500) {
                    payoutFields.push({
                        name: claimKarmaName,
                        value: `You have over ${userKarma.toLocaleString()} KARMA left unclaimed!\n\n${howToClaimKarma}`,
                    });
                }
            }
            embed.setTitle(ObjectUtil.getRandomElement(winningTitles)).setFields(payoutFields);
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
async function darumaPagesEmbed(
    interaction: CommandInteraction | ButtonInteraction,
    darumas: Array<AlgoNFTAsset> | AlgoNFTAsset,
    darumaIndex?: Array<AlgoNFTAsset> | undefined,
    flex: boolean = false,
    noButtons: boolean = false
): Promise<Array<BaseMessageOptions>> {
    function embedBtn(
        assetId: string,
        btnName: string,
        btnLabel: string
    ): ActionRowBuilder<MessageActionRowComponentBuilder> {
        const trainBtn = new ButtonBuilder()
            .setCustomId(`daruma-${btnName}_${assetId}`)
            .setLabel(btnLabel)
            .setStyle(ButtonStyle.Primary);
        const flexBtn = new ButtonBuilder()
            .setCustomId(`daruma-flex_${assetId}`)
            .setLabel('Flex your Daruma!')
            .setStyle(ButtonStyle.Secondary);
        const allStats = new ButtonBuilder()
            .setCustomId(`daruma-all-stats`)
            .setLabel('All Daruma Stats!')
            .setStyle(ButtonStyle.Success);

        return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            trainBtn,
            flexBtn,
            allStats
        );
    }
    let embedTitle = 'Empower your creativity!';
    let embedDescription = 'You can edit your Daruma with a custom name\nProfanity is discouraged.';
    let embedDarumaName = 'Current Name';
    let btnName = 'edit-alias';
    let btnLabel = 'Edit Custom Name!';
    if (noButtons) {
        embedTitle = 'Top Ranked Daruma';
        embedDescription = 'These Daruma are the best of the best!';
    }
    if (darumaIndex) {
        embedTitle = 'Select your Daruma';
        embedDescription = 'Choose your Daruma to train with!';
        embedDarumaName = 'Name';
        btnName = 'select';
        btnLabel = 'Train!';
    }
    if (flex && !Array.isArray(darumas)) {
        const battleCry = darumas.battleCry || ' ';
        embedTitle = 'When you got it you got it!';
        embedDescription = battleCry;
        embedDarumaName = 'Name';
    }
    if (Array.isArray(darumas)) {
        if (darumas.length === 0) {
            let whyMsg = 'You need to register your Daruma wallet first!';
            if (darumaIndex) {
                const onCooldown = darumaIndex.length - darumas.length;
                if (onCooldown > 0) {
                    whyMsg = `Your ${inlineCode(
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
                            .setFields([{ name: 'Why?', value: whyMsg }])
                            .setColor('Red')
                            .setImage(tenorUrl),
                    ],
                    components: [
                        ...(whyMsg.includes('register')
                            ? walletSetupButton()
                            : randomCoolDownOfferButton()),
                        ...showCoolDownsButton(),
                    ],
                },
            ];
        } else {
            return await Promise.all(
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
                            : [embedBtn(daruma.id.toString(), btnName, btnLabel)],
                    };
                })
            );
        }
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
    const walletBtn = new ButtonBuilder()
        .setCustomId('walletSetup')
        .setLabel('Setup Wallet')
        .setStyle(ButtonStyle.Primary);
    return [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(walletBtn)];
}
function parseTraits(asset: AlgoNFTAsset): Array<{ name: string; value: string; inline: boolean }> {
    const traits = asset.arc69?.properties;
    // If trait properties exist create array of fields
    if (traits) {
        return Object.keys(traits).map(trait => {
            return {
                name: trait.toString(),
                value: traits[trait].toString(),
                inline: true,
            };
        });
    }
    return [];
}
async function darumaStats(
    asset: AlgoNFTAsset
): Promise<
    Array<
        | { name: string; value: string; inline?: undefined }
        | { name: string; value: `\`${string}\``; inline: boolean }
    >
> {
    const darumaRanking = await getAssetRankingForEmbed(asset);
    return [
        {
            name: '\u200b',
            value: '\u200b',
        },
        {
            name: 'Daruma Ranking',
            value: inlineCode(darumaRanking),
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
            name: '\u200b',
            value: '\u200b',
        },
    ];
}
async function getAssetRankingForEmbed(asset: AlgoNFTAsset): Promise<string> {
    const { currentRank, totalAssets } = await assetCurrentRank(asset);
    const rankingIndex = parseInt(currentRank, 10) - 1;
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
    games: DarumaTrainingPlugin.IdtGames
): Array<AlgoNFTAsset> {
    return darumaIndex.filter(
        daruma =>
            daruma.dojoCoolDown < new Date() &&
            !checkIfRegisteredPlayer(games, discordId, daruma.id.toString())
    );
}
export async function allDarumaStats(interaction: ButtonInteraction): Promise<void> {
    // get users playable assets
    const caller = InteractionUtils.getInteractionCaller(interaction);
    const db = container.resolve(MikroORM).em.fork();
    const userAssets = await db.getRepository(AlgoWallet).getPlayableAssets(interaction.user.id);
    const rankedAssets = await db.getRepository(AlgoNFTAsset).assetRankingByWinsTotalGames();
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
    const splitFields = ObjectUtil.chunkArray(fields, 25);
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
        InteractionUtils.replyOrFollowUp(interaction, {
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
            InteractionUtils.replyOrFollowUp(interaction, {
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
                    player.asset
                )}\n\nNote: This is a random event and may not happen every time.`
            )
        )
        .setColor(color)
        .setThumbnail(await getAssetUrl(player.asset));
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
        .setStyle(ButtonStyle.Primary);

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
export async function paginatedDarumaEmbed(
    interaction: ButtonInteraction | CommandInteraction,
    games?: DarumaTrainingPlugin.IdtGames | undefined,
    assets?: Array<AlgoNFTAsset>
): Promise<void> {
    const db = container.resolve(MikroORM).em.fork();
    let noButtons = false;
    if (assets) {
        noButtons = true;
    } else {
        assets = await db.getRepository(AlgoWallet).getPlayableAssets(interaction.user.id);
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
        await InteractionUtils.replyOrFollowUp(interaction, darumaPages[0]);
        setTimeout(inx => inx.deleteReply(), timeOut * 1000, interaction);
    }
}
export async function flexDaruma(interaction: ButtonInteraction): Promise<void> {
    const db = container.resolve(MikroORM).em.fork();
    const assetId = interaction.customId.split('_')[1];
    const userAsset = await db.getRepository(AlgoNFTAsset).findOneOrFail({ id: Number(assetId) });
    const darumaEmbed = await darumaPagesEmbed(interaction, userAsset, undefined, true);
    // Check if the bot has permissions to send messages in the channel
    try {
        await interaction.channel?.send({ embeds: darumaEmbed[0].embeds });
    } catch (error) {
        await InteractionUtils.replyOrFollowUp(
            interaction,
            'I do not have permissions to send messages in this channel!'
        );
    }
}
/**
 * Add a new player to the game
 *
 * @export
 * @param {ButtonInteraction} interaction
 * @param {IdtGames} games
 * @returns {*}  {Promise<void>}
 */
export async function registerPlayer(
    interaction: ButtonInteraction,
    games: DarumaTrainingPlugin.IdtGames
): Promise<void> {
    const { channelId } = interaction;
    const game = games[channelId];
    if (game.status !== GameStatus.waitingRoom) return;

    const caller = InteractionUtils.getInteractionCaller(interaction);
    const assetId = interaction.customId.split('_')[1];

    const { maxCapacity } = game.settings;

    const gamePlayer = game.getPlayer(caller.id);

    const db = container.resolve(MikroORM).em.fork();
    const dbUser = await db.getRepository(User).getUserById(caller.id);
    const userAssetDb = db.getRepository(AlgoNFTAsset);
    const stdTokenDb = db.getRepository(AlgoStdToken);
    const userAsset = await userAssetDb.findOneOrFail({ id: Number(assetId) });
    const ownerWallet = await userAssetDb.getOwnerWalletFromAssetIndex(userAsset.id);
    const gameAssets = container.resolve(GameAssets);
    const karmaAsset = gameAssets.karmaAsset;
    if (!karmaAsset) throw new Error('Karma Asset Not Found');

    const optedIn = await stdTokenDb.checkIfWalletWithAssetIsOptedIn(ownerWallet, karmaAsset.id);
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
    if (game.playerCount >= maxCapacity && !gamePlayer) {
        await InteractionUtils.replyOrFollowUp(interaction, {
            content: 'Sorry, the game is at capacity, please wait until the next round',
        });
        return;
    }

    // Finally, add player to game
    const newPlayer = new Player(dbUser, caller.user.username, userAsset);
    game.addPlayer(newPlayer);
    await InteractionUtils.replyOrFollowUp(interaction, {
        content: `${assetName(userAsset)} has entered the game`,
    });
    setTimeout(inx => inx.deleteReply(), 60_000, interaction);

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
function checkIfRegisteredPlayer(
    games: DarumaTrainingPlugin.IdtGames,
    discordUser: string,
    assetId: string
): boolean {
    return Object.values(games).some(game => {
        const player = game.getPlayer(discordUser);
        return player?.asset.id === Number(assetId);
    });
}

/**
 * Withdraws the player's asset from the game
 *
 * @export
 * @param {ButtonInteraction} interaction
 * @param {IdtGames} games
 * @returns {*}  {Promise<void>}
 */
export async function withdrawPlayer(
    interaction: ButtonInteraction,
    games: DarumaTrainingPlugin.IdtGames
): Promise<void> {
    const discordUser = interaction.user.id;
    const game = games[interaction.channelId];
    const gamePlayer = game?.getPlayer(discordUser);
    if (!gamePlayer) {
        await InteractionUtils.replyOrFollowUp(interaction, { content: `You are not in the game` });
        return;
    }
    game.removePlayer(discordUser);
    await InteractionUtils.replyOrFollowUp(interaction, {
        content: `${assetName(gamePlayer.asset)} has left the game`,
    });
    await game.updateEmbed();
}

export function assetName(asset: AlgoNFTAsset): string {
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
