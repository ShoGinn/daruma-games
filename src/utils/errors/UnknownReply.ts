import { getLocaleFromInteraction, L } from '@i18n'
import { BaseError } from '@utils/classes'
import { simpleErrorEmbed } from '@utils/functions'
import { CommandInteraction } from 'discord.js'

export class UnknownReplyError extends BaseError {
  private interaction: CommandInteraction

  constructor(interaction: CommandInteraction, message?: string) {
    super(message)

    this.interaction = interaction
  }

  async handle() {
    const locale = getLocaleFromInteraction(this.interaction)
    await simpleErrorEmbed(this.interaction, L[locale]['ERRORS']['UNKNOWN']())
  }
}
