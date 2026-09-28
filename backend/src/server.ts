import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// .env.local lives at platform/backend/.env.local; src/server.ts is at platform/backend/src/.
loadDotenv({ path: path.resolve(__dirname, '..', '.env.local') });

const { loadConfig } = await import('./config/env.js');
const { buildApp } = await import('./app.js');

async function main() {
  const config = loadConfig();
  const fastify = await buildApp(config);

  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

main();
