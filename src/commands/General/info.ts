/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { generalConfig } from '@config'
import { Discord, Slash } from '@decorators'
import { Category } from '@discordx/utilities'
import { Guard } from '@guards'
import { Stats } from '@services'
import { getColor, isValidUrl, timeAgo } from '@utils/functions'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  EmbedField,
} from 'discord.js'
import { Client } from 'discordx'
import { injectable } from 'tsyringe'

dayjs.extend(relativeTime)

import packageJSON from '../../../package.json'

const links = [{ label: 'Our Webpage', url: generalConfig.links.supportServer }]

@Discord()
@injectable()
@Category('General')
export default class InfoCommand {
  constructor(private stats: Stats) {}

  @Slash({
    name: 'info',
  })
  @Guard()
  async info(interaction: CommandInteraction, client: Client) {
    const embed = new EmbedBuilder()
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTitle(client.user!.tag)
      .setThumbnail(client.user!.displayAvatarURL())
      .setColor(getColor('primary'))
      .setDescription(packageJSON.description)

    const fields: EmbedField[] = []

    /**
     * Owner field
     */
    const owner = await client.users
      .fetch(generalConfig.ownerId)
      .catch(() => null)
    if (owner) {
      fields.push({
        name: 'Owner',
        value: `\`${owner.tag}\``,
        inline: true,
      })
    }

    /**
     * Uptime field
     */
    const uptime = timeAgo(new Date(Date.now() - client.uptime!))
    fields.push({
      name: 'Uptime',
      value: uptime,
      inline: true,
    })

    /**
     * Totals field
     */
    const totalStats = await this.stats.getTotalStats()
    fields.push({
      name: 'Totals',
      value: `**${totalStats.TOTAL_USERS}** users\n**${totalStats.TOTAL_COMMANDS}** commands`,
      inline: true,
    })

    /**
     * Bot version field
     */
    fields.push({
      name: 'Bot version',
      value: `v${packageJSON.version}`,
      inline: true,
    })

    /**
     * Libraries field
     */
    fields.push({
      name: 'Libraries',
      value: `[discord.js](https://discord.js.org/) (*v${packageJSON.dependencies[
        'discord.js'
      ].replace(
        '^',
        ''
      )}*)\n[discordx](https://discordx.js.org/) (*v${packageJSON.dependencies[
        'discordx'
      ].replace('^', '')}*)`,
      inline: true,
    })

    // add the fields to the embed
    embed.addFields(fields)

    /**
     * Define links buttons
     */
    const buttons = links
      .map(link => {
        const url = link.url.split('_').join('')
        if (isValidUrl(url)) {
          return new ButtonBuilder()
            .setLabel(link.label)
            .setURL(url)
            .setStyle(ButtonStyle.Link)
        } else return null
      })
      .filter(link => link) as ButtonBuilder[]
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)

    // finally send the embed
    await interaction.followUp({
      embeds: [embed],
      components: [row],
    })
  }
}
