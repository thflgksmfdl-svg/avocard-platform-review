import type { AddressBook } from '@prisma/client';

function maskTail(value: string | null, visible = 2): string | null {
  if (!value) return value;
  if (value.length <= visible) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visible) + value.slice(-visible);
}

export interface AddressBookDto {
  id: string;
  addressType: string;
  label: string;
  recipientName: string | null;
  recipientPhone: string | null;
  customsClearanceNo: string | null;
  businessName: string | null;
  businessNo: string | null;
  postalCode: string;
  address: string;
  addressDetail: string | null;
  isDefault: boolean;
}

/** Owner viewing their own address: full values, no masking. */
export function toAddressBookDto(entry: AddressBook): AddressBookDto {
  return {
    id: entry.id,
    addressType: entry.address_type,
    label: entry.label,
    recipientName: entry.recipient_name,
    recipientPhone: entry.recipient_phone,
    customsClearanceNo: entry.customs_clearance_no,
    businessName: entry.business_name,
    businessNo: entry.business_no,
    postalCode: entry.postal_code,
    address: entry.address,
    addressDetail: entry.address_detail,
    isDefault: entry.is_default,
  };
}

/** Admin list view: sensitive identifiers masked by default. */
export function toAddressBookAdminListDto(entry: AddressBook): AddressBookDto {
  return {
    ...toAddressBookDto(entry),
    customsClearanceNo: maskTail(entry.customs_clearance_no),
    businessNo: maskTail(entry.business_no),
  };
}
