/* eslint-disable no-console */
import { Configuration, Options } from '@mikro-orm/core';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import dotenv from 'dotenv';
if (!process.env['JEST_WORKER_ID']) {
    dotenv.config();
}
const mysqlDBClientUrl = process.env['MYSQL_URL'];
const postgresDBClientUrl = process.env['DATABASE_URL'];

const databaseClientUrl = mysqlDBClientUrl || postgresDBClientUrl;

const sqliteDatabasePath = process.env['SQLITE_DB_PATH'];

if (!databaseClientUrl && !sqliteDatabasePath) {
    throw new Error('Database connection string and/or sqlite database path must be provided');
}
let databaseType: keyof typeof Configuration.PLATFORMS;
if (mysqlDBClientUrl) {
    databaseType = 'mysql';
    postgresDBClientUrl && console.warn('Both MYSQL_URL and DATABASE_URL are set, using MYSQL_URL');
    sqliteDatabasePath &&
        console.warn('Both MYSQL_URL and SQLITE_DB_PATH are set, using MYSQL_URL');
} else if (postgresDBClientUrl) {
    databaseType = 'postgresql';
    sqliteDatabasePath &&
        console.warn('Both DATABASE_URL and SQLITE_DB_PATH are set, using DATABASE_URL');
} else if (sqliteDatabasePath) {
    databaseType = 'better-sqlite';
} else {
    throw new Error('Database connection string and/or sqlite database path must be provided');
}
const config: Options = {
    clientUrl: databaseClientUrl || '',
    dbName: sqliteDatabasePath || '',
    entities: ['build/**/*.entity.js'],
    entitiesTs: ['src/**/*.entity.ts'],
    type: databaseType,
    highlighter: new SqlHighlighter(),
    debug: process.env['MIKRO_ORM_DEBUG'] === 'true',
};

export default config;
