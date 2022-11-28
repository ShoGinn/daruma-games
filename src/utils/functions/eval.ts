/* eslint-disable @typescript-eslint/no-var-requires */
import { generalConfig } from '@config'
import { Message } from 'discord.js'

const clean = (text: any) => {
  if (typeof text === 'string')
    return text
      .replace(/`/g, '`' + String.fromCharCode(8203))
      .replace(/@/g, '@' + String.fromCharCode(8203))
  else return text
}

/**
 * Eval a code snippet extracted from a Discord message.
 * @param message - Discord message containing the code to eval
 */
export const executeEvalFromMessage = async (message: Message) => {
  try {
    const code = message.content
      .replace('```' + generalConfig.eval.name, '')
      .replace('```', '')

    let evaled = eval(code)

    if (typeof evaled !== 'string')
      evaled = require('node:util').inspect(evaled)
  } catch (err) {
    await message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``)
  }
}
