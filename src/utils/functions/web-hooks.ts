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

import { createAlgoExplorerButton } from './algo-embeds.js';
import logger from './logger-factory.js';
import { PropertyResolutionManager } from '../../model/framework/manager/property-resolution-manager.js';
import {
    EmbedColorByWebhookType,
    WebhookFunction,
    WebhookType,
} from '../../model/types/web-hooks.js';
import { CircularBuffer } from '../classes/circular-buffer.js';

export const webHookQueue: CircularBuffer<string | MessagePayload | BaseMessageOptions> =
    new CircularBuffer(100);
let webHookClient: WebhookClient;

export function getWebhooks(client?: Client): void {
    const transactionWebhookUrl = process.env['TRANSACTION_WEBHOOK'];
    if (!transactionWebhookUrl) {
        logger.error('No TRANSACTION webhook set');
        return;
    }
    if (client) {
        webHookClient = new WebhookClient({ url: transactionWebhookUrl });
        sendQueuedMessages();
    }
}
export const karmaTipWebHook = createWebhookFunction(WebhookType.TIP);
export const karmaSendWebHook = createWebhookFunction(WebhookType.SENT);
export const karmaArtifactWebHook = createWebhookFunction(WebhookType.ARTIFACT);
export const karmaEnlightenmentWebHook = createWebhookFunction(WebhookType.ENLIGHTENMENT);
export const karmaElixirWebHook = createWebhookFunction(WebhookType.ELIXIR);
export const karmaClaimWebHook = createWebhookFunction(WebhookType.CLAIM);

const propertyResolutionManager = container.resolve(PropertyResolutionManager);

function createEmbed(
    embedFields: Array<APIEmbedField>,
    title: WebhookType,
    thumbnailUrl: string | null,
    txId: string | undefined = 'Unknown'
): BaseMessageOptions {
    const botVersion = propertyResolutionManager.getProperty('version') as string;
    const color = EmbedColorByWebhookType[title];

    const embed = new EmbedBuilder()
        .setTitle(`${title} Algorand Network Transaction`)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: `v${botVersion}` });
    embed.setThumbnail(thumbnailUrl);
    embed.addFields(embedFields);

    return { embeds: [embed], components: [createAlgoExplorerButton(txId)] };
}

function createWebHookPayload(
    title: WebhookType,
    claimStatus: ClaimTokenResponse,
    receiver: GuildMember,
    sender: GuildMember | undefined = undefined
): BaseMessageOptions {
    const webhookFields: Array<APIEmbedField> = [];
    if (sender) {
        webhookFields.push(
            {
                name: `${title} Sender`,
                value: sender.user.tag,
                inline: true,
            },
            {
                name: `${title} Sender ID`,
                value: sender.id,
                inline: true,
            }
        );
    }
    webhookFields.push(
        {
            name: `${title} Receiver`,
            value: receiver.user.tag,
            inline: true,
        },
        {
            name: `${title} Receiver ID`,
            value: receiver.id,
            inline: true,
        },
        {
            name: `${title} Amount`,
            value: claimStatus.status?.txn?.txn?.aamt?.toLocaleString() ?? 'Unknown',
            inline: true,
        }
    );

    return createEmbed(
        webhookFields,
        title,
        sender?.user.avatarURL() ?? receiver.user.avatarURL(),
        claimStatus.txId
    );
}

function createWebhookFunction(webhookType: WebhookType): WebhookFunction {
    return (claimStatus: ClaimTokenResponse, receiver: GuildMember, sender?: GuildMember) => {
        const message = createWebHookPayload(webhookType, claimStatus, receiver, sender);
        enqueueMessage(message);
    };
}

function enqueueMessage<T extends string | MessagePayload | BaseMessageOptions>(payload: T): void {
    webHookQueue.enqueue(payload);
}
/* istanbul ignore next */
const sendNextMessage = (): void => {
    const message = webHookQueue.dequeue();
    if (!message) {
        return;
    }
    webHookClient.send(message).catch(error => {
        logger.error(`Error sending webhook message: ${JSON.stringify(error)}`);
    });
};
/* istanbul ignore next */
function sendQueuedMessages(): void {
    setInterval(sendNextMessage, 5000);
}
