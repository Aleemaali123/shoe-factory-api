import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import { openStore } from './infrastructure/persistence/sqliteStore.js';
import { createTokens } from './infrastructure/security/tokens.js';
import { createApp } from './interfaces/http/createApp.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const databasePath = path.resolve(root, env.databasePath);
const defaultDatabasePath = path.resolve(root, 'data/shop.db');
const store = await openStore(databasePath, {
  legacyJsonPath: databasePath === defaultDatabasePath
    ? path.resolve(root, 'data/store.json')
    : null,
});
const app = createApp({ store, tokens: createTokens(env.jwtSecret) });

const host = process.env.HOST || '0.0.0.0';
app.listen(env.port, host, () => {
  console.log(`Shoe Factory API listening on http://${host}:${env.port}`);
  console.log(`SQLite database: ${databasePath}`);
});
