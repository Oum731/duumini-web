// src/services/ws.ts
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./auth";

let socket: Socket | null = null;

export function connectWS(): Socket | null {
  if (socket && socket.connected) return socket;

  const baseUrl =
    (import.meta.env.VITE_API_BASE as string | undefined) ||
    (typeof window !== "undefined" ? window.location.origin : undefined);

  if (!baseUrl) {
    console.warn("[WS] impossible de déterminer l'URL de l'API");
    return null;
  }

  socket = io(baseUrl, {
    transports: ["websocket"],
    autoConnect: true,
    auth: (cb) => {
      const token = getAccessToken?.();
      cb({ token });
    },
  });

  socket.on("connect", () => {
    console.log("[WS] connected", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[WS] disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.warn("[WS] connect_error:", err.message);
  });

  /**
   * Event backend:
   * wsToUser(userId, "notify", body)
   */
  socket.on("notify", (body: any) => {
    const title = body?.title || "Duumini";
    const text = body?.body || "";

    // Toast UI
    (window as any)?.duuminiToast?.({
      title,
      message: text,
    });

    /**
     * Ici tu peux router selon type
     * ex:
     * if (body.type === "ORDER_STATUS") refreshOrdersStore();
     */
  });

  return socket;
}

export function disconnectWS() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}