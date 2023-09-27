/* eslint-disable unicorn/prevent-abbreviations */
export {};

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            ADMIN_CHANNEL_ID: string;
            ALGO_API_TOKEN: string;
            ALGOD_PORT: string;
            ALGOD_SERVER: string;
            API_LIMITS_DURATION: string;
            API_LIMITS_POINTS: string;
            BOT_OWNER_ID: string;
            BOT_TOKEN: string;
            CLAIM_TOKEN_MNEMONIC: string;
            CLAWBACK_TOKEN_MNEMONIC: string;
            REPLENISH_TOKEN_ACCOUNT: string;
            INDEXER_PORT: string;
            INDEXER_SERVER: string;
            IPFS_GATEWAY: string;
            MIKRO_ORM_DEBUG: string;
            MYSQL_URL: string;
            NODE_ENV: 'production' | 'development' | 'test' | undefined;
            SQLITE_DB_PATH: string;
            TENOR_API_KEY: string;
            TEST_TOKEN: string;
        }
    }
}
