import { CommandInteraction } from 'discord.js';

import { Client, Next } from 'discordx';

import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import { isDeveloper } from '../utils/functions/owner-utils.js';

export function FutureFeature(
  argument: CommandInteraction,
  _client: Client,
  next: Next,
): Promise<unknown> {
  const discordUserId = argument.user.id;
  if (isDeveloper(discordUserId)) {
    return InteractionUtils.replyOrFollowUp(argument, {
      ephemeral: true,
      content: 'This feature is not yet implemented!\nCommand aborted',
    });
  }
  return next();
}
