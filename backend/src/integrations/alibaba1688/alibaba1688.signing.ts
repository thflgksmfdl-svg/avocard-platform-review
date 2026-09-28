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
 * 2. Parameter signature (signAuthorizeParams): for the OAuth authorize.htm
 *    consent-page redirect URL only — no urlPath involved, same sort+concat
 *    rule over just the query params, HMAC-SHA1 keyed by client_secret
 *    (== appSecret).
 *
 * The worked example in the source doc ("3E54F4B7989E3E0912D3FBD2F1A03CA7CE88",
 * 36 hex chars) is internally inconsistent — HMAC-SHA1 hex output is always
 * 40 characters — so it cannot be used to verify this implementation. Treat
 * that example as illustrative of the *method*, not a verifiable test
 * vector. This implementation must be validated against a real 1688 API
 * response before being trusted for order-affecting calls.
 */

function sortAndConcatParams(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('');
}

/**
 * Signs an actual API call. `urlPath` must be exactly the path segment used
 * in the request URL, e.g. "/param2/1/system.oauth2/subaccount.auth.list/APPKEY"
 * — everything between the host and the "?", including the leading slash.
 * `params` must be the full query parameter set that will actually be sent
 * (including access_token and _aop_timestamp when present), excluding
 * _aop_signature itself.
 */
export function signApiRequest(urlPath: string, params: Record<string, string>, secretKey: string): string {
  const signingString = urlPath + sortAndConcatParams(params);
  return createHmac('sha1', secretKey).update(signingString).digest('hex').toUpperCase();
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
