import { MikroORM } from '@mikro-orm/core';
import { MySqlDriver } from '@mikro-orm/mysql';

import config from '../mikro-orm.config.js';

const initializeMikroOrm = async (): Promise<MikroORM<MySqlDriver>> => {
    const orm = await MikroORM.init<MySqlDriver>(config);
    const migrator = orm.getMigrator();
    // create migration if no one is present in the migrations folder
    const pendingMigrations = await migrator.getPendingMigrations();
    const executedMigrations = await migrator.getExecutedMigrations();
    if (pendingMigrations.length === 0 && executedMigrations.length === 0) {
        await migrator.createInitialMigration();
    }
    await migrator.createMigration();
    // migrate to the latest migration
    if (pendingMigrations?.length > 0) {
        await migrator.up();
    }
    return orm;
};
export default initializeMikroOrm;
