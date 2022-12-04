import {
  ButtonComponent,
  ContextMenu,
  Discord,
  Slash,
  SlashGroup,
  SlashOption,
} from '@decorators'
import { Pagination, PaginationType } from '@discordx/pagination'
import {
  Category,
  EnumChoice,
  PermissionGuard,
  RateLimit,
  TIME_UNIT,
} from '@discordx/utilities'
import { AlgoNFTAsset, AlgoWallet, DarumaTrainingChannel } from '@entities'
import { Disabled, Guard, Maintenance } from '@guards'
import { Database, Ranking } from '@services'
import {
  assetName,
  botCustomEvents,
  buildGameType,
  chunkArray,
  coolDownsDescending,
  flexDaruma,
  GameTypes,
  getAssetUrl,
  karmaPayoutCalculator,
  msToHour,
  onlyDigits,
  paginatedDarumaEmbed,
  randomNumber,
  resolveDependency,
  timeFromNow,
} from '@utils/functions'
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonInteraction,
  CommandInteraction,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
} from 'discord.js'
import { Client, SlashChoice } from 'discordx'
import { injectable } from 'tsyringe'

@Discord()
@injectable()
@SlashGroup({ description: 'Dojo Commands', name: 'dojo' })
export default class DojoCommand {
  constructor(private db: Database) {}
  @Category('Admin')
  @Guard(Disabled, PermissionGuard(['Administrator']))
  @Slash({
    name: 'join',
    description: 'Have the bot join a dojo channel!',
  })
  async join(
    @SlashOption({
      description: 'Channel to join',
      name: 'channel',
      required: true,
      type: ApplicationCommandOptionType.Channel,
    })
    channelName: string,
    @SlashChoice(...EnumChoice(GameTypes))
    @SlashOption({
      description: 'Game type',
      name: 'game_type',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    channelType: GameTypes,
    interaction: CommandInteraction
  ) {
    let client = await resolveDependency(Client)
    // Remove all but digits from channel name
    const channelId = onlyDigits(channelName.toString())
    await this.db.get(DarumaTrainingChannel).addChannel(channelId, channelType)
    client.emit(botCustomEvents.startWaitingRooms, client)
    await interaction.followUp(
      `Joined ${channelName}, with the default settings!`
    )
  }
  @Category('Admin')
  @Guard(Disabled, PermissionGuard(['Administrator']))
  @ContextMenu({
    name: 'Start Waiting Room',
    type: ApplicationCommandType.Message,
  })
  async startWaitingRoomAgain(
    interaction: MessageContextMenuCommandInteraction
  ) {
    let client = await resolveDependency(Client)
    await interaction.followUp('Starting waiting room again...')
    client.emit(botCustomEvents.startWaitingRooms, client)
  }

  @Category('Admin')
  @Guard(Disabled, PermissionGuard(['Administrator']))
  @ContextMenu({ name: 'Leave Dojo', type: ApplicationCommandType.Message })
  async leave(interaction: MessageContextMenuCommandInteraction) {
    const channelId = interaction.channelId
    const channelName = `<#${interaction.channelId}>`

    // Remove all but digits from channel name
    //const channelId = onlyDigits(channelName.toString())
    const channelMsgId = await this.db
      .get(DarumaTrainingChannel)
      .getChannelMessageId(channelId)
    if (interaction.channel?.id === channelId) {
      if (channelMsgId) {
        try {
          await interaction.channel?.messages.delete(channelMsgId)
        } catch (error) {
          await interaction.followUp(
            `I couldn't delete the message!\nAttempting to leave the channel anyway...`
          )
        }
        const channelExists = await this.db
          .get(DarumaTrainingChannel)
          .removeChannel(channelId)
        if (!channelExists) {
          await interaction.followUp(`I'm not in ${channelName}!`)
        } else {
          await interaction.followUp(`Left ${channelName}!`)
        }
      }
    } else {
      await interaction.followUp(
        `You must be in ${channelName} to use this command!`
      )
    }
  }

  @Category('Dojo')
  @Slash({
    name: 'channel',
    description: 'Show the current channel settings',
  })
  @SlashGroup('dojo')
  async settings(interaction: CommandInteraction) {
    // Get channel id from interaction
    const channelId = interaction.channelId
    // Get channel settings from database
    const channelSettings = await this.db
      .get(DarumaTrainingChannel)
      .getAllChannels()
    // Get channel settings for current channel
    const currentChannelSettings = channelSettings.find(
      channel => channel.channelId === channelId
    )
    // If no settings found, return
    if (!currentChannelSettings) {
      await interaction.followUp(`This channel is not currently being tracked!`)
      return
    }
    if (currentChannelSettings) {
      const gameSettings = buildGameType(currentChannelSettings)
      const randomRound = randomNumber(1, 25)
      const karmaPayoutNoZen = karmaPayoutCalculator(
        randomRound,
        gameSettings.token,
        false
      )
      const karmaPayoutZen = karmaPayoutCalculator(
        randomRound,
        gameSettings.token,
        true
      )
      let newEmbed = new EmbedBuilder()
      newEmbed.setTitle(`Channel Settings`)
      newEmbed.setDescription(`Current settings for this channel are:`)
      newEmbed.addFields(
        {
          name: `Game Type`,
          value: gameSettings.gameType,
          inline: true,
        },
        {
          name: 'Cooldown',
          value: msToHour(gameSettings.coolDown).toString() + ' hours',
          inline: true,
        },
        {
          name: `\u200b`,
          value: `\u200b`,
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
          name: '\u200b',
          value: '\u200b',
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
        }
      )
      await interaction.followUp({ embeds: [newEmbed] })
    }
  }
  @Category('Dojo')
  @Slash({
    name: 'daruma',
    description: 'Setup your Daruma Customization',
  })
  @SlashGroup('dojo')
  async daruma(interaction: CommandInteraction) {
    await paginatedDarumaEmbed(interaction)
  }

  @Category('Dojo')
  @Slash({
    name: 'ranking',
    description: 'Shows the top 20 ranking Daruma in the Dojos',
  })
  @SlashGroup('dojo')
  async ranking(interaction: CommandInteraction) {
    let ranking = await resolveDependency(Ranking)

    const algoExplorerURL = 'https://www.nftexplorer.app/asset/'
    let winsRatio = await this.db
      .get(AlgoNFTAsset)
      .assetRankingsByWinLossRatio()
    // get the longest asset name length
    let winsRatioString = winsRatio
      .slice(0, 20)
      .map((asset, index) => {
        const thisAssetName = assetName(asset)
        const paddedIndex = (index + 1).toString().padStart(2, ' ')
        const wins = asset.assetNote?.dojoTraining?.wins.toString() ?? '0'
        const losses = asset.assetNote?.dojoTraining?.losses.toString() ?? '0'
        const urlTitle = `${thisAssetName}\n${wins} wins\n${losses} losses`
        const assetNameAndLink = `[***${thisAssetName}***](${algoExplorerURL}${asset.assetIndex} "${urlTitle}")`
        return `\`${paddedIndex}.\` ${assetNameAndLink}`
      })
      .join('\n')
    let newEmbed = new EmbedBuilder()
    newEmbed.setTitle(`Top 20 Daruma Dojo Ranking`)
    newEmbed.setDescription(winsRatioString)
    newEmbed.setThumbnail(getAssetUrl(winsRatio[0]))
    newEmbed.setFooter({
      text: `Based on wins/losses ratio.\nTotal Games Played ${ranking
        .get('totalGames')
        .toLocaleString()}\nStats updated every ~10 minutes`,
    })
    await interaction.followUp({ embeds: [newEmbed] })
  }
  @Guard(Maintenance)
  @Guard(RateLimit(TIME_UNIT.seconds, 20))
  @ButtonComponent({ id: /((daruma-flex)[^\s]*)\b/gm })
  async selectPlayer(interaction: ButtonInteraction) {
    await flexDaruma(interaction)
  }
  @Category('Dojo')
  @Slash({
    name: 'cd',
    description: 'Check your Cool downs!',
  })
  @Guard(Maintenance)
  @SlashGroup('dojo')
  async dojoCd(interaction: CommandInteraction) {
    await this.cd(interaction)
  }
  @Category('Dojo')
  @Slash({
    name: 'cd',
    description: 'Shortcut -- Check your Cool downs!',
  })
  @Guard(Maintenance)
  async cd(interaction: CommandInteraction) {
    let db = await resolveDependency(Database)
    let playableAssets = await db
      .get(AlgoWallet)
      .getPlayableAssets(interaction.user.id)
    let coolDowns = coolDownsDescending(playableAssets)
    let pages: string[] = []
    coolDowns.forEach(coolDown => {
      let asset = assetName(coolDown)
      let coolDownTime = coolDown.assetNote?.coolDown || 0
      let coolDownTimeLeft = timeFromNow(coolDownTime)
      pages.push(`${asset} is ${coolDownTimeLeft}`)
    })
    if (coolDowns.length === 0) {
      await interaction.followUp({
        content: 'You have no cool downs!',
      })
      return
    }
    const chunked = chunkArray(pages, 20)
    const pages2 = chunked.map(page => {
      return {
        embeds: [
          new EmbedBuilder()
            .setTitle('Cool Downs')
            .setDescription(page.join('\n')),
        ],
      }
    })

    const pagination = new Pagination(
      interaction,
      pages2.map(embed => embed),
      {
        type: PaginationType.Button,
        showStartEnd: false,
        onTimeout: () => {
          interaction.deleteReply().catch(() => null)
        },
        // 30 Seconds in ms
        time: 30 * 1000,
      }
    )
    await pagination.send()
  }
}
