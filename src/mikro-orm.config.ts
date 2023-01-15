import { Configuration, Options } from '@mikro-orm/core';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import dotenv from 'dotenv';

dotenv.config();

const mysqlDBClientUrl = process.env.MYSQL_URL;
const postgresDBClientUrl = process.env.DATABASE_URL;

const dbClientUrl = mysqlDBClientUrl || postgresDBClientUrl;

const sqliteDbPath = process.env.SQLITE_DB_PATH;

if (!dbClientUrl && !sqliteDbPath) {
    throw new Error('Database connection string and/or sqlite database path must be provided');
}
let dbType: keyof typeof Configuration.PLATFORMS;
if (mysqlDBClientUrl) {
    dbType = 'mysql';
    postgresDBClientUrl && console.warn('Both MYSQL_URL and DATABASE_URL are set, using MYSQL_URL');
    sqliteDbPath && console.warn('Both MYSQL_URL and SQLITE_DB_PATH are set, using MYSQL_URL');
} else if (postgresDBClientUrl) {
    dbType = 'postgresql';
    sqliteDbPath &&
        console.warn('Both DATABASE_URL and SQLITE_DB_PATH are set, using DATABASE_URL');
} else if (sqliteDbPath) {
    dbType = 'better-sqlite';
}
const config: Options = {
    clientUrl: dbClientUrl,
    dbName: sqliteDbPath,
    entities: ['./build/entities'], // path to your TS entities (source), relative to `baseDir`
    entitiesTs: ['./src/entities'], // path to your TS entities (source), relative to `baseDir`
    type: dbType,
    highlighter: new SqlHighlighter(),
    migrations: {
        tableName: 'mikro_orm_migrations',
        path: 'build/migrations',
        pathTs: 'src/migrations',
        transactional: true,
    },
    debug: process.env.MIKRO_ORM_DEBUG === 'true',
};

export default config;
