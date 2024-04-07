import { CommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';

import { Category, PermissionGuard } from '@discordx/utilities';
import { Client, Discord, Guard, Slash, SlashGroup } from 'discordx';

import { databasePing } from '../database/mongoose.js';

@Discord()
@Category('Admin')
@Guard(PermissionGuard(['Administrator']))
export class Ping {
  @Slash({
    description: 'Checks the ping to the Discord server',
    dmPermission: false,
  })
  @SlashGroup('dev')
  public async ping(interaction: CommandInteraction, client: Client): Promise<void> {
    await interaction.deferReply({ ephemeral: true, fetchReply: true });
    const message = await interaction.followUp({ content: 'Pinging...' });

    const messageTime = `${message.createdTimestamp - interaction.createdTimestamp}ms`;
    const heartBeat = `${Math.round(client.ws.ping)}ms`;
    const databasePing_ = await databasePing();

    const me = interaction.guild?.members.me ?? interaction.user;
    const color = me instanceof GuildMember ? me.displayHexColor : 'Aqua';
    const embed = new EmbedBuilder()
      .setTitle(`Ping information`)
      .setColor(color)
      .setAuthor({
        name: client.user?.username ?? 'Unknown',
        iconURL: me.displayAvatarURL(),
      })
      .setDescription(`Ping info from this bot and current status`)
      .setTimestamp();

    embed.addFields([
      {
        name: 'message round-trip',
        value: messageTime,
      },
      {
        name: 'heartbeat ping',
        value: heartBeat,
      },
      {
        name: 'Database ping',
        value: `${databasePing_.toPrecision(2)}ms`,
      },
    ]);
    await interaction.editReply({
      embeds: [embed],
      content: `Pong!`,
    });
  }
}
