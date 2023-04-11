export interface NFDRecordsByWallet {
    [wallet: string]: NFDRecord[];
}
/**
 * Contains the expanded metadata stored within an NFD contract's global-state.
 *
 * @interface NFDProperties
 */
interface NFDProperties {
    /**
     * A dictionary of internal properties.
     *
     * @type {Record<string, string>}
     * @memberof NFDProperties
     */
    internal?: Record<string, string>;
    /**
     * A dictionary of user-defined properties.
     *
     * @type {Record<string, string>}
     * @memberof NFDProperties
     */
    userDefined?: Record<string, string>;
    /**
     * A dictionary of verified properties.
     *
     * @type {Record<string, string>}
     * @memberof NFDProperties
     */
    verified?: Record<string, string>;
}
/**
 * Represents an NFD record with expanded metadata stored within an NFD contract's global state.
 *
 * @interface NFDRecord
 */
export interface NFDRecord {
    /**
     * The NFD Application ID.
     *
     * @type {number}
     */
    appID?: number;
    /**
     * The NFD ASA ID.
     *
     * @type {number}
     */
    asaID?: number;
    /**
     * Indicates whether the verified Avatar set in this NFD is newer (arc19) than what is set into the NFD.
     * This property will only be present on direct NFD fetch and if true.
     *
     * @type {boolean}
     */
    avatarOutdated?: boolean;
    /**
     * The verified Algorand addresses for this NFD.
     *
     * @type {Array<string>}
     */
    caAlgo?: Array<string>;
    /**
     * The category of the NFD record.
     *
     * @type {NFDRecordCategoryEnum}
     */
    category?: NFDRecordCategoryEnum;
    /**
     * The round this data was last fetched from.
     *
     * @type {number}
     */
    currentAsOfBlock?: number;
    /**
     * The account wallets should send funds to - precedence is: caAlgo[0], unverifiedCaAlgo[0], owner.
     *
     * @type {string}
     */
    depositAccount?: string;
    /**
     * A tag used in the response to indicate whether the if-none-match etag matched or not.
     *
     * @type {string}
     */
    matchCheck?: string;
    /**
     * The tags set by the system for tracking/analytics.
     *
     * @type {Array<string>}
     */
    metaTags?: Array<string>;
    /**
     * The name of the NFD.
     *
     * @type {string}
     */
    name: string;
    /**
     * The Algorand address of the NFD.
     *
     * @type {string}
     */
    nfdAccount?: string;
    /**
     * The owner of the NFD.
     *
     * @type {string}
     */
    owner?: string;
    /**
     * The NFD properties.
     *
     * @type {NFDProperties}
     */
    properties?: NFDProperties;
    /**
     * The reserved owner of the NFD.
     *
     * @type {string}
     */
    reservedFor?: string;
    /**
     * The sale type of the NFD.
     *
     * @type {NFDRecordSaleTypeEnum}
     */
    saleType?: NFDRecordSaleTypeEnum;
    /**
     * The amount the NFD is being sold for (microAlgos).
     *
     * @type {number}
     */
    sellAmount?: number;
    /**
     * The recipient of NFD sales.
     *
     * @type {string}
     */
    seller?: string;
    /**
     * The signature name and address.
     *
     * @type {string}
     */
    sigNameAddress?: string;
    /**
     * The state of the NFD.
     *
     * @type {NFDRecordStateEnum}
     */
    state?: NFDRecordStateEnum;
    /**
     * The tags assigned to this NFD.
     *
     * @type {Array<string>}
     */
    tags?: Array<string>;
    /**
     * The date and time this NFD record was last changed.
     *
     * @type {Date}
     */
    timeChanged?: Date;
    /**
     * The timestamp when the NFD was created.
     *
     * @type {Date|undefined}
     * @memberof NFDRecord
     */
    timeCreated?: Date;
    /**
     * The timestamp when the NFD was purchased.
     *
     * @type {Date|undefined}
     * @memberof NFDRecord
     */
    timePurchased?: Date;
    /**
     * Unverified (non-Algorand) crypto addresses associated with this NFD.
     *
     * @type {Record<string, string[]>|undefined}
     * @memberof NFDRecord
     * @default undefined
     */
    unverifiedCa?: {
        [key: string]: string[];
    };
    /**
     * Unverified Algorand addresses associated with this NFD.
     *
     * @type {Array<string>|undefined}
     * @memberof NFDRecord
     */
    unverifiedCaAlgo?: Array<string>;
}

/**
 *
 * @enum {string}
 */
enum NFDRecordCategoryEnum {
    Curated = 'curated',
    Premium = 'premium',
    Common = 'common',
}
/**
 *
 * @enum {string}
 */
enum NFDRecordSaleTypeEnum {
    Auction = 'auction',
    BuyItNow = 'buyItNow',
}
/**
 *
 * @enum {string}
 */
enum NFDRecordStateEnum {
    Available = 'available',
    Minting = 'minting',
    Reserved = 'reserved',
    ForSale = 'forSale',
    Owned = 'owned',
}
