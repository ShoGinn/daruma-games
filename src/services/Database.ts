import { MikroORM } from '@mikro-orm/core';

import config from '../mikro-orm.config.js';

const initializeMikroOrm = async (): Promise<MikroORM> => {
    const orm = await MikroORM.init(config);
    const migrator = orm.getMigrator();
    // create migration if no one is present in the migrations folder
    const pendingMigrations = await migrator.getPendingMigrations();
    const executedMigrations = await migrator.getExecutedMigrations();
    // migrate to the latest migration
    if (pendingMigrations?.length > 0) {
        await migrator.up();
    }

    if (pendingMigrations.length === 0 && executedMigrations.length === 0) {
        await migrator.createInitialMigration();
    }
    await migrator.createMigration();
    return orm;
};
export default initializeMikroOrm;
