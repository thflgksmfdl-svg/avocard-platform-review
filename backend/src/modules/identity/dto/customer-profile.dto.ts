import type { CustomerProfile } from '@prisma/client';

export interface CustomerProfileDto {
  id: string;
  email: string | null;
  phone: string | null;
  businessDocumentStatus: string;
  createdAt: string;
}

/** Customer-facing DTO: never includes shopify_customer_id or submitted_by (internal actor id). */
export function toCustomerProfileDto(profile: CustomerProfile): CustomerProfileDto {
  return {
    id: profile.id,
    email: profile.email,
    phone: profile.phone,
    businessDocumentStatus: profile.business_document_status,
    createdAt: profile.created_at.toISOString(),
  };
}

export interface CustomerProfileAdminDto extends CustomerProfileDto {
  shopifyCustomerId: string;
  businessDocumentSubmittedAt: string | null;
  businessDocumentSubmittedBy: string | null;
}

export function toCustomerProfileAdminDto(profile: CustomerProfile): CustomerProfileAdminDto {
  return {
    ...toCustomerProfileDto(profile),
    shopifyCustomerId: profile.shopify_customer_id,
    businessDocumentSubmittedAt: profile.business_document_submitted_at?.toISOString() ?? null,
    businessDocumentSubmittedBy: profile.business_document_submitted_by,
  };
}
