import { signApiRequest } from './alibaba1688.signing.js';

export interface Alibaba1688GatewayConfig {
  baseUrl: string;
  appKey: string;
  appSecret: string;
}

export interface GatewayCallResult<T = unknown> {
  httpStatus: number;
  urlPath: string;
  requestUrl: string;
  body: T;
}

/**
 * Low-level gw.open.1688.com caller: builds the param2/{version}/{namespace}/{apiName}/{appKey}
 * URL shape, signs it per alibaba1688.signing.ts's API-signature algorithm, and
 * returns the raw parsed JSON body alongside the HTTP status and exact URL
 * called — callers decide success/failure from the body's own `success`/
 * `error_code` fields, since 1688 returns 200 for many documented error
 * responses.
 *
 * All params are sent as query-string, never as a JSON/form body, even for
 * POST — this matches a working reference implementation elsewhere
 * (hs-automation project) that always puts params in the query string and
 * sends POST with an empty body. signApiRequest() internally strips the
 * "/openapi/" prefix before signing; this function still requests the full
 * "/openapi/param2/..." path.
 */
export async function callAlibaba1688Api<T = unknown>(
  config: Alibaba1688GatewayConfig,
  namespace: string,
  apiName: string,
  params: Record<string, string>,
  options: { method?: 'GET' | 'POST'; apiVersion?: string } = {},
): Promise<GatewayCallResult<T>> {
  const method = options.method ?? 'GET';
  const apiVersion = options.apiVersion ?? '1';

  const urlPath = `/openapi/param2/${apiVersion}/${namespace}/${apiName}/${config.appKey}`;
  const allParams: Record<string, string> = { ...params };

  const signature = signApiRequest(urlPath, allParams, config.appSecret);
  const query = new URLSearchParams({ ...allParams, _aop_signature: signature });

  const requestUrl = `${config.baseUrl}${urlPath}?${query.toString()}`;

  const response = await fetch(requestUrl, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
  });

  const body = (await response.json().catch(() => ({}))) as T;

  return {
    httpStatus: response.status,
    urlPath,
    requestUrl,
    body,
  };
}
