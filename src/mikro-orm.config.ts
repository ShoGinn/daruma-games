import { Options } from '@mikro-orm/core';
import { MySqlDriver } from '@mikro-orm/mysql';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import dotenv from 'dotenv';

dotenv.config();

const dbConnectionString = process.env.MYSQL_URL;
if (!dbConnectionString) {
    throw new Error('MYSQL_URL is not set');
}

const config: Options<MySqlDriver> = {
    clientUrl: dbConnectionString,
    entities: ['./build/entities'], // path to your TS entities (source), relative to `baseDir`
    entitiesTs: ['./src/entities'], // path to your TS entities (source), relative to `baseDir`
    type: 'mysql', // one of `mongo` | `mysql` | `mariadb` | `postgresql` | `sqlite`
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
