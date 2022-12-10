import { dirname } from '@discordx/importer';
import { EntityName, MikroORM, Options } from '@mikro-orm/core';
import type { EntityManager, MySqlDriver } from '@mikro-orm/mysql';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import { singleton } from 'tsyringe';

import { Property } from '../model/framework/decorators/Property.js';

@singleton()
export class Database {
    private _orm: MikroORM<MySqlDriver>;
    @Property('MYSQL_URL')
    private static readonly mysqlUrl: string;

    async initialize(): Promise<void> {
        // get config
        const config = {
            type: 'mysql',
            clientUrl: Database.mysqlUrl,
            entities: [`${dirname(import.meta.url)}/entities/**/*.{ts,js}`], // path to our JS entities (dist), relative to `baseDir`
            highlighter: new SqlHighlighter(),
            allowGlobalContext: true,
            debug: false,

            migrations: {
                path: `${dirname(import.meta.url)}../database/migrations`,
                emit: 'js',
                snapshot: true,
            },
        } as Options<MySqlDriver>;

        // initialize the ORM using the configuration exported in `mikro-orm.config.ts`
        this._orm = await MikroORM.init(config);

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
    get<T extends object>(entity: EntityName<T>) {
        return this._orm.em.getRepository(entity);
    }
}
