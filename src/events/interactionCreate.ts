import { MikroORM } from '@mikro-orm/core';
import { ChannelType, InteractionType } from 'discord.js';
import { Client, Discord, Guard, On } from 'discordx';
import type { ArgsOf } from 'discordx';
import { injectable } from 'tsyringe';

import { Guild } from '../entities/Guild.js';
import { User } from '../entities/User.js';
import { Maintenance } from '../guards/Maintenance.js';
import { Property } from '../model/framework/decorators/Property.js';
import logger from '../utils/functions/LoggerFactory.js';
import { syncUser } from '../utils/functions/synchronizer.js';
import { DiscordUtils } from '../utils/Utils.js';
@Discord()
@injectable()
export default class InteractionCreateEvent {
    constructor(private orm: MikroORM) {}
    @Property('BOT_OWNER_ID')
    private static readonly botOwnerId: string;

    @On()
    @Guard(Maintenance)
    async interactionCreate(
        [interaction]: ArgsOf<'interactionCreate'>,
        client: Client
    ): Promise<void> {
        try {
            // insert user in db if not exists
            await syncUser(interaction.user);

            // update last interaction time of both user and guild
            const em = this.orm.em.fork();
            await em.getRepository(User).updateLastInteract(interaction.user.id);
            await em.getRepository(Guild).updateLastInteract(interaction.guild?.id);
            await client.executeInteraction(interaction);
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
                    logger.error(`Cannot send warning message to this channel ${channel}`);
                    return;
                }
                try {
                    await DiscordUtils.InteractionUtils.replyOrFollowUp(
                        interaction,
                        `Something went wrong, please notify my developer: <@${InteractionCreateEvent.botOwnerId}>`
                    );
                } catch (e) {
                    logger.error(e);
                }
            }
        }
    }
}
