import { CommandInteraction } from 'discord.js';
import { Client, Next } from 'discordx';

import { InteractionUtils, isDeveloper } from '../utils/utils.js';

export function FutureFeature(
    argument: CommandInteraction,
    _client: Client,
    next: Next
): Promise<unknown> {
    const userId = argument?.user?.id;
    if (isDeveloper(userId)) {
        return InteractionUtils.replyOrFollowUp(argument, {
            ephemeral: true,
            content: 'This feature is not yet implemented!\nCommand aborted',
        });
    }
    return next();
}
