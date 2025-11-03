import { api } from "./http";

// Signature Cloudinary (retourne { signature, timestamp, api_key, ... })
export async function signCloudinary(params: Record<string, unknown>) {
  return api.post<any>("/api/uploads/cloudinary/sign", params);
}
