import {
    APIEmbedField,
    BaseMessageOptions,
    EmbedBuilder,
    GuildMember,
    WebhookClient,
} from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import logger from './LoggerFactory.js';
import { PropertyResolutionManager } from '../../model/framework/manager/PropertyResolutionManager.js';
const propertyResolutionManager = container.resolve(PropertyResolutionManager);

let webHookClient: WebhookClient;
const webHookMsg: Array<BaseMessageOptions> = [];

function webhookEmbedBuilder(
    preTitle: WebhookType,
    txId: string,
    thumbNail: string,
    fields: Array<APIEmbedField>
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
    embed.setURL(`https://algoexplorer.io/tx/${txId}`);
    return { embeds: [embed] };
}
export function txnWebHook(
    claimer: GuildMember,
    claimStatus: AlgorandPlugin.ClaimTokenResponse,
    claimTitle: WebhookType
): void {
    // Set the Message
    const webhookFields: Array<APIEmbedField> = [
        {
            name: 'Discord User',
            value: claimer.user.tag,
            inline: true,
        },
        {
            name: 'Discord User ID',
            value: claimer.id,
            inline: true,
        },
        {
            name: 'Transaction Amount',
            value: claimStatus.status?.txn.txn.aamt.toLocaleString(),
            inline: true,
        },
    ];
    const webHookEmbed = webhookEmbedBuilder(
        claimTitle,
        claimStatus.txId,
        claimer.user.avatarURL(),
        webhookFields
    );

    webHookMsg.push(webHookEmbed);
}

export function karmaTipWebHook(
    tipSender: GuildMember,
    tipReceiver: GuildMember,
    claimStatus: AlgorandPlugin.ClaimTokenResponse
): void {
    // Set the Message
    // Build the Tip WebHook Embed
    const webhookFields: Array<APIEmbedField> = [
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
            value: claimStatus.status?.txn.txn.aamt.toLocaleString(),
            inline: true,
        },
    ];
    const webHookEmbed = webhookEmbedBuilder(
        WebhookType.TIP,
        claimStatus.txId,
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

export enum WebhookType {
    CLAIM = 'Claimed',
    TIP = 'Tipped',
    ARTIFACT = 'Artifact Claimed',
    ENLIGHTENMENT = 'Enlightenment Claimed',
    ELIXIR = 'Elixir Claimed',
}
