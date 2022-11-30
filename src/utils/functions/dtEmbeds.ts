import { Pagination, PaginationType } from '@discordx/pagination'
import { AlgoNFTAsset, AlgoWallet, User } from '@entities'
import { Database } from '@services'
import { Game, Player } from '@utils/classes'
import {
  emojiConvert,
  GameStatus,
  gameStatusHostedUrl,
  GameTypesNames,
  getAssetUrl,
  IdtGames,
  resolveDependency,
  resolveUser,
  waitingRoomInteractionIds,
} from '@utils/functions'
import {
  ActionRowBuilder,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
} from 'discord.js'

/**
 * Abstraction for building embeds
 * @param gameStatus {GameStatus}
 * @param game {Game}
 * @param options {any}
 * @returns
 */
export function doEmbed<T extends DarumaTrainingPlugin.EmbedOptions>(
  gameStatus: GameStatus,
  game: Game,
  data?: T
): BaseMessageOptions {
  game.status = GameStatus[gameStatus]
  const embed = new EmbedBuilder().setTitle(`Daruma-Games`).setColor('DarkAqua')
  const gameTypeTitle = GameTypesNames[game.settings.gameType]
  const playerArr = game.playerArray
  const playerCount = game.hasNpc ? playerArr.length - 1 : playerArr.length
  let components: any
  const playerArrFields = (
    playerArr: Player[]
  ): {
    name: string
    value: string
  }[] => {
    let playerPlaceholders = game.settings.maxCapacity
    let theFields = playerArr
      .map((player, index) => {
        const playerNum = emojiConvert((index + 1).toString())
        let embedMsg = [playerNum, `***${assetName(player.asset)}***`]
        if (!player.isNpc) embedMsg.push(`(${player.userName})`)
        playerPlaceholders--
        return {
          name: '\u200b',
          value: embedMsg.join(' - '),
        }
      })
      .filter(Boolean) as { name: string; value: string }[]
    if (playerPlaceholders > 0) {
      for (let i = 0; i < playerPlaceholders; i++) {
        theFields.push({
          name: '\u200b',
          value: `${emojiConvert(
            (playerCount + i + 2).toString()
          )} - ${getRandomElement(waitingRoomFun)}...`,
        })
      }
    }
    theFields.push({ name: '\u200b', value: '\u200b' })
    return theFields
  }

  switch (gameStatus) {
    case GameStatus.waitingRoom: {
      const setupButtons = () => {
        const buttons: ButtonBuilder[] = []
        buttons.push(
          new ButtonBuilder()
            .setCustomId(waitingRoomInteractionIds.selectPlayer)
            .setLabel(`Choose your Daruma`)
            .setStyle(ButtonStyle.Primary)
        )

        if (playerCount > 0) {
          buttons.push(
            new ButtonBuilder()
              .setCustomId(waitingRoomInteractionIds.withdrawPlayer)
              .setLabel(`Withdraw Daruma`)
              .setStyle(ButtonStyle.Danger)
          )
        }
        return buttons
      }
      embed
        .setTitle(`${gameTypeTitle} - Waiting Room`)
        .setImage(gameStatusHostedUrl(gameStatus, gameStatus))
        .setFooter({ text: `Last updated: ${new Date().toLocaleString()}` })
        .setFields(playerArrFields(playerArr))

      components = [
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          setupButtons()
        ),
      ]
      return { embeds: [embed], components }
    }
    case GameStatus.activeGame:
    case GameStatus.finished: {
      let titleMsg = `The Training has started!`
      let embedImage: string | null = gameStatusHostedUrl(
        game.settings.gameType,
        gameStatus.toString()
      )
      if (game.status !== GameStatus.activeGame) {
        titleMsg = 'The training has ended!'
        embedImage = null
      }

      embed
        .setTitle(titleMsg)
        .setFooter({ text: `Dojo Training Event #${game.encounterId}` })
        .setDescription(`${gameTypeTitle}`)
        .setFields(playerArrFields(playerArr))
        .setImage(embedImage)
      return { embeds: [embed], components: [] }
    }
    case GameStatus.win: {
      const player = data as Player
      let payoutFields = []
      embed
        .setDescription(
          `${assetName(player.asset)} ${getRandomElement(winningReasons)}`
        )
        .setImage(getAssetUrl(player.asset))

      if (game.gameWinInfo.zen) {
        embed
          .setThumbnail(gameStatusHostedUrl('zen', GameStatus.win))
          .setDescription(`${assetName(player.asset)} has achieved Zen!`)
          .setImage(getAssetUrl(player.asset, true))
      }
      if (!player.isNpc) {
        payoutFields.push(
          {
            name: 'Most Wins Rank',
            value: `${player.assetRank.toLocaleString()}/${
              game.assetRankings.length
            }`,
          },
          {
            name: 'Wins',
            value:
              player.asset.assetNote?.dojoTraining?.wins.toLocaleString() ??
              '0',
            inline: true,
          },
          {
            name: 'Losses',
            value:
              player.asset.assetNote?.dojoTraining?.losses.toLocaleString() ??
              '0',
            inline: true,
          },
          {
            name: 'Zen',
            value:
              player.asset.assetNote?.dojoTraining?.zen.toLocaleString() ?? '0',
            inline: true,
          },
          {
            name: 'Payout',
            value: `${game.gameWinInfo.payout.toLocaleString()} KARMA`,
          },
          {
            name: `${player.userName} -- (unclaimed) KARMA`,
            value: player.userClass.karma.toLocaleString(),
          }
        )
      }
      embed.setTitle(getRandomElement(winningTitles)).setFields(payoutFields)
      return { embeds: [embed], components: [] }
    }
  }
  return { embeds: [embed], components: [] }
}
export function darumaPagesEmbed(
  darumaIndex: AlgoNFTAsset[],
  darumas: { name: string; id: number; url: string }[]
): BaseMessageOptions[] {
  function selectButton(assetId: string) {
    const selectBtn = new ButtonBuilder()
      .setCustomId(`daruma-select_${assetId}`)
      .setLabel('Train!')
      .setStyle(ButtonStyle.Primary)

    return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      selectBtn
    )
  }
  const onCooldown = darumaIndex.length - darumas.length
  let whyMsg =
    'You need to register your Daruma wallet first!\n Type `/wallet` to get started.'
  if (onCooldown > 0) {
    whyMsg = `You have ${onCooldown} Daruma on cooldown.\n Or in another game!`
  }
  if (darumas.length === 0) {
    return [
      {
        embeds: [
          new EmbedBuilder()
            .setTitle('No Darumas available')
            .setDescription('Please try again later')
            .setFields([{ name: 'Why?', value: whyMsg }])
            .setColor('Red'),
        ],
        components: [],
      },
    ]
  } else {
    return darumas.map((daruma, index) => {
      return {
        embeds: [
          new EmbedBuilder()
            .setTitle(`Select your Daruma`)
            .setDescription(daruma.name)
            .setImage(daruma.url)
            .setColor('DarkAqua')
            .setFooter({ text: `Daruma ${index + 1}/${darumas.length}` }),
        ],
        components: [selectButton(daruma.id.toString())],
      }
    })
  }
}
function filteredAssets(
  darumaIndex: AlgoNFTAsset[],
  discordId: string,
  games: IdtGames
) {
  return darumaIndex
    .map((asset: AlgoNFTAsset) => {
      const assetCooldown = asset.assetNote?.coolDown ?? 0
      if (
        assetCooldown < Date.now() &&
        !checkIfRegisteredPlayer(games, discordId, asset.assetIndex.toString())
      ) {
        const label = assetName(asset)
        const normalizedLabel = label.slice(0, 20)
        return {
          name: normalizedLabel,
          id: asset.assetIndex,
          url: getAssetUrl(asset),
        }
      } else {
        return
      }
    })
    .filter(Boolean) as {
    name: string
    id: number
    url: string
  }[]
}
export async function selectPlayableAssets(
  interaction: ButtonInteraction,
  discordId: string,
  games: IdtGames
): Promise<void> {
  await interaction.deferReply({ ephemeral: true, fetchReply: true })
  const db = await resolveDependency(Database)
  const assets = await db.get(AlgoWallet).getPlayableAssets(discordId)
  const filteredDaruma = filteredAssets(assets, discordId, games)
  const darumaPages = darumaPagesEmbed(assets, filteredDaruma)
  if (darumaPages[0].components?.length !== 0) {
    await new Pagination(interaction, darumaPages, {
      type: PaginationType.SelectMenu,
      dispose: true,
      pageText: filteredDaruma.map((asset, index) => {
        return `${index + 1} - ${asset.name}`
      }),
      onTimeout: () => {
        interaction.deleteReply().catch(() => null)
      },
      // 10 Seconds in ms
      time: 10 * 1000,
    }).send()
  } else {
    await interaction.editReply(darumaPages[0])
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
  games: IdtGames
): Promise<void> {
  const discordUser = resolveUser(interaction)?.id ?? ' '
  const discordUsername = resolveUser(interaction)?.username ?? ' '

  const db = await resolveDependency(Database)
  const { channelId } = interaction
  const assetId = interaction.customId.split('_')[1]

  const game = games[channelId]
  if (game.status !== GameStatus.waitingRoom) return
  await interaction.deferReply({ ephemeral: true, fetchReply: true })

  const { maxCapacity } = game.settings

  const gamePlayer = game.getPlayer(discordUser)

  const dbUser = await db.get(User).getUserById(discordUser)
  const userAsset = await db
    .get(AlgoNFTAsset)
    .findOneOrFail({ assetIndex: Number(assetId) })

  //Check if user is another game
  if (checkIfRegisteredPlayer(games, discordUser, assetId)) {
    await interaction.editReply({
      content: `You can't register with the same asset in two games at a time`,
    })
    return
  }

  // Check for game capacity, allow already registered user to re-register
  // even if capacity is full
  if (game.playerCount < maxCapacity || gamePlayer) {
    // check again for capacity once added
    if (game.playerCount >= maxCapacity && !gamePlayer) {
      await interaction.editReply({
        content:
          'Sorry, the game is at capacity, please wait until the next round',
      })
      return
    }

    // Finally, add player to game
    const newPlayer = new Player(dbUser, discordUsername, userAsset)
    game.addPlayer(newPlayer)
    await interaction.followUp({
      content: `${assetName(userAsset)} has entered the game`,
    })
    await game.updateEmbed()
  } else {
    await interaction.editReply({
      content:
        'Sorry, the game is at capacity, please wait until the next round',
    })
    return
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
  games: IdtGames,
  discordUser: string,
  assetId: string
): boolean {
  const gameArray = Object.values(games)
  let gameCount = 0
  gameArray.forEach((game: Game) => {
    const player = game.getPlayer(discordUser)
    if (player?.asset.assetIndex === Number(assetId)) gameCount++
  })
  return gameCount >= 1
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
  games: IdtGames
): Promise<void> {
  const { channelId } = interaction
  const game = games[channelId]
  await interaction.deferReply({ ephemeral: true })
  const discordUser = resolveUser(interaction)?.id ?? ' '
  const gamePlayer = game.getPlayer(discordUser)
  if (!gamePlayer) {
    await interaction.editReply({ content: `You are not in the game` })
    return
  }
  game.removePlayer(discordUser)
  await interaction.editReply({
    content: `${assetName(gamePlayer.asset)} has left the game`,
  })
  await game.updateEmbed()
}

export function assetName(asset: AlgoNFTAsset): string {
  return asset.alias || asset.name
}
const getRandomElement = (arr: any[]) =>
  arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined

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
]

const winningReasons = [
  'tired out the other Darumas!',
  'was the last one standing!',
  'was the only one still standing!',
  'was the only one left.',
  'was the last one left.',
  'was the last one standing.',
]

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
]
