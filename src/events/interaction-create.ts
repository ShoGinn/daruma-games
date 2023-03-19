import { MikroORM } from '@mikro-orm/core';
import { ChannelType, InteractionType } from 'discord.js';
import { Client, Discord, Guard, On } from 'discordx';
import type { ArgsOf } from 'discordx';
import { injectable } from 'tsyringe';

import { Guild } from '../entities/guild.entity.js';
import { User } from '../entities/user.entity.js';
import { Maintenance } from '../guards/maintenance.js';
import { SystemProperty } from '../model/framework/decorators/system-property.js';
import logger from '../utils/functions/logger-factory.js';
import { syncUser } from '../utils/functions/synchronizer.js';
import { InteractionUtils } from '../utils/utils.js';
@Discord()
@injectable()
export default class InteractionCreateEvent {
    constructor(private orm: MikroORM) {}
    @SystemProperty('BOT_OWNER_ID')
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
        } catch (error) {
            if (error instanceof Error) {
                logger.error(error.message);
                logger.error(error.stack);
            } else {
                logger.error(error);
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
                        !channel.permissionsFor(me)?.has('SendMessages'))
                ) {
                    logger.error(`Cannot send warning message to this channel ${channel}`);
                    return;
                }
                try {
                    await InteractionUtils.replyOrFollowUp(
                        interaction,
                        `Something went wrong, please notify my developer: <@${InteractionCreateEvent.botOwnerId}>`
                    );
                } catch (error) {
                    logger.error(error);
                }
            }
        }
    }
}