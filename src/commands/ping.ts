import { Category, PermissionGuard } from '@discordx/utilities';
import { CommandInteraction, EmbedBuilder, GuildMember, Status } from 'discord.js';
import { Client, Discord, Guard, Slash } from 'discordx';
@Discord()
@Category('Misc')
export class Ping {
    @Guard(PermissionGuard['Administrator'])
    @Slash({
        description: 'Checks the ping to the Discord server',
        dmPermission: false,
    })
    public async ping(interaction: CommandInteraction, client: Client): Promise<void> {
        await interaction.deferReply({ ephemeral: true, fetchReply: true });
        const msg = await interaction.followUp({ content: 'Pinging...' });

        const messageTime = `${msg.createdTimestamp - interaction.createdTimestamp}ms`;
        const heartBeat = `${Math.round(client.ws.ping)}ms`;
        const websocketStatus = Status[client.ws.status];

        const me = interaction?.guild?.members?.me ?? interaction.user;
        const colour = me instanceof GuildMember ? me.displayHexColor : '#0099ff';
        const embed = new EmbedBuilder()
            .setTitle(`Ping information`)
            .setColor(colour)
            .setAuthor({
                name: client.user.username,
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
