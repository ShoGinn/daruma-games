import { EntityName, GetRepository, MikroORM } from '@mikro-orm/core';
import { EntityManager, MySqlDriver, SqlEntityRepository } from '@mikro-orm/mysql';
import { singleton } from 'tsyringe';

import options from '../mikro-orm.config.js';
import { Property } from '../model/framework/decorators/Property.js';
@singleton()
export class Database {
    private _orm: MikroORM<MySqlDriver>;
    @Property('MYSQL_URL')
    private static readonly mysqlUrl: string;
    @Property('MIKRO_ORM_DEBUG', false)
    private static readonly mikroOrmDebug: string;
    async initialize(): Promise<void> {
        options.clientUrl = Database.mysqlUrl;
        options.debug = Boolean(Database.mikroOrmDebug);
        this._orm = await MikroORM.init<MySqlDriver>(options);
        const migrator = this._orm.getMigrator();

        // create migration if no one is present in the migrations folder
        const pendingMigrations = await migrator.getPendingMigrations();
        const executedMigrations = await migrator.getExecutedMigrations();
        if (pendingMigrations.length === 0 && executedMigrations.length === 0) {
            await migrator.createInitialMigration();
        }

        // migrate to the latest migration
        await this._orm.getMigrator().up();
    }

    async refreshConnection(): Promise<void> {
        await this._orm.close();
        this._orm = await MikroORM.init();
    }

    get orm(): MikroORM<MySqlDriver> {
        return this._orm;
    }

    get em(): EntityManager<MySqlDriver> {
        return this._orm.em;
    }

    /**
     * Shorthand to get custom and natives repositories
     * @param entity Entity of the custom repository to get
     */
    get<T extends object>(entity: EntityName<T>): GetRepository<T, SqlEntityRepository<T>> {
        return this._orm.em.getRepository(entity);
    }
}
