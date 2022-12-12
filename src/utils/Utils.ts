import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import {
    APIEmbedField,
    ChannelType,
    CommandInteraction,
    EmbedBuilder,
    Guild,
    GuildMember,
    InteractionReplyOptions,
    Message,
    MessageComponentInteraction,
    MessageContextMenuCommandInteraction,
    Sticker,
    StickerFormatType,
    User,
} from 'discord.js';
import { Client } from 'discordx';
import { StatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';

import TIME_UNIT from '../enums/TIME_UNIT.js';
import { Property } from '../model/framework/decorators/Property.js';
import { Typeings } from '../model/Typeings.js';

export class ObjectUtil {
    static {
        dayjs.extend(relativeTime);
    }
    /**
     * Ensures value(s) strings and has a size after trim
     * @param strings
     * @returns {boolean}
     */
    public static validString(...strings: Array<unknown>): boolean {
        if (strings.length === 0) {
            return false;
        }
        for (const currString of strings) {
            if (typeof currString !== 'string') {
                return false;
            }
            if (currString.length === 0) {
                return false;
            }
            if (currString.trim().length === 0) {
                return false;
            }
        }
        return true;
    }
    public static ellipseAddress(address: string = '', start: number = 5, end: number = 5): string {
        return `${address.slice(0, start)}...${address.slice(-end)}`;
    }

    public static truncate(str: string, limit: number): string {
        return str.length > limit ? `${str.substring(0, limit - 3)}...` : str;
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
    public static chunkArray<T>(array: T[], chunkSize: number = 2): T[][] {
        const newArray: T[][] = [];
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
    public static isValidArray(array: any): array is any[] {
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
    public static timeAgo(date: Date): string {
        return dayjs(date).fromNow();
    }
    public static moreThanTwentyFourHoursAgo(date: number): boolean {
        return dayjs().diff(dayjs(date), 'hour') >= 24;
    }
    public static timeFromNow(ms: number): string {
        return dayjs(ms).fromNow();
    }

    public static convertToMilli(value: number, unit: TIME_UNIT): number {
        switch (unit) {
            case TIME_UNIT.seconds:
                return value * 1000;
            case TIME_UNIT.minutes:
                return value * 60000;
            case TIME_UNIT.hours:
                return value * 3600000;
            case TIME_UNIT.days:
                return value * 86400000;
            case TIME_UNIT.weeks:
                return value * 604800000;
            case TIME_UNIT.months:
                return value * 2629800000;
            case TIME_UNIT.years:
                return value * 31556952000;
            case TIME_UNIT.decades:
                return value * 315569520000;
        }
    }

    public static timeToHuman(value: number, timeUnit: TIME_UNIT = TIME_UNIT.milliseconds): string {
        let seconds: number;
        if (timeUnit === TIME_UNIT.milliseconds) {
            seconds = Math.round(value / 1000);
        } else if (timeUnit !== TIME_UNIT.seconds) {
            seconds = Math.round(ObjectUtil.convertToMilli(value, timeUnit) / 1000);
        } else {
            seconds = Math.round(value);
        }
        if (Number.isNaN(seconds)) {
            throw new Error('Unknown error');
        }
        const levels: [number, string][] = [
            [Math.floor(seconds / 31536000), 'years'],
            [Math.floor((seconds % 31536000) / 86400), 'days'],
            [Math.floor(((seconds % 31536000) % 86400) / 3600), 'hours'],
            [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'minutes'],
            [(((seconds % 31536000) % 86400) % 3600) % 60, 'seconds'],
        ];
        let returnText = '';

        for (let i = 0, max = levels.length; i < max; i++) {
            if (levels[i][0] === 0) {
                continue;
            }
            returnText += ` ${levels[i][0]} ${
                levels[i][0] === 1 ? levels[i][1].substr(0, levels[i][1].length - 1) : levels[i][1]
            }`;
        }
        return returnText.trim();
    }

    public static removeObjectFromArray<T>(itemToRemove: T, arr: T[]): void {
        let arrLen = arr.length;
        while (arrLen--) {
            const currentItem = arr[arrLen];
            if (itemToRemove === currentItem) {
                arr.splice(arrLen, 1);
            }
        }
    }

    public static getUrls(str: string): Set<string> {
        const regexp =
            /(http(s)?:\/\/.)(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/gim;
        const matches = str.match(regexp);
        if (!ObjectUtil.isValidArray(matches)) {
            return new Set();
        }
        return new Set(matches);
    }

    public static guid(): string {
        function s4(): string {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

        return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
    }

    public static getAmountOfCapsAsPercentage(valueCheck: string): number {
        if (!ObjectUtil.validString(valueCheck)) {
            return 0;
        }

        function isUpper(str: string): boolean {
            return !/[a-z]/.test(str) && /[A-Z]/.test(str);
        }

        valueCheck = valueCheck.trim();
        valueCheck = valueCheck.replace(/\s/g, '');
        const stringLength = valueCheck.length;
        const amountOfCaps = valueCheck.split('').filter(char => isUpper(char)).length;
        return Math.floor((amountOfCaps * 100) / stringLength);
    }
}

export namespace DiscordUtils {
    import envTypes = Typeings.envTypes;
    import EmojiInfo = Typeings.EmojiInfo;
    import StickerInfo = Typeings.StickerInfo;

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
        @Property('NODE_ENV')
        private static readonly environment: envTypes['NODE_ENV'];

        public static getMessageFromContextInteraction(
            interaction: MessageContextMenuCommandInteraction
        ): Promise<Message | undefined> {
            const messageId = interaction.targetId;
            return interaction.channel.messages.fetch(messageId);
        }

        public static async replyOrFollowUp(
            interaction: CommandInteraction | MessageComponentInteraction,
            replyOptions: (InteractionReplyOptions & { ephemeral?: boolean }) | string
        ): Promise<void> {
            // if interaction is already replied
            if (interaction.replied) {
                await interaction.followUp(replyOptions);
                return;
            }

            // if interaction is deferred but not replied
            if (interaction.deferred) {
                await interaction.editReply(replyOptions);
                return;
            }

            // if interaction is not handled yet
            await interaction.reply(replyOptions);
        }

        public static getInteractionCaller(
            interaction: CommandInteraction | MessageComponentInteraction
        ): GuildMember | null {
            const { member } = interaction;
            if (member == null) {
                InteractionUtils.replyOrFollowUp(interaction, 'Unable to extract member');
                throw new Error('Unable to extract member');
            }
            if (member instanceof GuildMember) {
                return member;
            }
            return null;
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

    export function getGuild(guildId: string): Promise<Guild | null> {
        const client = container.resolve(Client);
        return client.guilds.fetch(guildId);
    }

    export function sanitiseString(str: string): string {
        return str ?? 'None';
    }

    export function getAccountAge(
        user: User | GuildMember,
        format: boolean = false
    ): number | string {
        if (user instanceof GuildMember) {
            user = user.user;
        }
        const createdDate = user.createdAt.getTime();
        const accountAge = Date.now() - createdDate;
        if (format) {
            return ObjectUtil.timeToHuman(accountAge);
        } else {
            return accountAge;
        }
    }

    export function stripUrls(message: Message | string): string {
        const regexp =
            /(http(s)?:\/\/.)(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/gm;
        let retStr = typeof message === 'string' ? message : message.content;
        retStr = `${retStr}`;
        if (!ObjectUtil.validString(retStr)) {
            return retStr;
        }
        const matches = retStr.match(regexp);
        if (!matches) {
            return retStr;
        }
        for (const match of matches) {
            retStr = retStr.replace(match, '');
        }
        return retStr.trim();
    }

    export function removeMentions(str: string): string {
        return str.replace(/<@.?[0-9]*?>/gm, '');
    }

    export async function loadResourceFromURL(url: string): Promise<Buffer> {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer: Buffer = Buffer.from(arrayBuffer);
        if (response.status !== StatusCodes.OK) {
            throw new Error(buffer.toString('utf-8'));
        }
        return buffer;
    }

    export async function getStickerInfo(
        sticker: Sticker,
        includeBuffer: boolean = true
    ): Promise<StickerInfo> {
        const { url, format, id } = sticker;
        const retObj: StickerInfo = {
            url,
            id,
        };
        if (!includeBuffer) {
            return retObj;
        }
        if (format === StickerFormatType.Lottie) {
            retObj['buffer'] = Buffer.from(url, 'utf8');
        } else {
            try {
                retObj['buffer'] = await DiscordUtils.loadResourceFromURL(url);
            } catch {
                // ignore
            }
        }
        return retObj;
    }

    export async function getEmojiInfo(
        emojiId: string,
        includeBuffer: boolean = true
    ): Promise<EmojiInfo> {
        let emojiInfo: EmojiInfo = null;
        const tryExtensions = ['gif', 'png'];
        for (let i = 0; i < tryExtensions.length; i++) {
            const ext = tryExtensions[i];
            const url = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}`;
            try {
                const emojiImageBuffer = await DiscordUtils.loadResourceFromURL(url);
                if (emojiImageBuffer.length > 0) {
                    emojiInfo = {
                        url: url,
                        id: emojiId,
                    };
                    if (includeBuffer) {
                        emojiInfo['buffer'] = emojiImageBuffer;
                    }
                    break;
                }
            } catch {
                // ignore
            }
            if (!emojiInfo) {
                throw new Error('Error finding emoji');
            }
            return emojiInfo;
        }
    }
    /**
     * Get a curated list of devs including the owner id
     */
    export function getDevs(): string[] {
        return [...new Set([process.env.BOT_OWNER_ID])];
    }

    /**
     * Check if a given user is a dev with its ID
     * @param id Discord user id
     */
    export function isDev(id: string): boolean {
        return getDevs().includes(id);
    }

    export class EnumEx {
        public static getNamesAndValues<T extends number>(e: any): Array<unknown> {
            return EnumEx.getNames(e).map(n => ({ name: n, value: e[n] as T }));
        }

        /**
         * get the numValue associated with its own key. if you want to get a TypeScript Enum based on an index you can use this
         * @param e
         * @param aName
         * @param asValue
         * @returns {string|null}
         */
        public static loopBack<T>(e: any, aName: any, asValue: boolean = false): T {
            const keyValuePair: Array<{ name: T; value: any }> = EnumEx.getNamesAndValues(
                e
            ) as Array<{
                name: T;
                value: any;
            }>;
            for (let i = 0; i < keyValuePair.length; i++) {
                const obj: { name: T; value: any } = keyValuePair[i];
                if (asValue) {
                    if (obj.value === aName) {
                        return obj.value;
                    }
                } else if (obj.name === aName) {
                    return obj.name;
                }
            }
            return null;
        }

        public static getNames(e: any): Array<string> {
            return Object.keys(e);
        }

        private static getObjValues(e: any): Array<number | string> {
            return Object.keys(e).map(k => e[k]);
        }
    }
}
