import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '..', '..', '.env.local') });

import { loadConfig } from '../../src/config/env.js';
import { buildApp } from '../../src/app.js';

export async function buildTestApp() {
  const config = loadConfig({ ...process.env, NODE_ENV: 'test' });
  return buildApp(config);
}

export const DEV_CUSTOMER_HEADER = 'x-dev-shopify-customer-id';
