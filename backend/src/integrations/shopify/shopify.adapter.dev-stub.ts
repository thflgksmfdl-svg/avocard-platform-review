import { UnauthorizedError } from '../../shared/errors.js';
import type { ShopifyPort, ShopifyVerifiedCustomer, ShopifyVerifyInput } from './shopify.port.js';

const DEV_HEADER = 'x-dev-shopify-customer-id';

/**
 * DEVELOPMENT ONLY. Trusts a client-supplied header instead of cryptographically
 * verifying a Shopify session. This lets customer-facing routes be built and
 * tested before a real verification strategy (Storefront API token exchange or
 * an App Proxy signed request — see 08_OPEN_QUESTIONS_AND_BLOCKERS.md P0-24) is
 * chosen and implemented.
 *
 * `app.ts` refuses to construct this adapter when NODE_ENV=production — see
 * config/env.ts's boot-time guard. Do not weaken that guard to make this
 * adapter reachable in production.
 */
export class ShopifyDevStubAdapter implements ShopifyPort {
  async verifyCustomerSession(input: ShopifyVerifyInput): Promise<ShopifyVerifiedCustomer> {
    const headerValue = input.headers[DEV_HEADER];
    const shopifyCustomerId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!shopifyCustomerId) {
      throw new UnauthorizedError(
        `Missing ${DEV_HEADER} header. This is the development-only Shopify auth stub; ` +
          'send a fake Shopify customer id in this header to simulate a logged-in customer.',
      );
    }

    return { shopifyCustomerId };
  }
}
