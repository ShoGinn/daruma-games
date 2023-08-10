import type { mandatoryEnvironmentTypes } from '../model/types/generic.js';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import {
    APIEmbedField,
    CommandInteraction,
    EmbedBuilder,
    Guild,
    GuildMember,
    InteractionReplyOptions,
    InteractionResponse,
    Message,
    MessageComponentInteraction,
    MessageContextMenuCommandInteraction,
    ModalSubmitInteraction,
    TextChannel,
} from 'discord.js';
import { Client } from 'discordx';
import { randomInt } from 'node:crypto';
import { container } from 'tsyringe';

import logger from './functions/logger-factory.js';
import { PropertyResolutionManager } from '../model/framework/manager/property-resolution-manager.js';

export class ObjectUtil {
    static {
        dayjs.extend(relativeTime);
        dayjs.extend(duration);
    }
    public static ellipseAddress(
        address: string | null = '',
        start: number = 5,
        end: number = 5
    ): string {
        if (!address) {
            return '';
        }
        if (address.length <= start + end) {
            return address;
        }
        start = Math.min(start, address.length);
        end = Math.min(end, address.length - start);
        return `${address.slice(0, start)}...${address.slice(-end)}`;
    }

    public static singleFieldBuilder(
        name: string,
        value: string,
        inline: boolean = false
    ): [APIEmbedField] {
        return [
            {
                name,
                value,
                inline,
            },
        ];
    }
    public static onlyDigits(string: string): string {
        return string.replaceAll(/\D/g, '');
    }

    public static delayFor(ms: number): Promise<void> {
        return new Promise(result => setTimeout(result, ms));
    }
    public static async randomDelayFor(minDelay: number, maxDelay: number): Promise<void> {
        const delay =
            minDelay === maxDelay ? minDelay : randomInt(Math.min(minDelay, maxDelay), maxDelay);
        await ObjectUtil.delayFor(delay);
    }

    /**
     * Converts a bigint or number to a number with the specified number of decimal places.
     *
     * @param {bigint|number} integer - The number to convert. If a `bigint` is passed, it will be divided by 10^`decimals`.
     * @param {number} decimals - The number of decimal places for the result. If `decimals` is 0, the integer will not be divided.
     * @returns {number} - The converted number.
     */

    public static convertBigIntToNumber(integer: bigint | number, decimals: number): number {
        if (typeof integer === 'number') {
            return integer;
        }
        if (typeof integer === 'bigint') {
            if (decimals === 0 || integer === BigInt(0)) {
                return Number.parseInt(integer.toString());
            }
            const singleUnit = BigInt(`1${'0'.repeat(decimals)}`);
            const wholeUnits = integer / singleUnit;

            return Number.parseInt(wholeUnits.toString());
        }
        throw new Error('Invalid type passed to convertBigIntToNumber');
    }

    public static timeAgo(date: dayjs.ConfigType): string {
        return dayjs(date).fromNow();
    }
    public static moreThanTwentyFourHoursAgo(date: dayjs.ConfigType): boolean {
        return dayjs().diff(dayjs(date), 'hour') >= 24;
    }
    public static timeFromNow(durationInMilliseconds: dayjs.ConfigType): string {
        return dayjs(durationInMilliseconds).fromNow();
    }
    public static timeToHuman(durationInMilliseconds: number): string {
        return dayjs.duration(durationInMilliseconds).humanize();
    }

    public static verifyMandatoryEnvs(): void {
        const mandatoryEnvironments: mandatoryEnvironmentTypes = {
            ADMIN_CHANNEL_ID: process.env.ADMIN_CHANNEL_ID,
            BOT_OWNER_ID: process.env.BOT_OWNER_ID,
            BOT_TOKEN: process.env.BOT_TOKEN,
            CLAWBACK_TOKEN_MNEMONIC: process.env.CLAWBACK_TOKEN_MNEMONIC,
            DB_SERVER:
                process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.SQLITE_DB_PATH,
            NODE_ENV: process.env.NODE_ENV,
        };
        for (const [key, value] of Object.entries(mandatoryEnvironments)) {
            if (value === undefined) {
                throw new Error(`Missing key ${key} in config.env`);
            }
        }
    }
}

export class InteractionUtils {
    public static getMessageFromContextInteraction(
        interaction: MessageContextMenuCommandInteraction
    ): Promise<Message<boolean>> | undefined {
        const messageId = interaction.targetId;
        return interaction.channel?.messages.fetch(messageId);
    }

    public static async replyOrFollowUp(
        interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
        replyOptions: (InteractionReplyOptions & { ephemeral?: boolean }) | string
    ): Promise<InteractionResponse<boolean> | Message<boolean>> {
        if (interaction.replied) {
            // if interaction is already replied
            return await interaction.followUp(replyOptions);
        } else if (interaction.deferred) {
            // if interaction is deferred but not replied
            return await interaction.editReply(replyOptions);
        } else {
            // if interaction is not handled yet
            return await interaction.reply(replyOptions);
        }
    }
    public static async getInteractionCaller(
        interaction: CommandInteraction | MessageComponentInteraction
    ): Promise<GuildMember> {
        const { member } = interaction;
        if (member == undefined) {
            await InteractionUtils.replyOrFollowUp(interaction, 'Unable to extract member');
            throw new Error('Unable to extract member');
        }
        if (member instanceof GuildMember) {
            return member;
        }
        throw new Error('Unable to extract member');
    }
    public static simpleSuccessEmbed = async (
        interaction: CommandInteraction,
        message: string
    ): Promise<Message<boolean>> => {
        const embed = new EmbedBuilder().setColor('Green').setTitle(`✅ ${message}`);

        return (await InteractionUtils.replyOrFollowUp(interaction, {
            embeds: [embed],
            fetchReply: true,
        })) as Message<boolean>;
    };

    public static simpleErrorEmbed = async (
        interaction: CommandInteraction,
        message: string
    ): Promise<Message<boolean>> => {
        const embed = new EmbedBuilder().setColor('Red').setTitle(`❌ ${message}`);

        return (await InteractionUtils.replyOrFollowUp(interaction, {
            embeds: [embed],
            fetchReply: true,
        })) as Message<boolean>;
    };
}

/**
 * Get the list of devs
 *
 * @returns {*}  {Array<string>}
 */
export function getDevelopers(): Array<string> {
    const propertyResolutionManager = container.resolve(PropertyResolutionManager);

    const botOwnerId = propertyResolutionManager.getProperty('BOT_OWNER_ID') as string;
    return [...new Set([botOwnerId])];
}

/**
 * Check if the user is a dev
 *
 * @param {string} id
 * @returns {*}  {boolean}
 */
export function isDeveloper(id: string): boolean {
    return getDevelopers().includes(id);
}

export async function fetchGuild(guildId: string, client: Client): Promise<Guild | null> {
    try {
        return await client.guilds.fetch(guildId);
    } catch (error) {
        logger.error(`Error fetching guild ${guildId}: ${JSON.stringify(error)}`);
        return null;
    }
}
export function getAdminChannel(): string {
    const propertyResolutionManager = container.resolve(PropertyResolutionManager);
    return propertyResolutionManager.getProperty('ADMIN_CHANNEL_ID') as string;
}
export async function sendMessageToAdminChannel(message: string, client: Client): Promise<boolean> {
    // Find the admin channel by iterating through all the guilds
    const adminChannel = getAdminChannel();
    const guilds = client.guilds.cache;
    for (const guild of guilds.values()) {
        const channel = guild.channels.cache.get(adminChannel);
        if (channel) {
            await (channel as TextChannel).send(message);
            return true;
        }
        return false;
    }
    return false;
}
