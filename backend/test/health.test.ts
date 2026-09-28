import { afterAll, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/build-test-app.js';

describe('GET /health', () => {
  it('returns 200 and confirms DB connectivity', async () => {
    const app = await buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', db: 'connected' });

    await app.close();
  });
});
