import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

/**
 * Creates a throwaway admin_user row and returns a signed session cookie
 * header value, without going through the HTTP login route (keeps tests
 * independent of bcrypt/argon2 timing and lets each test use a unique admin).
 */
export async function createAdminSessionCookie(app: FastifyInstance): Promise<{ cookieHeader: string; adminId: string }> {
  const email = `admin-${randomUUID()}@avocard.local`;
  const admin = await app.prisma.adminUser.create({
    data: {
      email,
      password_hash: await argon2.hash('test-password'),
      display_name: 'Test Admin',
    },
  });

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth/login',
    payload: { email, password: 'test-password' },
  });

  const setCookieHeader = loginResponse.cookies.find((c) => c.name === 'avocard_admin_session');
  if (!setCookieHeader) {
    throw new Error('Login did not set an admin session cookie');
  }

  return {
    cookieHeader: `avocard_admin_session=${setCookieHeader.value}`,
    adminId: admin.id,
  };
}
