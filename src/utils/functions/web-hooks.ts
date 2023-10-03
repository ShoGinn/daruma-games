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

import logger from './logger-factory.js';
import { getConfig } from '../../config/config.js';
import {
	embedColorByWebhookType,
	WebhookFunction,
	WebhookType,
} from '../../model/types/web-hooks.js';
import { version } from '../../version.js';
import { CircularBuffer } from '../classes/circular-buffer.js';

export const webHookQueue: CircularBuffer<
	string | MessagePayload | BaseMessageOptions
> = new CircularBuffer(100);
let webHookClient: WebhookClient;

export function getWebhooks(client?: Client): void {
	const transactionWebhookUrl = getConfig().get('transactionWebhook');
	if (!transactionWebhookUrl) {
		logger.error('No TRANSACTION webhook set');
		return;
	}
	if (client) {
		webHookClient = new WebhookClient({ url: transactionWebhookUrl });
		sendQueuedMessages();
	}
}
export const karmaTipWebHook = createWebhookFunction(WebhookType.TIP, 'KARMA');
export const karmaSendWebHook = createWebhookFunction(
	WebhookType.SENT,
	'KARMA',
);
export const karmaArtifactWebHook = createWebhookFunction(WebhookType.ARTIFACT);
export const karmaEnlightenmentWebHook = createWebhookFunction(
	WebhookType.ENLIGHTENMENT,
);
export const karmaElixirWebHook = createWebhookFunction(WebhookType.ELIXIR);
export const karmaClaimWebHook = createWebhookFunction(
	WebhookType.CLAIM,
	'KARMA',
);

function createEmbed(
	embedFields: Array<APIEmbedField>,
	title: WebhookType,
	thumbnailUrl: string | null,
	asset: string | undefined,
	txId: string | undefined = 'Unknown',
): BaseMessageOptions {
	const color = embedColorByWebhookType[title];
	const assetFormatted = formatAsset(asset);

	const embed = new EmbedBuilder()
		.setTitle(`${title}${assetFormatted} -- Algorand Network Transaction`)
		.setColor(color)
		.setTimestamp()
		.setFooter({ text: `v${version}` })
		.setThumbnail(thumbnailUrl)
		.addFields(embedFields)
		.setURL(`https://algoexplorer.io/tx/${txId}`);

	return { embeds: [embed] };
}
function formatAsset(asset: string | undefined): string {
	return asset ? ` (${asset})` : '';
}
function createWebHookPayload(
	title: WebhookType,
	asset: string | undefined,
	claimStatus: ClaimTokenResponse,
	receiver: GuildMember,
	sender: GuildMember | undefined = undefined,
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
			},
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
		},
	);

	return createEmbed(
		webhookFields,
		title,
		sender?.user.avatarURL() ?? receiver.user.avatarURL(),
		asset,
		claimStatus.txId,
	);
}

function createWebhookFunction(
	webhookType: WebhookType,
	asset?: string | undefined,
): WebhookFunction {
	return (
		claimStatus: ClaimTokenResponse,
		receiver: GuildMember,
		sender?: GuildMember,
	) => {
		const message = createWebHookPayload(
			webhookType,
			asset,
			claimStatus,
			receiver,
			sender,
		);
		enqueueMessage(message);
	};
}

function enqueueMessage<T extends string | MessagePayload | BaseMessageOptions>(
	payload: T,
): void {
	webHookQueue.enqueue(payload);
}
/* istanbul ignore next */
const sendNextMessage = (): void => {
	const message = webHookQueue.dequeue();
	if (!message) {
		return;
	}
	webHookClient.send(message).catch((error) => {
		logger.error(`Error sending webhook message: ${JSON.stringify(error)}`);
	});
};
/* istanbul ignore next */
function sendQueuedMessages(): void {
	setInterval(sendNextMessage, 5000);
}
