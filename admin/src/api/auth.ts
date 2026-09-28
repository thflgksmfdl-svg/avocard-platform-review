import { apiClient } from './client';

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
}

export function login(email: string, password: string) {
  return apiClient.post<AdminUser>('/api/v1/admin/auth/login', { email, password });
}

export function logout() {
  return apiClient.post<{ ok: boolean }>('/api/v1/admin/auth/logout');
}

export function getCurrentAdmin() {
  return apiClient.get<AdminUser>('/api/v1/admin/auth/me');
}
