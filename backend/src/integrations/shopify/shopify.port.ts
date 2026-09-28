/**
 * Verifies that an inbound customer request genuinely belongs to a logged-in
 * Shopify customer, and returns that customer's Shopify customer ID.
 *
 * AVOCARD keeps Shopify's existing Legacy Customer Accounts as the single
 * source of truth for login/signup. This port never creates or modifies a
 * Shopify customer — it only verifies identity for requests coming into the
 * AVOCARD backend.
 */
export interface ShopifyPort {
  verifyCustomerSession(input: ShopifyVerifyInput): Promise<ShopifyVerifiedCustomer>;
}

export interface ShopifyVerifyInput {
  /** Raw bearer/session value or header set, adapter-specific. */
  headers: Record<string, string | string[] | undefined>;
}

export interface ShopifyVerifiedCustomer {
  shopifyCustomerId: string;
}
