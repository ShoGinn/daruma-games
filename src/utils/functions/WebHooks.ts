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
    let embedColor = 0x0000ff;
    switch (preTitle) {
        case WebhookType.CLAIM:
            embedColor = 0xffd700;
            break;
        case WebhookType.TIP:
            embedColor = 0x0000ff;
            break;
        case WebhookType.ARTIFACT:
            embedColor = 0x00ff00;
            break;
        default:
            embedColor = 0x0000ff;
            break;
    }
    const botVersion = propertyResolutionManager.getProperty('version');

    const embed = new EmbedBuilder()
        .setTitle(`${preTitle} KARMA Transaction`)
        .setColor(embedColor)
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
        WebhookType.CLAIM,
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
        WebhookType.TIP,
        url,
        tipSender.user.avatarURL(),
        webhookFields
    );
    webHookMsg.push(webHookEmbed);
}
export function karmaArtifactWebhook(
    artifactClaimer: GuildMember,
    value: string,
    url?: string
): void {
    // Set the Message
    // Build the Tip WebHook Embed
    const webhookFields: APIEmbedField[] = [
        {
            name: 'Artifact Claimer',
            value: artifactClaimer.user.tag,
            inline: true,
        },
        {
            name: 'Artifact Claimer ID',
            value: artifactClaimer.id,
            inline: true,
        },
        {
            name: 'Artifact Claim Amount',
            value: value,
            inline: true,
        },
    ];
    const webHookEmbed = webhookEmbedBuilder(
        WebhookType.ARTIFACT,
        url,
        artifactClaimer.user.avatarURL(),
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

enum WebhookType {
    CLAIM = 'Claimed',
    TIP = 'Tipped',
    ARTIFACT = 'Artifact Claimed',
}
