import {
    APIEmbedField,
    BaseMessageOptions,
    EmbedBuilder,
    GuildMember,
    WebhookClient,
} from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { PropertyResolutionManager } from '../../model/framework/manager/PropertyResolutionManager.js';
import logger from './LoggerFactory.js';
const propertyResolutionManager = container.resolve(PropertyResolutionManager);

let webHookClient: WebhookClient;
let webHookMsg: BaseMessageOptions[] = [];

function webhookEmbedBuilder(
    preTitle: string,
    url: string = 'https://algoexplorer.io/',
    thumbNail: string,
    fields: APIEmbedField[]
): BaseMessageOptions {
    const botVersion = propertyResolutionManager.getProperty('version');

    const embed = new EmbedBuilder()
        .setTitle(`${preTitle} KARMA Transaction`)
        // set color gold if claimed, blue if tipped
        .setColor(preTitle === 'Claimed' ? 0xffd700 : 0x0000ff)
        .setTimestamp()
        .setFooter({ text: `v${botVersion}` });
    embed.setThumbnail(thumbNail);
    embed.addFields(fields);
    embed.setURL(url);
    return { embeds: [embed] };
}
export function karmaClaimWebhook(claimer: GuildMember, value: string, url?: string): void {
    // Set the Message
    const webhookFields: APIEmbedField[] = [
        {
            name: 'Claimer',
            value: claimer.user.tag,
            inline: true,
        },
        {
            name: 'Claimer ID',
            value: claimer.id,
            inline: true,
        },
        {
            name: 'Claimed KARMA',
            value: value,
            inline: true,
        },
    ];
    const webHookEmbed = webhookEmbedBuilder(
        'Claimed',
        url,
        claimer.user.avatarURL(),
        webhookFields
    );

    webHookMsg.push(webHookEmbed);
}
export function karmaTipWebHook(
    tipSender: GuildMember,
    tipReceiver: GuildMember,
    value: string,
    url?: string
): void {
    // Set the Message
    // Build the Tip WebHook Embed
    const webhookFields: APIEmbedField[] = [
        {
            name: 'Tip Sender',
            value: tipSender.user.tag,
            inline: true,
        },
        {
            name: 'Tip Sender ID',
            value: tipSender.id,
            inline: true,
        },
        {
            name: 'Tip Receiver',
            value: tipReceiver.user.tag,
            inline: true,
        },
        {
            name: 'Tip Receiver ID',
            value: tipReceiver.id,
            inline: true,
        },
        {
            name: 'Tip Amount',
            value: value,
            inline: true,
        },
    ];
    const webHookEmbed = webhookEmbedBuilder(
        'Tipped',
        url,
        tipSender.user.avatarURL(),
        webhookFields
    );
    webHookMsg.push(webHookEmbed);
}

export async function getWebhooks(client?: Client): Promise<void> {
    // Check to make sure webhooks are set
    const transActionWebhook = process.env.TRANSACTION_WEBHOOK;
    if (transActionWebhook == undefined) {
        logger.error('No TRANSACTION webhook set');
    }

    if (client) {
        if (transActionWebhook) {
            webHookClient = new WebhookClient({
                url: transActionWebhook,
            });
        }
        if (transActionWebhook) runLogs();
    }
}

function runLogs(): void {
    setInterval(() => {
        if (webHookMsg.length === 0) return;
        // iterate through the array and send the messages
        webHookMsg.forEach(m => {
            // use timeout to queue the messages
            setTimeout(() => {
                webHookClient.send(m);
                // remove the message from the array
                webHookMsg.shift();
            }, 1000);
        });
    }, 5000);
}
