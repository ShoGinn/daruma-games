/**
 * NFDProperties contains the expanded metadata stored within an NFD contracts' global-state
 *
 * @interface NFDProperties
 */
interface NFDProperties {
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
 *
 * @interface NFDRecord
 */
interface NFDRecord {
    /**
     * NFD Application ID
     * @type {number}
     * @memberof NFDRecord
     */
    appID?: number;
    /**
     * NFD ASA ID
     * @type {number}
     * @memberof NFDRecord
     */
    asaID?: number;
    /**
     * Whether the verified Avatar set in this NFD is newer (arc19) then is set into the NFD. This will only be present on direct NFD fetch and if true
     * @type {boolean}
     * @memberof NFDRecord
     */
    avatarOutdated?: boolean;
    /**
     * Verified Algorand addresses for this NFD
     * @type {Array<string>}
     * @memberof NFDRecord
     */
    caAlgo?: Array<string>;
    /**
     *
     * @type {string}
     * @memberof NFDRecord
     */
    category?: NFDRecordCategoryEnum;
    /**
     * Round this data was last fetched from
     * @type {number}
     * @memberof NFDRecord
     */
    currentAsOfBlock?: number;
    /**
     * account wallets should send funds to - precedence is: caAlgo[0], unverifiedCaAlgo[0], owner
     * @type {string}
     * @memberof NFDRecord
     */
    depositAccount?: string;
    /**
     * Not returned, used in tagging for response to indicate if-none-match etag matched
     * @type {string}
     * @memberof NFDRecord
     */
    matchCheck?: string;
    /**
     * Tags set by the system for tracking/analytics
     * @type {Array<string>}
     * @memberof NFDRecord
     */
    metaTags?: Array<string>;
    /**
     *
     * @type {string}
     * @memberof NFDRecord
     */
    name: string;
    /**
     *
     * @type {string}
     * @memberof NFDRecord
     */
    nfdAccount?: string;
    /**
     * Owner of NFD
     * @type {string}
     * @memberof NFDRecord
     */
    owner?: string;
    /**
     *
     * @type {NFDProperties}
     * @memberof NFDRecord
     */
    properties?: NFDProperties;
    /**
     * Reserved owner of NFD
     * @type {string}
     * @memberof NFDRecord
     */
    reservedFor?: string;
    /**
     *
     * @type {string}
     * @memberof NFDRecord
     */
    saleType?: NFDRecordSaleTypeEnum;
    /**
     * amount NFD is being sold for (microAlgos)
     * @type {number}
     * @memberof NFDRecord
     */
    sellAmount?: number;
    /**
     * Recipient of NFD sales
     * @type {string}
     * @memberof NFDRecord
     */
    seller?: string;
    /**
     *
     * @type {string}
     * @memberof NFDRecord
     */
    sigNameAddress?: string;
    /**
     *
     * @type {string}
     * @memberof NFDRecord
     */
    state?: NFDRecordStateEnum;
    /**
     * Tags assigned to this NFD
     * @type {Array<string>}
     * @memberof NFDRecord
     */
    tags?: Array<string>;
    /**
     *
     * @type {Date}
     * @memberof NFDRecord
     */
    timeChanged?: Date;
    /**
     *
     * @type {Date}
     * @memberof NFDRecord
     */
    timeCreated?: Date;
    /**
     *
     * @type {Date}
     * @memberof NFDRecord
     */
    timePurchased?: Date;
    /**
     * Unverified (non-algo) Crypto addresses for this NFD
     * @type {{ [key: string]: Array<string>; }}
     * @memberof NFDRecord
     */
    unverifiedCa?: { [key: string]: Array<string> };
    /**
     * Unverified Algorand addresses for this NFD
     * @type {Array<string>}
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
