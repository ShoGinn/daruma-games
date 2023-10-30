import { Category, PermissionGuard } from '@discordx/utilities';
import { CommandInteraction, EmbedBuilder, GuildMember, Status } from 'discord.js';
import { Client, Discord, Guard, Slash, SlashGroup } from 'discordx';
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
    const websocketStatus = Status[client.ws.status];

    const me = interaction?.guild?.members?.me ?? interaction.user;
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
        name: 'Websocket status',
        value: websocketStatus,
      },
    ]);
    await interaction.editReply({
      embeds: [embed],
      content: `Pong!`,
    });
  }
}
