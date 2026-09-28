import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../shared/errors.js';
import { writeAuditLog } from '../audit/audit-log.service.js';
import { findOwnAddressById, listOwnAddresses } from './address-book.repository.js';

export interface AddressBookInput {
  addressType: 'PERSONAL' | 'BUSINESS';
  label: string;
  recipientName?: string;
  recipientPhone?: string;
  customsClearanceNo?: string;
  businessName?: string;
  businessNo?: string;
  postalCode: string;
  address: string;
  addressDetail?: string;
  isDefault?: boolean;
}

export async function listAddresses(prisma: PrismaClient, customerId: string) {
  return listOwnAddresses(prisma, customerId);
}

export async function createAddress(
  prisma: PrismaClient,
  customerId: string,
  input: AddressBookInput,
  correlationId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.addressBook.create({
      data: {
        customer_id: customerId,
        address_type: input.addressType,
        label: input.label,
        recipient_name: input.recipientName,
        recipient_phone: input.recipientPhone,
        customs_clearance_no: input.customsClearanceNo,
        business_name: input.businessName,
        business_no: input.businessNo,
        postal_code: input.postalCode,
        address: input.address,
        address_detail: input.addressDetail,
        is_default: input.isDefault ?? false,
      },
    });

    await writeAuditLog(tx, {
      entityType: 'address_book',
      entityId: created.id,
      action: 'CREATE',
      after: { addressType: created.address_type, label: created.label },
      actor: { type: 'CUSTOMER', id: customerId },
      correlationId,
    });

    return created;
  });
}

export async function updateAddress(
  prisma: PrismaClient,
  customerId: string,
  addressId: string,
  input: Partial<AddressBookInput>,
  correlationId?: string,
) {
  const existing = await findOwnAddressById(prisma, customerId, addressId);
  if (!existing) {
    throw new NotFoundError('Address not found');
  }

  return prisma.$transaction(async (tx) => {
    const after = await tx.addressBook.update({
      where: { id: addressId },
      data: {
        label: input.label ?? existing.label,
        recipient_name: input.recipientName ?? existing.recipient_name,
        recipient_phone: input.recipientPhone ?? existing.recipient_phone,
        customs_clearance_no: input.customsClearanceNo ?? existing.customs_clearance_no,
        business_name: input.businessName ?? existing.business_name,
        business_no: input.businessNo ?? existing.business_no,
        postal_code: input.postalCode ?? existing.postal_code,
        address: input.address ?? existing.address,
        address_detail: input.addressDetail ?? existing.address_detail,
        is_default: input.isDefault ?? existing.is_default,
      },
    });

    await writeAuditLog(tx, {
      entityType: 'address_book',
      entityId: after.id,
      action: 'UPDATE',
      before: { label: existing.label, isDefault: existing.is_default },
      after: { label: after.label, isDefault: after.is_default },
      actor: { type: 'CUSTOMER', id: customerId },
      correlationId,
    });

    return after;
  });
}

export async function softDeleteAddress(
  prisma: PrismaClient,
  customerId: string,
  addressId: string,
  correlationId?: string,
) {
  const existing = await findOwnAddressById(prisma, customerId, addressId);
  if (!existing) {
    throw new NotFoundError('Address not found');
  }

  return prisma.$transaction(async (tx) => {
    const after = await tx.addressBook.update({
      where: { id: addressId },
      data: { deleted_at: new Date() },
    });

    await writeAuditLog(tx, {
      entityType: 'address_book',
      entityId: after.id,
      action: 'SOFT_DELETE',
      before: { deletedAt: null },
      after: { deletedAt: after.deleted_at },
      actor: { type: 'CUSTOMER', id: customerId },
      correlationId,
    });

    return after;
  });
}
