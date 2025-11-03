import { api } from "./http";

export async function otpStart(phone: string, purpose: string = "reset") {
  return api.post<{ ok: true; message: string }>("/api/otp/start", { phone, purpose });
}

export async function otpVerify(phone: string, code: string, purpose: string = "reset") {
  return api.post<{ ok: true; message: string }>("/api/otp/verify", { phone, code, purpose });
}

export async function resetPassword(phone: string, new_password: string) {
  return api.post<{ ok: true; message: string }>("/api/otp/password/reset", { phone, new_password });
}
