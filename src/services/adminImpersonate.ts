// src/services/adminImpersonate.ts
import { api } from "./http";

export async function adminImpersonateVendor(query: {
  vendor_shop_id?: number;
  vendor_user_id?: number;
}) {
  return api.post<{ access_token: string; impersonate_shop_id: number }>(
    "/api/auth/impersonate",
    query
  );
}