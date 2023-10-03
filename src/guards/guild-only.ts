import type { CommandInteraction } from 'discord.js';
import type { Client, Next } from 'discordx';

/**
 * Prevent the command from running on DM
 *
 * @param {CommandInteraction} argument
 * @param {Client} _client
 * @param {Next} next
 * @class
 */
export function GuildOnly(
	argument: CommandInteraction,
	_client: Client,
	next: Next,
): Promise<unknown> | void | Promise<void> {
	if (argument.inGuild()) {
		return next();
	}
	return;
}
