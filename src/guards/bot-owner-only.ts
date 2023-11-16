import { CommandInteraction } from 'discord.js';

import { Client, Next } from 'discordx';

import { InteractionUtils, isDeveloper } from '../utils/utils.js';

export function BotOwnerOnly(
  argument: CommandInteraction,
  _client: Client,
  next: Next,
): Promise<unknown> {
  const discordUserId = argument?.user?.id;
  if (!isDeveloper(discordUserId)) {
    return InteractionUtils.replyOrFollowUp(argument, {
      ephemeral: true,
      content: 'You are not the bot owner!\nCommand aborted',
    });
  }
  return next();
}
