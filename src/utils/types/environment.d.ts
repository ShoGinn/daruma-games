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
            TENOR_API_KEY: string;
            NODE_ENV: 'production' | 'development' | undefined;
        }
    }
    type mandatoryEnvTypes = {
        BOT_OWNER_ID: string | undefined;
        BOT_TOKEN: string | undefined;
        CLAWBACK_TOKEN_MNEMONIC: string | undefined;
        DB_SERVER: string | undefined;
        NODE_ENV: string | undefined;
    };
}
