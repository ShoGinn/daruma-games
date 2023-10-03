import {
	ButtonInteraction,
	ChannelSelectMenuInteraction,
	CommandInteraction,
	ContextMenuCommandInteraction,
	MentionableSelectMenuInteraction,
	Message,
	MessageReaction,
	ModalSubmitInteraction,
	RoleSelectMenuInteraction,
	StringSelectMenuInteraction,
	UserSelectMenuInteraction,
	VoiceState,
} from 'discord.js';
import { ArgsOf, GuardFunction, SimpleCommandMessage } from 'discordx';

import { isInMaintenance } from '../utils/functions/maintenance.js';
import { isDeveloper } from '../utils/utils.js';

export const Maintenance: GuardFunction<
	| ArgsOf<'messageCreate' | 'messageReactionAdd' | 'voiceStateUpdate'>
	| ButtonInteraction
	| ChannelSelectMenuInteraction
	| CommandInteraction
	| ContextMenuCommandInteraction
	| MentionableSelectMenuInteraction
	| ModalSubmitInteraction
	| RoleSelectMenuInteraction
	| StringSelectMenuInteraction
	| UserSelectMenuInteraction
	| SimpleCommandMessage
> = async (argument, _client, next) => {
	const argumentObject = Array.isArray(argument) ? argument[0] : argument;
	const maintenance = await isInMaintenance();

	const user =
		argumentObject instanceof CommandInteraction
			? argumentObject.user
			: argumentObject instanceof MessageReaction
			? argumentObject.message.author
			: argumentObject instanceof VoiceState
			? argumentObject.member?.user
			: argumentObject instanceof Message
			? argumentObject.author
			: argumentObject instanceof SimpleCommandMessage
			? argumentObject.message.author
			: argumentObject instanceof ButtonInteraction ||
			  argumentObject instanceof ChannelSelectMenuInteraction ||
			  argumentObject instanceof CommandInteraction ||
			  argumentObject instanceof ContextMenuCommandInteraction ||
			  argumentObject instanceof MentionableSelectMenuInteraction ||
			  argumentObject instanceof ModalSubmitInteraction ||
			  argumentObject instanceof RoleSelectMenuInteraction ||
			  argumentObject instanceof StringSelectMenuInteraction ||
			  argumentObject instanceof UserSelectMenuInteraction
			? argumentObject.member?.user
			: argumentObject.message?.author;
	if (maintenance && user?.id && !isDeveloper(user.id)) {
		// Make Sure we can reply to the user
		if (
			argumentObject instanceof CommandInteraction ||
			argumentObject instanceof ButtonInteraction
		) {
			await argumentObject.reply({
				content: `Sorry, I'm currently in maintenance mode. Please try again later.`,
				ephemeral: true,
			});
		} else {
			return await next();
		}
	} else {
		return await next();
	}
	return await next();
};
