import { defineConfig, Options } from '@mikro-orm/better-sqlite';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';

import { getConfig } from './config/config.js';

const config: Options = defineConfig({
  dbName: getConfig().get().sqlitePath,
  entities: ['build/**/*.entity.js'],
  entitiesTs: ['src/**/*.entity.ts'],
  highlighter: new SqlHighlighter(),
});

export default config;
