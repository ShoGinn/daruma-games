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

import logger from './logger-factory.js';
import { PropertyResolutionManager } from '../../model/framework/manager/property-resolution-manager.js';
const propertyResolutionManager = container.resolve(PropertyResolutionManager);

let webHookClient: WebhookClient;
export const webHookQueue: Array<string | MessagePayload | BaseMessageOptions> = [];

enum EmbedColor {
    CLAIM = 0xff_d7_00,
    TIP = 0x00_00_ff,
    ARTIFACT = 0x00_ff_00,
    ENLIGHTENMENT = 0x00_ff_00,
    ELIXIR = 0x00_ff_00,
}
export enum WebhookType {
    CLAIM = 'Claimed',
    TIP = 'Tipped',
    ARTIFACT = 'Artifact Claimed',
    ENLIGHTENMENT = 'Enlightenment Claimed',
    ELIXIR = 'Elixir Claimed',
}
const EmbedColorByWebhookType = {
    [WebhookType.CLAIM]: EmbedColor.CLAIM,
    [WebhookType.TIP]: EmbedColor.TIP,
    [WebhookType.ARTIFACT]: EmbedColor.ARTIFACT,
    [WebhookType.ENLIGHTENMENT]: EmbedColor.ENLIGHTENMENT,
    [WebhookType.ELIXIR]: EmbedColor.ELIXIR,
};
function createEmbed(
    embedFields: Array<APIEmbedField>,
    title: WebhookType,
    thumbnailUrl: string | null,
    txId: string | undefined = 'Unknown'
): BaseMessageOptions {
    const botVersion = propertyResolutionManager.getProperty('version');
    const color = EmbedColorByWebhookType[title];

    const embed = new EmbedBuilder()
        .setTitle(`${title} KARMA Transaction`)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: `v${botVersion}` });
    embed.setThumbnail(thumbnailUrl);
    embed.addFields(embedFields);
    embed.setURL(`https://algoexplorer.io/tx/${txId}`);

    return { embeds: [embed] };
}

export function getWebhooks(client?: Client): void {
    // Check to make sure webhooks are set
    const transactionWebhookUrl = process.env.TRANSACTION_WEBHOOK;
    if (!transactionWebhookUrl) {
        logger.error('No TRANSACTION webhook set');
        return;
    }
    /* istanbul ignore next */
    if (client) {
        webHookClient = new WebhookClient({ url: transactionWebhookUrl });
        sendQueuedMessages();
    }
}

export function txnWebHook(
    claimer: GuildMember,
    claimStatus: ClaimTokenResponse,
    claimTitle: WebhookType
): void {
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

    const message = createEmbed(
        webhookFields,
        claimTitle,
        claimer.user.avatarURL(),
        claimStatus.txId
    );
    enqueueMessage(message);
}

export function karmaTipWebHook(
    tipSender: GuildMember,
    tipReceiver: GuildMember,
    claimStatus: ClaimTokenResponse
): void {
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

    const message = createEmbed(
        webhookFields,
        WebhookType.TIP,
        tipSender.user.avatarURL(),
        claimStatus.txId
    );
    enqueueMessage(message);
}

function enqueueMessage<T extends string | MessagePayload | BaseMessageOptions>(payload: T): void {
    webHookQueue.push(payload);
}
/* istanbul ignore next */
const sendNextMessage = (): void => {
    const message = webHookQueue.shift();
    if (!message) {
        return;
    }
    webHookClient.send(message).catch(error => {
        logger.error(`Error sending webhook message: ${error}`);
    });
};
/* istanbul ignore next */
function sendQueuedMessages(): void {
    setInterval(sendNextMessage, 5000);
}
