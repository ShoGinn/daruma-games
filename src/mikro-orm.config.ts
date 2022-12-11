import { Options } from '@mikro-orm/core';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import dotenv from 'dotenv';

dotenv.config();

const options: Options = {
    clientUrl: process.env.MYSQL_URL,
    entities: ['./src/entities'], // path to your TS entities (source), relative to `baseDir`
    entitiesTs: ['./src/entities'], // path to your TS entities (source), relative to `baseDir`
    type: 'mysql', // one of `mongo` | `mysql` | `mariadb` | `postgresql` | `sqlite`
    highlighter: new SqlHighlighter(),
    allowGlobalContext: true,
    migrations: {
        tableName: 'mikro_orm_migrations',
        path: 'dist/migrations',
        pathTs: 'src/migrations',
        transactional: true,
    },
    debug: process.env.DEBUG === 'true',
};

export default options;
