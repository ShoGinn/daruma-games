import type { CategoryChannel, HexColorString, Message, TextChannel } from 'discord.js';
import { ThreadAutoArchiveDuration } from 'discord.js';
import type { ArgsOf, Awaitable, Client } from 'discordx';

export namespace Typeings {
    export type propTypes = envTypes & packageJsonTypes;
    export type envTypes = {
        BOT_TOKEN: string;
        BOT_OWNER_ID: string;
        TEST_TOKEN: string;
        MYSQL_URL: string;
        NODE_ENV: 'production' | 'development';
    };

    type packageJsonTypes = {
        name?: string;
        version?: string;
        description?: string;
        type?: string;
        main?: string;
        scripts?: { [key: string]: string };
        repository?: {
            type?: string;
            url?: string;
        };
        author?: string;
        license?: string;
        bugs?: {
            url?: string;
        };
        dependencies?: { [key: string]: string };
        homepage?: string;
        devDependencies?: { [key: string]: string };
    };

    export type UpdateCommandSettings = {
        roles: string[];
        enabled: boolean;
    };

    export type ObjectChange<T> = {
        before: T;
        after: T;
    };

    export type EventSecurityConstraintType = {
        allowedChannels?: string[];
        allowedRoles?: string[];
        ignoredChannels?: string[];
        ignoredRoles?: string[];
    };

    export type EditType = (
        [message]: ArgsOf<'messageCreate'>,
        client: Client,
        guardPayload: any,
        isUpdate: boolean
    ) => Promise<void>;
    export type EventTriggerCondition = (message: Message) => Awaitable<boolean>;

    export type EmojiInfo = {
        buffer?: Buffer;
        url: string;
        id: string;
    };

    export type StickerInfo = EmojiInfo;

    export type RoleChange = {
        permissions?: ObjectChange<Array<string>>;
        nameChange?: ObjectChange<string>;
        colourChange?: ObjectChange<HexColorString>;
        iconChange?: ObjectChange<string>;
        hoist?: ObjectChange<boolean>;
    };

    export type ChannelUpdate = {
        name?: ObjectChange<string>;
        topic?: ObjectChange<string>;
        slowMode?: ObjectChange<number>;
        nsfw?: ObjectChange<boolean>;
        parent?: ObjectChange<CategoryChannel>;
    };

    export type GuildUpdate = {
        banner?: ObjectChange<string>;
        rulesChannel?: ObjectChange<TextChannel>;
        splash?: ObjectChange<string>;
        description?: ObjectChange<string>;
        discoverySplash?: ObjectChange<string>;
        icon?: ObjectChange<string>;
        vanityURLCode?: ObjectChange<string>;
        name?: ObjectChange<string>;
    };

    export type ThreadUpdate = {
        archived?: ObjectChange<boolean>;
        type?: ObjectChange<'Public' | 'Private' | null>;
        locked?: ObjectChange<boolean>;
        name?: ObjectChange<string>;
        slowMode?: ObjectChange<number>;
        archiveDuration?: ObjectChange<ThreadAutoArchiveDuration | null>;
    };

    export type MemberUpdate = {
        nickName?: ObjectChange<string>;
        timeout?: ObjectChange<number>;
    };
}
