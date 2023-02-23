import type { ClaimTokenResponse } from '../../model/types/algorand.js';
import {
    APIEmbedField,
    BaseMessageOptions,
    EmbedBuilder,
    GuildMember,
    MessagePayload,
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
    thumbNail: string | null,
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
    claimStatus: ClaimTokenResponse,
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
            value: claimStatus.status?.txn?.txn?.aamt?.toLocaleString() ?? 'Unknown',
            inline: true,
        },
    ];
    const webHookEmbed = webhookEmbedBuilder(
        claimTitle,
        claimStatus.txId ?? 'Unknown',
        claimer.user.avatarURL(),
        webhookFields
    );

    webHookMsg.push(webHookEmbed);
}

export function karmaTipWebHook(
    tipSender: GuildMember,
    tipReceiver: GuildMember,
    claimStatus: ClaimTokenResponse
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
            value: claimStatus.status?.txn?.txn?.aamt?.toLocaleString() ?? 'Unknown',
            inline: true,
        },
    ];
    const webHookEmbed = webhookEmbedBuilder(
        WebhookType.TIP,
        claimStatus.txId ?? 'Unknown',
        tipSender.user.avatarURL(),
        webhookFields
    );
    webHookMsg.push(webHookEmbed);
}

export function getWebhooks(client?: Client): void {
    // Check to make sure webhooks are set
    const transActionWebhook = process.env.TRANSACTION_WEBHOOK;
    if (transActionWebhook == undefined) {
        logger.error('No TRANSACTION webhook set');
        return;
    }

    if (client) {
        webHookClient = new WebhookClient({
            url: transActionWebhook,
        });
        runLogs();
    }
}

export function runLogs(): void {
    const sendMessage = (message: string | MessagePayload | BaseMessageOptions): void => {
        webHookClient.send(message);
        webHookMsg.shift();
    };

    setInterval(() => {
        if (webHookMsg.length === 0) return;

        webHookMsg.forEach((message, index) => {
            setTimeout(() => {
                sendMessage(message);
            }, 1000 * (index + 1));
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
