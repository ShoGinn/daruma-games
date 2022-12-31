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
import { container } from 'tsyringe';

import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.js';
import { AlgoStdAsset } from '../../entities/AlgoStdAsset.js';
import { AlgoStdToken } from '../../entities/AlgoStdToken.js';
import { AlgoWallet } from '../../entities/AlgoWallet.js';
import { User } from '../../entities/User.js';
import { GameStatus, GameTypesNames, waitingRoomInteractionIds } from '../../enums/dtEnums.js';
import { PropertyResolutionManager } from '../../model/framework/manager/PropertyResolutionManager.js';
import { TenorImageManager } from '../../model/framework/manager/TenorImage.js';
import { Game } from '../classes/dtGame.js';
import { Player } from '../classes/dtPlayer.js';
import { DiscordUtils, ObjectUtil } from '../Utils.js';
import { emojiConvert } from './dtEmojis.js';
import { gameStatusHostedUrl, getAssetUrl } from './dtImages.js';
import { assetCurrentRank } from './dtUtils.js';
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
    components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}> {
    game.status = GameStatus[gameStatus];
    const botVersion = propertyResolutionManager.getProperty('version');
    const embed = new EmbedBuilder().setTitle(`Daruma-Games`).setColor('DarkAqua');
    const gameTypeTitle = GameTypesNames[game.settings.gameType];
    const playerArr = game.playerArray;
    const playerCount = game.hasNpc ? playerArr.length - 1 : playerArr.length;
    let components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
    const playerArrFields = (
        playerArr: Player[]
    ): {
        name: string;
        value: string;
    }[] => {
        let playerPlaceholders = game.settings.maxCapacity;
        let theFields = playerArr
            .map((player, index) => {
                const playerNum = emojiConvert((index + 1).toString());
                let embedMsg = [playerNum, `***${assetName(player.asset)}***`];
                if (!player.isNpc) embedMsg.push(`(${player.userName})`);
                playerPlaceholders--;
                return {
                    name: '\u200b',
                    value: embedMsg.join(' - '),
                };
            })
            .filter(Boolean) as { name: string; value: string }[];
        if (playerPlaceholders > 0) {
            for (let i = 0; i < playerPlaceholders; i++) {
                theFields.push({
                    name: '\u200b',
                    value: `${emojiConvert(
                        (playerArr.length + i + 1).toString()
                    )} - ${ObjectUtil.getRandomElement(waitingRoomFun)}...`,
                });
            }
        }
        theFields.push({ name: '\u200b', value: '\u200b' });
        return theFields;
    };

    switch (gameStatus) {
        case GameStatus.waitingRoom: {
            const setupButtons = (): ButtonBuilder[] => {
                const buttons: ButtonBuilder[] = [];
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(waitingRoomInteractionIds.selectPlayer)
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
            let payoutFields = [];
            embed
                .setDescription(
                    `${assetName(player.asset)} ${ObjectUtil.getRandomElement(winningReasons)}`
                )
                .setImage(getAssetUrl(player.asset));

            if (game.gameWinInfo.zen) {
                embed
                    .setThumbnail(gameStatusHostedUrl('zen', GameStatus.win))
                    .setDescription(`${assetName(player.asset)} has achieved Zen!`)
                    .setImage(getAssetUrl(player.asset, true));
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
    darumas: AlgoNFTAsset[] | AlgoNFTAsset,
    darumaIndex?: AlgoNFTAsset[] | undefined,
    flex: boolean = false
): Promise<BaseMessageOptions[]> {
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

    if (darumaIndex) {
        embedTitle = 'Select your Daruma';
        embedDescription = 'Choose your Daruma to train with!';
        embedDarumaName = 'Name';
        btnName = 'select';
        btnLabel = 'Train!';
    }
    if (flex && !Array.isArray(darumas)) {
        let battleCry = darumas.assetNote?.battleCry || ' ';
        embedTitle = 'When you got it you got it!';
        embedDescription = battleCry;
        embedDarumaName = 'Name';
    }
    if (Array.isArray(darumas)) {
        if (darumas.length === 0) {
            let whyMsg =
                'You need to register your Daruma wallet first!\nType `/wallet` to get started.';
            if (darumaIndex) {
                const onCooldown = darumaIndex.length - darumas.length;
                if (onCooldown > 0) {
                    whyMsg = `You have ${onCooldown} Daruma unavailable :(`;
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
                    components: [],
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
                                    ...(await darumaStats(daruma)),
                                    ...parseTraits(daruma)
                                )
                                .setImage(getAssetUrl(daruma))
                                .setColor('DarkAqua')
                                .setFooter({ text: `Daruma ${index + 1}/${darumas.length}` }),
                        ],
                        components: [embedBtn(daruma.assetIndex.toString(), btnName, btnLabel)],
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
                            name: interaction.user.username + ' | ' + assetName(darumas),
                            iconURL: interaction.user.displayAvatarURL(),
                            url: `${algoExplorerURL}${darumas.assetIndex}`,
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
                        .setImage(getAssetUrl(darumas))
                        .setColor('DarkAqua'),
                ],
                components: [],
            },
        ];
    }
}

function parseTraits(asset: AlgoNFTAsset): { name: string; value: string; inline: boolean }[] {
    const traits = asset.arc69Meta?.properties;
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
    (
        | { name: string; value: string; inline?: undefined }
        | { name: string; value: `\`${string}\``; inline: boolean }
    )[]
> {
    const darumaRanking = await getAssetRankingForEmbed(asset);
    const fields = [
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
            value: inlineCode(asset.assetNote?.dojoTraining?.wins.toLocaleString() ?? '0'),
            inline: true,
        },
        {
            name: 'Losses',
            value: inlineCode(asset.assetNote?.dojoTraining?.losses.toLocaleString() ?? '0'),
            inline: true,
        },
        {
            name: 'Zen',
            value: inlineCode(asset.assetNote?.dojoTraining?.zen.toLocaleString() ?? '0'),
            inline: true,
        },
        {
            name: '\u200b',
            value: '\u200b',
        },
    ];
    return fields;
}
async function getAssetRankingForEmbed(asset: AlgoNFTAsset): Promise<string> {
    let { currentRank, totalAssets } = await assetCurrentRank(asset);
    let darumaRanking = `${currentRank}/${totalAssets}`;
    if (Number(currentRank) < 5) {
        switch (Number(currentRank)) {
            case 1:
                darumaRanking = `Number 1!!!\n🥇 ${darumaRanking} 🥇`;
                break;
            case 2:
                darumaRanking = `Number 2!\n🥈 ${darumaRanking} 🥈`;
                break;
            case 3:
                darumaRanking = `Number 3!\n🥉 ${darumaRanking} 🥉`;
                break;
            case 4:
            case 5:
                darumaRanking = `Number ${currentRank}!\n🏅 ${darumaRanking} 🏅`;
                break;
        }
    }
    return darumaRanking;
}
function filterCoolDownOrRegistered(
    darumaIndex: AlgoNFTAsset[],
    discordId: string,
    games: DarumaTrainingPlugin.IdtGames
): AlgoNFTAsset[] {
    let filteredAssets = darumaIndex.filter(
        daruma =>
            (daruma.assetNote?.coolDown ?? 0) < Date.now() &&
            !checkIfRegisteredPlayer(games, discordId, daruma.assetIndex.toString())
    );
    return filteredAssets;
}
export async function allDarumaStats(interaction: ButtonInteraction): Promise<void> {
    // get users playable assets
    const caller = InteractionUtils.getInteractionCaller(interaction);
    const db = container.resolve(MikroORM).em.fork();
    const userAssets = await db.getRepository(AlgoWallet).getPlayableAssets(interaction.user.id);
    const rankedAssets = await db.getRepository(AlgoNFTAsset).assetRankingByWinsTotalGames();
    // filter ranked assets to only include assets that are the same as assets in the users wallet

    const assets = rankedAssets.filter(rankedAsset =>
        userAssets.some(asset => rankedAsset.assetIndex === asset.assetIndex)
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
    for (let index = 0; index < assets.length; index++) {
        const element = assets[index];
        let assetRanking = await getAssetRankingForEmbed(element);

        let { wins, losses, zen } = element.assetNote?.dojoTraining ?? {
            wins: 0,
            losses: 0,
            zen: 0,
        };
        // convert wins, losses, and zen to locale string
        let winsString = inlineCode(wins.toLocaleString());
        let lossesString = inlineCode(losses.toLocaleString());
        let zenString = inlineCode(zen.toLocaleString());

        fields.push({
            name: assetName(element),
            value: `W/L: ${winsString}/${lossesString} | Zen: ${zenString} | Rank: ${inlineCode(
                assetRanking
            )}`,
        });
    }
    // split fields into 25 fields per embed
    const splitFields = ObjectUtil.chunkArray(fields, 25);
    const embeds: EmbedBuilder[] = [];
    for (let index = 0; index < splitFields.length; index++) {
        const element = splitFields[index];
        const embed = new EmbedBuilder(baseEmbed);
        embeds.push(embed.setFields(element));
    }
    // convert embeds to api embeds
    const embeded = embeds.map(embed => {
        return {
            embeds: [embed],
        };
    });
    await new Pagination(interaction, embeded, {
        type: PaginationType.SelectMenu,
        dispose: true,
        onTimeout: () => {
            interaction.deleteReply().catch(() => null);
        },
        // 60 Seconds in ms
        time: 60 * 1000,
    }).send();

    // // Max embeds is 10
    // if (embeds.length > 10) {
    //     // remove all but the first 10
    //     embeds.splice(10, embeds.length - 10);
    //     console.log('Too many embeds! Only the first 10 will be sent!');
    // }
    // return embeds;
}
export async function coolDownModified(player: Player): Promise<EmbedBuilder> {
    // convert the cooldown from ms to human readable
    const coolDown = ObjectUtil.timeToHuman(player.randomCoolDown);
    let modifiedCoolDownEmbed = new EmbedBuilder()
        .setTitle('🎲 Randomness is a fickle thing...')
        .setDescription(
            spoiler(`${assetName(player.asset)} found a special new cooldown of ${coolDown}.`)
        )
        .setColor('DarkButNotBlack')
        .setThumbnail(getAssetUrl(player.asset));
    return modifiedCoolDownEmbed;
}

export async function paginatedDarumaEmbed(
    interaction: ButtonInteraction | CommandInteraction,
    games?: DarumaTrainingPlugin.IdtGames | undefined
): Promise<void> {
    if (interaction instanceof ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true, fetchReply: true });
    }
    const db = container.resolve(MikroORM).em.fork();
    const assets = await db.getRepository(AlgoWallet).getPlayableAssets(interaction.user.id);
    if (games) {
        const filteredDaruma = filterCoolDownOrRegistered(assets, interaction.user.id, games);
        const darumaPages = await darumaPagesEmbed(interaction, filteredDaruma, assets);
        await paginateDaruma(interaction, darumaPages, filteredDaruma, 10);
        return;
    }
    const darumaPages = await darumaPagesEmbed(interaction, assets);
    await paginateDaruma(interaction, darumaPages, assets);
}

async function paginateDaruma(
    interaction: ButtonInteraction | CommandInteraction,
    darumaPages: BaseMessageOptions[],
    assets: AlgoNFTAsset[],
    timeOut: number = 60
): Promise<void> {
    if (darumaPages[0].components?.length !== 0) {
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
        await interaction.editReply(darumaPages[0]);
    }
}
export async function flexDaruma(interaction: ButtonInteraction): Promise<void> {
    const db = container.resolve(MikroORM).em.fork();
    const assetId = interaction.customId.split('_')[1];
    const userAsset = await db
        .getRepository(AlgoNFTAsset)
        .findOneOrFail({ assetIndex: Number(assetId) });
    const darumaEmbed = await darumaPagesEmbed(interaction, userAsset, undefined, true);
    // Check if the bot has permissions to send messages in the channel
    try {
        await interaction.reply('Flexing your Daruma!');
        await interaction.channel?.send(darumaEmbed[0]);
    } catch (error) {
        await interaction.editReply('I do not have permissions to send messages in this channel!');
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
    const caller = InteractionUtils.getInteractionCaller(interaction);

    const db = container.resolve(MikroORM).em.fork();
    const { channelId } = interaction;
    const assetId = interaction.customId.split('_')[1];

    const game = games[channelId];
    if (game.status !== GameStatus.waitingRoom) return;
    await interaction.deferReply({ ephemeral: true, fetchReply: true });

    const { maxCapacity } = game.settings;

    const gamePlayer = game.getPlayer(caller.id);

    const dbUser = await db.getRepository(User).getUserById(caller.id);
    const userAssetDb = db.getRepository(AlgoNFTAsset);
    const algoStdAsset = db.getRepository(AlgoStdAsset);
    const stdTokenDb = db.getRepository(AlgoStdToken);
    const userAsset = await userAssetDb.findOneOrFail({ assetIndex: Number(assetId) });
    const ownerWallet = await userAssetDb.getOwnerWalletFromAssetIndex(userAsset.assetIndex);
    const karmaAsset = await algoStdAsset.getStdAssetByUnitName('KRMA');
    const optedIn = await stdTokenDb.checkIfWalletWithAssetIsOptedIn(
        ownerWallet,
        karmaAsset.assetIndex
    );
    if (!optedIn) {
        await InteractionUtils.replyOrFollowUp(interaction, {
            content: `You need to opt-in to ${karmaAsset.name} asset ${karmaAsset.assetIndex} before you can register for the game. https://algoxnft.com/asset/${karmaAsset.assetIndex}`,
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

    // Check for game capacity, allow already registered user to re-register
    // even if capacity is full
    if (game.playerCount < maxCapacity || gamePlayer) {
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
        await game.updateEmbed();
    } else {
        await InteractionUtils.replyOrFollowUp(interaction, {
            content: 'Sorry, the game is at capacity, please wait until the next round',
        });
        return;
    }
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
    const gameArray = Object.values(games);
    let gameCount = 0;
    gameArray.forEach((game: Game) => {
        const player = game.getPlayer(discordUser);
        if (player?.asset.assetIndex === Number(assetId)) gameCount++;
    });
    return gameCount >= 1;
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
    const { channelId } = interaction;
    const game = games[channelId];
    await interaction.deferReply({ ephemeral: true });
    const discordUser = interaction.user.id;
    const gamePlayer = game.getPlayer(discordUser);
    if (!gamePlayer) {
        await interaction.editReply({ content: `You are not in the game` });
        return;
    }
    game.removePlayer(discordUser);
    await interaction.editReply({
        content: `${assetName(gamePlayer.asset)} has left the game`,
    });
    await game.updateEmbed();
}

export function assetName(asset: AlgoNFTAsset): string {
    return asset.alias || asset.name;
}
const waitingRoomFun = [
    'Meditating',
    'Sleeping',
    'Eating',
    'Playing',
    'Farming',
    'Gaming',
    'Drawing',
    'Painting',
    'Training',
];

const winningReasons = [
    'tired out the other Darumas!',
    'was the last one standing!',
    'was the only one still standing!',
    'was the only one left.',
    'was the last one left.',
    'was the last one standing.',
];

const winningTitles = [
    'Winner',
    'Champion',
    'Victor',
    'Unbeatable',
    'Invincible',
    'Unstoppable',
    'Indestructible',
    'Unbreakable',
    'Unyielding',
    'Unflinching',
    'Unrelenting',
    'Unfaltering',
    'Unwavering',
    'Unshakable',
    'Unshakeable',
];
