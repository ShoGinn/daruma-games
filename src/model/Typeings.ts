import type { CategoryChannel, HexColorString, Message, TextChannel } from 'discord.js';
import { ThreadAutoArchiveDuration } from 'discord.js';
import type { ArgsOf, Awaitable, Client } from 'discordx';

export namespace Typeings {
    export type propTypes = envTypes & packageJsonTypes;
    export type envTypes = {
        BOT_OWNER_ID: string;
        BOT_TOKEN: string;
        CLAWBACK_TOKEN_MNEMONIC: string;
        CLAIM_TOKEN_MNEMONIC: string;
        TEST_TOKEN: string;
        MYSQL_URL: string;
        MIKRO_ORM_DEBUG: string;
        ALGO_API_TOKEN: string;
        ALGOD_SERVER: string;
        ALGOD_PORT: string;
        INDEXER_SERVER: string;
        INDEXER_PORT: string;
        IPFS_GATEWAY: string;
        TENOR_API_KEY: string;
        NODE_ENV: 'production' | 'development';
    };
    export type mandatoryEnvTypes = {
        BOT_OWNER_ID: string;
        BOT_TOKEN: string;
        CLAWBACK_TOKEN_MNEMONIC: string;
        MYSQL_URL: string;
        ALGO_API_TOKEN: string;
        NODE_ENV: string;
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

    /**
     * NFDProperties contains the expanded metadata stored within an NFD contracts' global-state
     * @export
     * @interface NFDProperties
     */
    export interface NFDProperties {
        /**
         * Internal properties
         * @type {{ [key: string]: string; }}
         * @memberof NFDProperties
         */
        internal?: { [key: string]: string };
        /**
         * User properties
         * @type {{ [key: string]: string; }}
         * @memberof NFDProperties
         */
        userDefined?: { [key: string]: string };
        /**
         * Verified properties
         * @type {{ [key: string]: string; }}
         * @memberof NFDProperties
         */
        verified?: { [key: string]: string };
    }
    /**
     *
     * @export
     * @interface NfdRecord
     */
    export interface NfdRecord {
        /**
         * NFD Application ID
         * @type {number}
         * @memberof NfdRecord
         */
        appID?: number;
        /**
         * NFD ASA ID
         * @type {number}
         * @memberof NfdRecord
         */
        asaID?: number;
        /**
         * Whether the verified Avatar set in this NFD is newer (arc19) then is set into the NFD. This will only be present on direct NFD fetch and if true
         * @type {boolean}
         * @memberof NfdRecord
         */
        avatarOutdated?: boolean;
        /**
         * Verified Algorand addresses for this NFD
         * @type {Array<string>}
         * @memberof NfdRecord
         */
        caAlgo?: Array<string>;
        /**
         *
         * @type {string}
         * @memberof NfdRecord
         */
        category?: NfdRecordCategoryEnum;
        /**
         * Round this data was last fetched from
         * @type {number}
         * @memberof NfdRecord
         */
        currentAsOfBlock?: number;
        /**
         * account wallets should send funds to - precedence is: caAlgo[0], unverifiedCaAlgo[0], owner
         * @type {string}
         * @memberof NfdRecord
         */
        depositAccount?: string;
        /**
         * Not returned, used in tagging for response to indicate if-none-match etag matched
         * @type {string}
         * @memberof NfdRecord
         */
        matchCheck?: string;
        /**
         * Tags set by the system for tracking/analytics
         * @type {Array<string>}
         * @memberof NfdRecord
         */
        metaTags?: Array<string>;
        /**
         *
         * @type {string}
         * @memberof NfdRecord
         */
        name: string;
        /**
         *
         * @type {string}
         * @memberof NfdRecord
         */
        nfdAccount?: string;
        /**
         * Owner of NFD
         * @type {string}
         * @memberof NfdRecord
         */
        owner?: string;
        /**
         *
         * @type {NFDProperties}
         * @memberof NfdRecord
         */
        properties?: NFDProperties;
        /**
         * Reserved owner of NFD
         * @type {string}
         * @memberof NfdRecord
         */
        reservedFor?: string;
        /**
         *
         * @type {string}
         * @memberof NfdRecord
         */
        saleType?: NfdRecordSaleTypeEnum;
        /**
         * amount NFD is being sold for (microAlgos)
         * @type {number}
         * @memberof NfdRecord
         */
        sellAmount?: number;
        /**
         * Recipient of NFD sales
         * @type {string}
         * @memberof NfdRecord
         */
        seller?: string;
        /**
         *
         * @type {string}
         * @memberof NfdRecord
         */
        sigNameAddress?: string;
        /**
         *
         * @type {string}
         * @memberof NfdRecord
         */
        state?: NfdRecordStateEnum;
        /**
         * Tags assigned to this NFD
         * @type {Array<string>}
         * @memberof NfdRecord
         */
        tags?: Array<string>;
        /**
         *
         * @type {Date}
         * @memberof NfdRecord
         */
        timeChanged?: Date;
        /**
         *
         * @type {Date}
         * @memberof NfdRecord
         */
        timeCreated?: Date;
        /**
         *
         * @type {Date}
         * @memberof NfdRecord
         */
        timePurchased?: Date;
        /**
         * Unverified (non-algo) Crypto addresses for this NFD
         * @type {{ [key: string]: Array<string>; }}
         * @memberof NfdRecord
         */
        unverifiedCa?: { [key: string]: Array<string> };
        /**
         * Unverified Algorand addresses for this NFD
         * @type {Array<string>}
         * @memberof NfdRecord
         */
        unverifiedCaAlgo?: Array<string>;
    }

    /**
     * @export
     * @enum {string}
     */
    export enum NfdRecordCategoryEnum {
        Curated = 'curated',
        Premium = 'premium',
        Common = 'common',
    }
    /**
     * @export
     * @enum {string}
     */
    export enum NfdRecordSaleTypeEnum {
        Auction = 'auction',
        BuyItNow = 'buyItNow',
    }
    /**
     * @export
     * @enum {string}
     */
    export enum NfdRecordStateEnum {
        Available = 'available',
        Minting = 'minting',
        Reserved = 'reserved',
        ForSale = 'forSale',
        Owned = 'owned',
    }
}
