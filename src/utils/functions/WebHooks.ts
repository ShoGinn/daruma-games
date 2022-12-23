import {
    APIEmbedField,
    BaseMessageOptions,
    EmbedBuilder,
    GuildMember,
    WebhookClient,
} from 'discord.js';
import { Client } from 'discordx';

import { webHookTypes } from '../../enums/dtEnums.js';
import logger from './LoggerFactory.js';

const webhook = new Map<webHookTypes, WebhookClient>();
const nextLogMsg = new Map<webHookTypes, BaseMessageOptions[]>();

function webhookEmbedBuilder(
    preTitle: string,
    url: string = 'https://algoexplorer.io/',
    thumbNail: string,
    fields: APIEmbedField[]
): BaseMessageOptions {
    const embed = new EmbedBuilder()
        .setTitle(`${preTitle} KARMA Transaction`)
        // set color gold if claimed, blue if tipped
        .setColor(preTitle === 'Claimed' ? 0xffd700 : 0x0000ff)
        .setTimestamp()
        .setFooter({ text: 'KARMA' });
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

    const logType = webHookTypes.claim;
    queMsg(webHookEmbed, logType);
}
export function karmaTipWebHook(
    tipSender: GuildMember,
    tipReceiver: GuildMember,
    value: string,
    url?: string
): void {
    // Set the Message
    const logType = webHookTypes.tip;
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
    queMsg(webHookEmbed, logType);
}
function queMsg(msg: BaseMessageOptions, logType: webHookTypes): void {
    let msgArr = [];
    if (!nextLogMsg.get(logType)) {
        msgArr.push(msg);
    } else {
        // insert the new message into the array
        msgArr = nextLogMsg.get(logType);
        msgArr.push(msg);
    }
    nextLogMsg.set(logType, msgArr);
}

export async function getWebhooks(client?: Client): Promise<void> {
    // Check to make sure webhooks are set
    const transActionWebhook = process.env.TRANSACTION_WEBHOOK;
    if (transActionWebhook == undefined) {
        logger.error('No TRANSACTION webhook set');
    }

    if (client) {
        if (transActionWebhook) {
            webhook.set(
                webHookTypes.claim,
                new WebhookClient({
                    url: transActionWebhook,
                })
            );
            webhook.set(
                webHookTypes.tip,
                new WebhookClient({
                    url: transActionWebhook,
                })
            );
        }
        if (transActionWebhook) runLogs();
    }
}

function runLogs(): void {
    setInterval(() => {
        webhook.forEach((v, k) => {
            const msg = nextLogMsg.get(k);
            if (!msg) return;
            // iterate through the array and send the messages
            msg.forEach(m => {
                // use timeout to queue the messages
                setTimeout(() => {
                    v.send(m);
                    // remove the message from the array
                    msg.shift();
                }, 1000);
            });
        });
    }, 5000);
}
