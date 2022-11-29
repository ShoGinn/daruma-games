import { getLocaleFromInteraction, L } from '@i18n'
import {
  isDev,
  isInMaintenance,
  replyToInteraction,
  resolveUser,
} from '@utils/functions'
import {
  ButtonInteraction,
  CommandInteraction,
  ContextMenuCommandInteraction,
} from 'discord.js'
import { ArgsOf, GuardFunction, SimpleCommandMessage } from 'discordx'

/**
 * Prevent interactions from running when bot is in maintenance
 */
export const Maintenance: GuardFunction<
  ArgsOf<'messageCreate' | 'interactionCreate'>
> = async (arg, client, next) => {
  if (
    arg instanceof CommandInteraction ||
    arg instanceof SimpleCommandMessage ||
    arg instanceof ContextMenuCommandInteraction ||
    arg instanceof ButtonInteraction
  ) {
    const user = resolveUser(arg),
      maintenance = await isInMaintenance()

    if (maintenance && user?.id && !isDev(user.id)) {
      const locale = getLocaleFromInteraction(arg),
        localizedReplyMessage = L[locale].GUARDS.MAINTENANCE()

      if (
        arg instanceof CommandInteraction ||
        arg instanceof SimpleCommandMessage ||
        arg instanceof ButtonInteraction
      )
        await replyToInteraction(arg, localizedReplyMessage)
    } else return next()
  } else return next()
}
