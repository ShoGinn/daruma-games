import {
  APIEmbedField,
  BaseMessageOptions,
  EmbedBuilder,
  GuildMember,
  MessagePayload,
  WebhookClient,
} from 'discord.js';

import { Client } from 'discordx';

import { SendTransactionResult } from '@algorandfoundation/algokit-utils/types/transaction';

import { getConfig } from '../../config/config.js';
import { embedColorByWebhookType, WebhookFunction, WebhookType } from '../../types/web-hooks.js';
import { version } from '../../version.js';
import { CircularBuffer } from '../classes/circular-buffer.js';

import { generateTransactionExplorerUrl } from './algo-embeds.js';
import logger from './logger-factory.js';

export const webHookQueue = new CircularBuffer<string | MessagePayload | BaseMessageOptions>(100);
let webHookClient: WebhookClient;

export function initializeWebhooks(client?: Client): void {
  const transactionWebhookUrl = getConfig().get('transactionWebhook');
  if (!transactionWebhookUrl) {
    logger.error('No TRANSACTION webhook set');
    return;
  }
  if (client) {
    webHookClient = new WebhookClient({ url: transactionWebhookUrl });
    logger.info('Webhook client initialized');
    sendQueuedMessages();
  }
}
export const karmaTipWebHook = createWebhookFunction(WebhookType.TIP, 'KARMA');
export const karmaSendWebHook = createWebhookFunction(WebhookType.SENT, 'KARMA');
export const karmaArtifactWebHook = createWebhookFunction(WebhookType.ARTIFACT);
export const karmaEnlightenmentWebHook = createWebhookFunction(WebhookType.ENLIGHTENMENT);
export const karmaElixirWebHook = createWebhookFunction(WebhookType.ELIXIR);
export const karmaClaimWebHook = createWebhookFunction(WebhookType.CLAIM, 'KARMA');

function createEmbed(
  embedFields: APIEmbedField[],
  title: WebhookType,
  thumbnailUrl: string | null,
  asset: string | undefined,
  txId: string,
): BaseMessageOptions {
  const color = embedColorByWebhookType[title];
  const assetFormatted = formatAsset(asset);
  const transactionExplorerUrl = generateTransactionExplorerUrl(txId);
  const embed = new EmbedBuilder()
    .setTitle(`${title}${assetFormatted} -- Algorand Network Transaction`)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: `v${version}` })
    .setThumbnail(thumbnailUrl)
    .addFields(embedFields)
    .setURL(transactionExplorerUrl);

  return { embeds: [embed] };
}
function formatAsset(asset: string | undefined): string {
  return asset ? ` (${asset})` : '';
}
function createWebHookPayload(
  title: WebhookType,
  asset: string | undefined,
  claimStatus: SendTransactionResult,
  receiver?: GuildMember,
  sender?: GuildMember,
): BaseMessageOptions | null {
  if (!receiver) {
    logger.error('No receiver for webhook');
    return null;
  }
  const webhookFields: APIEmbedField[] = [];
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
      value: claimStatus.transaction.amount.toLocaleString(),
      inline: true,
    },
  );

  return createEmbed(
    webhookFields,
    title,
    sender?.user.displayAvatarURL() ?? receiver.user.displayAvatarURL(),
    asset,
    claimStatus.transaction.txID(),
  );
}

function createWebhookFunction(webhookType: WebhookType, asset?: string): WebhookFunction {
  return (claimStatus: SendTransactionResult, receiver?: GuildMember, sender?: GuildMember) => {
    const message = createWebHookPayload(webhookType, asset, claimStatus, receiver, sender);
    if (message) {
      enqueueMessage(message);
    }
  };
}

function enqueueMessage(payload: BaseMessageOptions): void {
  webHookQueue.enqueue(payload);
}
/* istanbul ignore next */
const sendNextMessage = (): void => {
  const message = webHookQueue.dequeue();
  if (!message) {
    return;
  }
  webHookClient.send(message).catch((error: unknown) => {
    logger.error(`Error sending webhook message: ${JSON.stringify(error)}`);
  });
};
/* istanbul ignore next */
function sendQueuedMessages(): void {
  setInterval(sendNextMessage, 5000);
}
