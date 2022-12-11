import { ChannelType, InteractionType } from 'discord.js';
import { Client, Discord, Guard, On } from 'discordx';
import type { ArgsOf } from 'discordx';
import { injectable } from 'tsyringe';

import { generalConfig } from '../config/general.js';
import { Guild } from '../entities/Guild.js';
import { User } from '../entities/User.js';
import { Maintenance } from '../guards/Maintenance.js';
import { Database } from '../services/Database.js';
import logger from '../utils/functions/LoggerFactory.js';
import { syncUser } from '../utils/functions/synchronizer.js';
import { DiscordUtils } from '../utils/Utils.js';
@Discord()
@injectable()
export default class InteractionCreateEvent {
    constructor(private db: Database) {}

    @On()
    @Guard(Maintenance)
    async interactionCreate(
        [interaction]: ArgsOf<'interactionCreate'>,
        client: Client
    ): Promise<void> {
        try {
            await client.executeInteraction(interaction);
            // insert user in db if not exists
            await syncUser(interaction.user);

            // update last interaction time of both user and guild
            await this.db.get(User).updateLastInteract(interaction.user.id);
            await this.db.get(Guild).updateLastInteract(interaction.guild?.id);
        } catch (e) {
            if (e instanceof Error) {
                logger.error(e.message);
                logger.error(e.stack);
            } else {
                logger.error(e);
                logger.error(e.stack);
            }
            const me = interaction?.guild?.members?.me ?? interaction.user;
            if (
                interaction.type === InteractionType.ApplicationCommand ||
                interaction.type === InteractionType.MessageComponent
            ) {
                const channel = interaction.channel;
                if (
                    channel &&
                    (channel.type !== ChannelType.GuildText ||
                        !channel.permissionsFor(me).has('SendMessages'))
                ) {
                    logger.error(`cannot send warning message to this channel`, interaction);
                    return;
                }
                try {
                    await DiscordUtils.InteractionUtils.replyOrFollowUp(
                        interaction,
                        `Something went wrong, please notify my developer: <@${generalConfig.ownerId}>`
                    );
                } catch (e) {
                    logger.error(e);
                }
            }
        }
    }
}
