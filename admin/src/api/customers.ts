import { apiClient } from './client';

export interface CustomerListItemDto {
  id: string;
  shopifyCustomerId: string;
  email: string | null;
  phone: string | null;
  businessDocumentStatus: string;
  addressCount: number;
  createdAt: string;
}

export interface AddressAdminDto {
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

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function listCustomers(page = 1, pageSize = 20) {
  return apiClient.get<PageResult<CustomerListItemDto>>(
    `/api/v1/admin/customers?page=${page}&pageSize=${pageSize}`,
  );
}

export function getCustomerDetail(id: string) {
  return apiClient.get<{ profile: CustomerListItemDto; addresses: AddressAdminDto[] }>(
    `/api/v1/admin/customers/${id}`,
  );
}
