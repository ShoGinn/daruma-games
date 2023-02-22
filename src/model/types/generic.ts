export type packageJsonTypes = {
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
export type mandatoryEnvTypes = {
    BOT_OWNER_ID: string | undefined;
    BOT_TOKEN: string | undefined;
    CLAWBACK_TOKEN_MNEMONIC: string | undefined;
    DB_SERVER: string | undefined;
    NODE_ENV: string | undefined;
};
