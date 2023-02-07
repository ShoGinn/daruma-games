import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

export async function initORM(): Promise<MikroORM<BetterSqliteDriver>> {
    const jestDbSqlFile = `${__dirname}/db.sql`;

    // initialize MikroORM with a SQLite database
    const orm = await MikroORM.init<BetterSqliteDriver>({
        dbName: ':memory:',
        entities: ['build/**/*.entity.js'],
        entitiesTs: ['src/**/*.entity.ts'],
        type: 'better-sqlite',
    });
    const connect = orm.em.getConnection();
    connect.loadFile(jestDbSqlFile);
    container.register(MikroORM, { useValue: orm });
    return orm;
}
