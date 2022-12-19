import { GuildMember, WebhookClient } from 'discord.js';
import { Client } from 'discordx';
import type { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import type * as Transport from 'winston-transport';

import { webHookTypes } from '../../enums/dtEnums.js';

const webhook = new Map<string, WebhookClient>();
const nextLogMsg = new Map<string, string>();

class LoggerFactory {
    private readonly _logger: Logger;

    public constructor() {
        const { combine, splat, timestamp, printf } = format;

        const myFormat = printf(({ level: l, message: m, timestamp: t, ...metadata }) => {
            let msg = `⚡ ${t} [${l}] : ${m} `;
            if (metadata && JSON.stringify(metadata) !== '{}') {
                msg += JSON.stringify(metadata);
            }
            return msg;
        });

        const transportsArray: Transport[] = [
            new transports.Console({
                level: 'debug',
                format: combine(format.colorize(), splat(), timestamp(), myFormat),
            }),
        ];

        this._logger = createLogger({
            level: 'debug',
            transports: transportsArray,
            handleExceptions: true,
            handleRejections: true,
            exitOnError: false,
        });
    }

    public get logger(): Logger {
        return this._logger;
    }
}

export function claimKarmaWebHook(claimer: GuildMember, value: string, url?: string): void {
    // Set the Message
    const webhookMsg = `**${claimer.user.tag}** (${claimer.id}) Claimed **${value}** KARMA\n URL: ${
        url || 'No URL'
    }\n`;
    const logType = webHookTypes.claim;
    queMsg(webhookMsg, logType);
}
export function karmaTipWebHook(
    tipSender: GuildMember,
    tipReceiver: GuildMember,
    value: string,
    url?: string
): void {
    // Set the Message
    const webhookMsg = `**${tipSender.user.tag}** (${tipSender.id}) Sent **${value}** KARMA to **${
        tipReceiver.user.tag
    }** (${tipReceiver.id})\n URL: ${url || 'No URL'}\n`;
    const logType = webHookTypes.tip;
    queMsg(webhookMsg, logType);
}
function queMsg(msg: string, logType: webHookTypes): void {
    if (!nextLogMsg.get(logType)) {
        nextLogMsg.set(logType, msg);
    } else {
        nextLogMsg.set(logType, nextLogMsg.get(logType) + msg);
    }
}

export async function getWebhooks(client?: Client): Promise<void> {
    // Check to make sure webhooks are set
    const transActionWebhook = process.env.TRANSACTION_WEBHOOK;
    const tipWebhook = process.env.TIP_WEBHOOK;
    if (transActionWebhook == undefined) {
        logger.error('No TRANSACTION webhook set');
    }
    if (tipWebhook == undefined) {
        logger.error('No TIP webhook set');
    }

    if (client) {
        if (transActionWebhook) {
            webhook.set(
                webHookTypes.claim,
                new WebhookClient({
                    url: process.env.TRANSACTION_WEBHOOK,
                })
            );
        }
        if (tipWebhook) {
            webhook.set(
                webHookTypes.tip,
                new WebhookClient({
                    url: process.env.TIP_WEBHOOK,
                })
            );
        }
        if (transActionWebhook || tipWebhook) runLogs();
    }
}

function runLogs(): void {
    setInterval(() => {
        webhook.forEach((v, k) => {
            const msg = nextLogMsg.get(k);

            if (msg != '' && msg) {
                v.send({ content: msg });
                nextLogMsg.set(k, '');
            }
        });
    }, 5000);
}

const logger = new LoggerFactory().logger;
export default logger;
