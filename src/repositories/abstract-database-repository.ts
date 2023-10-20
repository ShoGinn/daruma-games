import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

export abstract class AbstractDatabaseRepository {
  protected orm: MikroORM<BetterSqliteDriver>;

  public constructor(orm?: MikroORM<BetterSqliteDriver>) {
    this.orm = orm ?? (container.resolve(MikroORM) as MikroORM<BetterSqliteDriver>);
  }
}
