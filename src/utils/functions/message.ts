import type { Message } from 'discord.js';

import { isSnowflakeLargerAsInt } from './snowflake.js';

export function sortMessagesById<T extends Message>(messages: T[]): T[] {
    return messages.sort((a, b) => isSnowflakeLargerAsInt(a.id, b.id));
}
