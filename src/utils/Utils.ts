import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import {
    APIEmbedField,
    ChannelType,
    CommandInteraction,
    EmbedBuilder,
    GuildMember,
    InteractionReplyOptions,
    Message,
    MessageComponentInteraction,
    MessageContextMenuCommandInteraction,
    ModalSubmitInteraction,
} from 'discord.js';
import { randomInt } from 'node:crypto';
import { container } from 'tsyringe';

import { PropertyResolutionManager } from '../model/framework/manager/PropertyResolutionManager.js';

export class ObjectUtil {
    static {
        dayjs.extend(relativeTime);
        dayjs.extend(duration);
    }
    public static ellipseAddress(address: string = '', start: number = 5, end: number = 5): string {
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
        return string.replace(/\D/g, '');
    }

    public static delayFor(ms: number): Promise<void> {
        return new Promise(res => setTimeout(res, ms));
    }
    /**
     * Split an array into chunks of a given size
     * @param array The array to split
     * @param chunkSize The size of each chunk (default to 2)
     */
    public static chunkArray<T>(array: Array<T>, chunkSize: number = 2): Array<Array<T>> {
        const newArray: Array<Array<T>> = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            newArray.push(array.slice(i, i + chunkSize));
        }

        return newArray;
    }

    /**
     * ensures value is an array and has at least 1 item in it
     * @param array
     * @returns {array is any[]}
     */
    public static isValidArray(array: any): array is Array<any> {
        return Array.isArray(array) && array.length > 0;
    }

    /**
     * Assert argument is an object, and it has more than one key
     * @param obj
     * @returns {obj is Record<string, any>}
     */
    public static isValidObject(obj: unknown): obj is Record<string, any> {
        return (
            typeof obj === 'object' &&
            obj !== null &&
            obj !== undefined &&
            Object.keys(obj).length > 0
        );
    }
    /**
     * Ensures value(s) strings and has a size after trim
     * @param strings
     * @returns {boolean}
     */
    public static isValidString(...strings: Array<unknown>): boolean {
        if (strings.length === 0) {
            return false;
        }
        for (const currString of strings) {
            if (
                typeof currString !== 'string' ||
                currString.length === 0 ||
                currString.trim().length === 0
            ) {
                return false;
            }
        }
        return true;
    }

    public static timeAgo(date: Date): string {
        return dayjs(date).fromNow();
    }
    public static moreThanTwentyFourHoursAgo(date: number): boolean {
        return dayjs().diff(dayjs(date), 'hour') >= 24;
    }
    public static timeFromNow(ms: number): string {
        return dayjs(ms).fromNow();
    }
    public static timeToHuman(durationInMilliseconds: number): string {
        return dayjs.duration(durationInMilliseconds).humanize();
    }

    public static shuffle<T>(array: Array<T>): Array<T> {
        const arr = [...array];

        for (let i = arr.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            const temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
        return arr;
    }
    public static getRandomElement = <T>(arr: Array<T>): T | null => {
        const randomElement = arr.length ? arr[randomInt(arr.length)] : null;
        return randomElement;
    };

    public static verifyMandatoryEnvs(): void {
        const mandatoryEnvs: mandatoryEnvTypes = {
            BOT_OWNER_ID: process.env.BOT_OWNER_ID,
            BOT_TOKEN: process.env.BOT_TOKEN,
            CLAWBACK_TOKEN_MNEMONIC: process.env.CLAWBACK_TOKEN_MNEMONIC,
            DB_SERVER:
                process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.SQLITE_DB_PATH,
            ALGO_API_TOKEN: process.env.ALGO_API_TOKEN,
            NODE_ENV: process.env.NODE_ENV,
        };
        for (const [key, value] of Object.entries(mandatoryEnvs)) {
            if (value === undefined) {
                throw new Error(`Missing key ${key} in config.env`);
            }
        }
    }
}

export namespace DiscordUtils {
    export const allChannelsExceptCat = [
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread,
        ChannelType.GuildVoice,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.GuildStageVoice,
        ChannelType.GuildDirectory,
        ChannelType.GuildForum,
        ChannelType.GuildText,
    ];

    export class InteractionUtils {
        public static getMessageFromContextInteraction(
            interaction: MessageContextMenuCommandInteraction
        ): Promise<Message<true>> | Promise<Message<false>> | undefined {
            const messageId = interaction.targetId;
            return interaction.channel?.messages.fetch(messageId);
        }

        public static async replyOrFollowUp(
            interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
            replyOptions: (InteractionReplyOptions & { ephemeral?: boolean }) | string
        ): Promise<void> {
            if (interaction.replied) {
                // if interaction is already replied
                await interaction.followUp(replyOptions);
            } else if (interaction.deferred) {
                // if interaction is deferred but not replied
                await interaction.editReply(replyOptions);
            } else {
                // if interaction is not handled yet
                await interaction.reply(replyOptions);
            }
        }
        public static getInteractionCaller(
            interaction: CommandInteraction | MessageComponentInteraction
        ): GuildMember {
            const { member } = interaction;
            if (member == null) {
                InteractionUtils.replyOrFollowUp(interaction, 'Unable to extract member');
                throw new Error('Unable to extract member');
            }
            if (member instanceof GuildMember) {
                return member;
            }
            throw new Error('Unable to extract member');
        }
        /**
         * Send a simple success embed
         * @param interaction - discord interaction
         * @param message - message to log
         */
        public static async simpleSuccessEmbed(
            interaction: CommandInteraction,
            message: string
        ): Promise<void> {
            const embed = new EmbedBuilder()
                .setColor(0x57f287) // GREEN // see: https://github.com/discordjs/discord.js/blob/main/packages/discord.js/src/util/Colors.js
                .setTitle(`✅ ${message}`);

            await InteractionUtils.replyOrFollowUp(interaction, { embeds: [embed] });
        }

        /**
         * Send a simple error embed
         * @param interaction - discord interaction
         * @param message - message to log
         */
        public static async simpleErrorEmbed(
            interaction: CommandInteraction,
            message: string
        ): Promise<void> {
            const embed = new EmbedBuilder()
                .setColor(0xed4245) // RED // see: https://github.com/discordjs/discord.js/blob/main/packages/discord.js/src/util/Colors.js
                .setTitle(`❌ ${message}`);

            await InteractionUtils.replyOrFollowUp(interaction, { embeds: [embed] });
        }
    }

    /**
     * Get a curated list of devs including the owner id
     */
    export function getDevs(): Array<string> {
        const propertyResolutionManager = container.resolve(PropertyResolutionManager);

        const botOwnerId = propertyResolutionManager.getProperty('BOT_OWNER_ID') as string;
        return [...new Set([botOwnerId])];
    }
    /**
     * Check if a given user is a dev with its ID
     * @param id Discord user id
     */
    export function isDev(id: string): boolean {
        return getDevs().includes(id);
    }
}
