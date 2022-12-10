import { CommandInteraction, Events } from 'discord.js';
import { ArgsOf, Client, Discord, Guard, On } from 'discordx';
import { injectable } from 'tsyringe';

import { Guild } from '../entities/Guild.js';
import { User } from '../entities/User.js';
import { Maintenance } from '../guards/maintenance.js';
import { Database } from '../services/Database.js';
import { syncUser } from '../utils/functions/synchronizer.js';

@Discord()
@injectable()
export default class InteractionCreateEvent {
    constructor(private db: Database) {}

    @On({ event: Events.InteractionCreate })
    @Guard(Maintenance)
    async interactionCreateHandler(
        [interaction]: ArgsOf<Events.InteractionCreate>,
        client: Client
    ): Promise<void> {
        // defer the reply
        if (interaction instanceof CommandInteraction)
            await interaction.deferReply({ ephemeral: true });

        // insert user in db if not exists
        await syncUser(interaction.user);

        // update last interaction time of both user and guild
        await this.db.get(User).updateLastInteract(interaction.user.id);
        await this.db.get(Guild).updateLastInteract(interaction.guild?.id);

        // register logs and stats
        //TODO fix this
        //await .logInteraction(interaction as AllInteractions);

        client.executeInteraction(interaction);
    }
}
