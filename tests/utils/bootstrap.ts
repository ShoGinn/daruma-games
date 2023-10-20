import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

export async function initORM(): Promise<MikroORM<BetterSqliteDriver>> {
  // initialize MikroORM with a SQLite database
  const orm = await MikroORM.init<BetterSqliteDriver>({
    dbName: ':memory:',
    entities: ['build/**/*.entity.js'],
    entitiesTs: ['src/**/*.entity.ts'],
    type: 'better-sqlite',
    forceUtcTimezone: true,
    logger: (index) => index,
    debug: ['query'],
  });
  const generator = orm.getSchemaGenerator();
  await generator.dropSchema();
  await generator.createSchema();
  container.register(MikroORM, { useValue: orm });
  return orm;
}
export function initORMBasic(): MikroORM<BetterSqliteDriver> {
  container.register(MikroORM, { useValue: {} as MikroORM<BetterSqliteDriver> });
  return {} as MikroORM<BetterSqliteDriver>;
}
