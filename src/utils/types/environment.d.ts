/* eslint-disable unicorn/prevent-abbreviations */
export {};

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            BOT_OWNER_ID: string;
            BOT_TOKEN: string;
            CLAWBACK_TOKEN_MNEMONIC: string;
            CLAIM_TOKEN_MNEMONIC: string;
            TEST_TOKEN: string;
            MYSQL_URL: string;
            SQLITE_DB_PATH: string;
            MIKRO_ORM_DEBUG: string;
            ALGO_API_TOKEN: string;
            ALGOD_SERVER: string;
            ALGOD_PORT: string;
            INDEXER_SERVER: string;
            INDEXER_PORT: string;
            IPFS_GATEWAY: string;
            API_LIMITS_POINTS: string;
            API_LIMITS_DURATION: string;
            TENOR_API_KEY: string;
            NODE_ENV: 'production' | 'development' | 'test' | undefined;
        }
    }
}
