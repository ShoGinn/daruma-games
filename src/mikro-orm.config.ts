import { Options } from '@mikro-orm/core';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import dotenv from 'dotenv';

dotenv.config();

const dbConnectionString = process.env.MYSQL_URL;
if (!dbConnectionString) {
    throw new Error('MYSQL_URL is not set');
}
let dbType = process.env.DB_TYPE as any;
if (!dbType) {
    dbType = 'mysql';
}
const config: Options = {
    clientUrl: dbConnectionString,
    entities: ['./build/entities'], // path to your TS entities (source), relative to `baseDir`
    entitiesTs: ['./src/entities'], // path to your TS entities (source), relative to `baseDir`
    type: dbType,
    highlighter: new SqlHighlighter(),
    migrations: {
        tableName: 'mikro_orm_migrations',
        path: 'dist/migrations',
        pathTs: 'src/migrations',
        transactional: true,
    },
    debug: process.env.MIKRO_ORM_DEBUG === 'true',
};

export default config;
