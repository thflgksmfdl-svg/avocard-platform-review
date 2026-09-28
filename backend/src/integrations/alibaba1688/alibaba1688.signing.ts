import { createHmac } from 'node:crypto';

/**
 * 1688 Open Platform (open.1688.com) request signing — two distinct
 * algorithms per the official docs the user obtained directly (not part of
 * 04_API_INTEGRATION_SPEC.md, which only lists which API names to call).
 *
 * 1. API signature (signApiRequest): for actual gw.open.1688.com API calls,
 *    e.g. alibaba.trade.createCrossOrder, system.oauth2.subaccount.auth.list.
 *    signature = uppercase(hex(HMAC_SHA1(urlPath + sortedParams, secretKey)))
 *    where sortedParams is every param's key+value concatenated with no
 *    separator, params sorted by key ascending, then the whole thing
 *    appended directly after urlPath (no separator between them either).
 *
 *    CRITICAL: urlPath here means the API path segment AFTER "/openapi/" —
 *    e.g. "param2/1/system.oauth2/subaccount.auth.list/{appKey}", with NO
 *    leading slash and the "/openapi/" prefix stripped. Signing the full
 *    request path (including "/openapi/" and/or a leading "/") produces a
 *    signature 1688 rejects with error_code=gw.SignatureInvalid — confirmed
 *    against a working reference implementation in another project
 *    (`hs-automation/backend/src/alibaba-signature.js`,
 *    `normalizeUrlPath()`: strips leading "/" then everything up to and
 *    including "/openapi/") and verified live against gw.open.1688.com.
 *
 * 2. Parameter signature (signAuthorizeParams): for the OAuth authorize.htm
 *    consent-page redirect URL only — no urlPath involved, same sort+concat
 *    rule over just the query params, HMAC-SHA1 keyed by client_secret
 *    (== appSecret).
 *
 * The worked example in the source doc ("3E54F4B7989E3E0912D3FBD2F1A03CA7CE88",
 * 36 hex chars) is internally inconsistent — HMAC-SHA1 hex output is always
 * 40 characters — so it cannot be used to verify this implementation. Treat
 * that example as illustrative of the *method*, not a verifiable test
 * vector. This implementation has been validated against a real 1688 API
 * response (see verify-1688-signing.ts) after the urlPath-normalization fix
 * above.
 */

function sortAndConcatParams(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('');
}

/**
 * Strips a leading "/" and everything up to and including "/openapi/" (if
 * present), matching the reference implementation's normalizeUrlPath(). Only
 * the portion after "/openapi/" participates in the signature — the request
 * itself still goes to the full "/openapi/param2/..." path.
 */
export function normalizeUrlPathForSigning(fullRequestPath: string): string {
  const withoutLeadingSlash = fullRequestPath.replace(/^\/+/, '');
  const marker = 'openapi/';
  const markerIndex = withoutLeadingSlash.indexOf(marker);
  return markerIndex === -1 ? withoutLeadingSlash : withoutLeadingSlash.slice(markerIndex + marker.length);
}

/**
 * Signs an actual API call. `requestPath` is the full path used in the
 * request URL, e.g. "/openapi/param2/1/system.oauth2/subaccount.auth.list/APPKEY"
 * — everything between the host and the "?". This function normalizes it
 * (strips the leading "/" and the "/openapi/" prefix) before signing; the
 * caller must NOT pre-strip it. `params` must be the full query parameter
 * set that will actually be sent (including access_token when present),
 * excluding _aop_signature itself.
 */
export function signApiRequest(requestPath: string, params: Record<string, string>, secretKey: string): string {
  const signingString = normalizeUrlPathForSigning(requestPath) + sortAndConcatParams(params);
  return createHmac('sha1', secretKey).update(signingString).digest('hex').toUpperCase();
}

/** Debug helper: exposes the exact pre-HMAC signing string for comparison. */
export function buildSigningString(requestPath: string, params: Record<string, string>): string {
  return normalizeUrlPathForSigning(requestPath) + sortAndConcatParams(params);
}

/**
 * Signs the OAuth authorize.htm consent-page redirect URL. `params` is the
 * full query parameter set (client_id, site, redirect_uri, state, ...)
 * excluding aop_signature itself. `clientSecret` is the app's appSecret.
 */
export function signAuthorizeParams(params: Record<string, string>, clientSecret: string): string {
  const signingString = sortAndConcatParams(params);
  return createHmac('sha1', clientSecret).update(signingString).digest('hex').toUpperCase();
}
