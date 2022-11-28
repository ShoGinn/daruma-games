import { Discord, Slash } from '@decorators'
import { Pagination, PaginationType } from '@discordx/pagination'
import { Category } from '@discordx/utilities'
import { AlgoWallet } from '@entities'
import { Guard } from '@guards'
import { Database } from '@services'
import {
  assetName,
  chunkArray,
  coolDownsDescending,
  resolveDependency,
  timeFromNow,
} from '@utils/functions'
import { CommandInteraction, EmbedBuilder } from 'discord.js'
import { injectable } from 'tsyringe'

@Discord()
@injectable()
@Category('Dojo')
export default class DarumaCommand {
  @Slash({
    name: 'cd',
    description: 'Check your Cool downs!',
  })
  @Guard()
  async cd(interaction: CommandInteraction) {
    let db = await resolveDependency(Database)
    let playableAssets = await db
      .get(AlgoWallet)
      .getPlayableAssets(interaction.user.id)
    let coolDowns = coolDownsDescending(playableAssets)
    //   const pages = Array.from(Array(limit ?? 20).keys()).map((i) => {
    //     return { content: `I am ${i + 1}`, embed: `Demo ${i + 1}` };
    //   });

    //   return pages.map((page) => {
    //     return {
    //       content: page.content,
    //       embeds: [new EmbedBuilder().setTitle(page.embed)],
    //     };
    //   });
    // }
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
          interaction
            .editReply({
              content: 'Rerun the command to view your Cool Downs again!',
              embeds: [],
              components: [],
            })
            .catch(() => null)
        },
        // 30 Seconds in ms
        time: 30 * 1000,
      }
    )
    await pagination.send()
  }
}
