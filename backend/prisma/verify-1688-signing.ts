import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callAlibaba1688Api } from '../src/integrations/alibaba1688/alibaba1688.gateway-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '..', '.env.local') });

/**
 * One-off verification script: calls system.oauth2/subaccount.auth.list with
 * the real App Key/Secret + main account access_token from .env.local, to
 * confirm the signature implementation in alibaba1688.signing.ts actually
 * works against 1688's real servers (the doc's own worked example is
 * internally inconsistent — see the comment in alibaba1688.signing.ts — so
 * this is the only way to validate it).
 *
 * Never logs the App Secret or access_token values themselves. Prints only
 * the request URL path (no query string — that contains the token), HTTP
 * status, and the parsed response body, which callers should eyeball for
 * `"success": true` vs `"error_code"` before trusting this signer for
 * anything order-affecting.
 *
 * Usage: tsx prisma/verify-1688-signing.ts
 */

async function main() {
  const baseUrl = process.env.ALIBABA_1688_BASE_URL;
  const appKey = process.env.ALIBABA_1688_APP_KEY;
  const appSecret = process.env.ALIBABA_1688_APP_SECRET;
  const mainAccessToken = process.env.ALIBABA_1688_MAIN_ACCESS_TOKEN;

  const missing = [
    !baseUrl && 'ALIBABA_1688_BASE_URL',
    !appKey && 'ALIBABA_1688_APP_KEY',
    !appSecret && 'ALIBABA_1688_APP_SECRET',
    !mainAccessToken && 'ALIBABA_1688_MAIN_ACCESS_TOKEN',
  ].filter(Boolean);

  if (missing.length > 0) {
    console.error(`Missing required .env.local values: ${missing.join(', ')}`);
    console.error('Set them in backend/.env.local (never commit real values) and re-run.');
    process.exitCode = 1;
    return;
  }

  const subAccountMemberId = process.env.ALIBABA_1688_SUB_ACCOUNT_MEMBER_ID;

  console.log('==> Calling system.oauth2/subaccount.auth.list to verify signing...');

  const result = await callAlibaba1688Api(
    { baseUrl: baseUrl!, appKey: appKey!, appSecret: appSecret! },
    'system.oauth2',
    'subaccount.auth.list',
    {
      access_token: mainAccessToken!,
      ...(subAccountMemberId ? { subUserIdentityList: subAccountMemberId } : {}),
    },
  );

  console.log('Request path (no query — contains token, not printed):', result.urlPath);
  console.log('HTTP status:', result.httpStatus);
  console.log('Response body:', JSON.stringify(result.body, null, 2));

  const body = result.body as { success?: boolean; error_code?: string; error_message?: string };
  if (body.success === true) {
    console.log('\n✅ Signature accepted by 1688 — signing implementation verified.');
  } else if (body.error_code) {
    console.log(`\n⚠ 1688 returned an error (error_code=${body.error_code}): ${body.error_message ?? ''}`);
    console.log('This may mean the signature is wrong, the token is expired, or the params are wrong.');
    console.log('Check error_message above for which one.');
  } else {
    console.log('\n⚠ Unexpected response shape — inspect the body above manually.');
  }
}

main().catch((error) => {
  console.error('Request failed:', error);
  process.exitCode = 1;
});
