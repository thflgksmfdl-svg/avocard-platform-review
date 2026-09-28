import { apiClient } from './client';

export interface ExchangeRateDto {
  id: string;
  currencyPair: string;
  rate: string;
  effectiveAt: string;
  enteredBy: string;
  createdAt: string;
}

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function listExchangeRates(page = 1, pageSize = 20) {
  return apiClient.get<PageResult<ExchangeRateDto>>(
    `/api/v1/admin/exchange-rates?page=${page}&pageSize=${pageSize}`,
  );
}

export function createExchangeRate(rate: string, effectiveAt: string) {
  return apiClient.post<ExchangeRateDto>('/api/v1/admin/exchange-rates', { rate, effectiveAt });
}
