// src/services/users.ts
import { http } from "./http";

export type Role = "MEMBER" | "VENDEUR" | "LIVREUR" | "ADMIN";

export type User = {
  id: number;
  phone: string;
  role: Role;
  first_name?: string | null;
  last_name?: string | null;
  avatar?: string | null;
  ville?: string | null;
  commune?: string | null;
  quartier?: string | null;
  sexe?: "M" | "F" | null;
  created_at?: string | null;
};

export type PageInfo = { page: number; pageSize: number; total: number };
export type Paged<T> = { items: T[]; pageInfo: PageInfo };

export async function getMe(): Promise<User | null> {
  return http<User | null>("/api/user/me", { method: "GET" });
}

export async function listUsers(params?: {
  page?: number;
  pageSize?: number;
  q?: string | null;
}): Promise<Paged<User>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const q = params?.q ?? null;

  return http<Paged<User>>("/api/user", {
    method: "GET",
    query: { page, pageSize, q: q || undefined },
  });
}

export async function createUser(payload: {
  phone: string;
  password: string;
  first_name: string | null;
  last_name: string | null;
  role: Role;
}) {
  return http<{ ok: true }>("/api/user", {
    method: "POST",
    body: payload,
  });
}

/** ❗ Edition des champs SANS rôle */
export async function updateUser(
  id: number,
  payload: {
    phone: string;
    first_name: string | null;
    last_name: string | null;
  }
) {
  return http<User>(`/api/user/${id}`, {
    method: "PUT",
    body: payload,
  });
}

/** Changer UNIQUEMENT le rôle */
export async function changeUserRole(id: number, role: Role) {
  return http<User>(`/api/user/${id}/role`, {
    method: "PATCH",
    body: { role },
  });
}

export async function removeUser(id: number) {
  return http<{ ok: true }>(`/api/user/${id}`, { method: "DELETE" });
}
