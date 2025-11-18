// src/context/RealtimeContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { subscribeSSE, type ServerEvent } from "../services/events";
import { getAccessToken } from "../services/auth";
import { useAuth } from "./AuthContext";

type RealtimeContextType = {
  socket: Socket | null;
};

const RealtimeContext = createContext<RealtimeContextType>({ socket: null });

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const sseRef = useRef<{ close: () => void } | null>(null);

  useEffect(() => {
    // Pas d'utilisateur connecté → on ferme tout
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      return;
    }

    // ===== WebSocket (Socket.IO) =====
    const token = getAccessToken();
    const API_BASE = import.meta.env.VITE_API_BASE as string;
    const base = API_BASE.replace(/\/$/, "");

    const socket = io(base, {
      transports: ["websocket"],
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[WS] connected", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[WS] disconnected", reason);
    });

    socket.on("welcome", (d) => {
      console.log("[WS] welcome", d);
    });

    socket.on("notify", (data: any) => {
      console.log("[WS] notify", data);
      // @ts-ignore - toast global Bootstrap
      window?.duuminiToast?.({
        title: data.title || "Notification",
        message: data.body || "",
      });
    });

    // ===== SSE (Server-Sent Events) =====
    const sseUrl = `${base}/api/events/stream`;

    const sub = subscribeSSE(sseUrl, (evt: ServerEvent) => {
      console.log("[SSE] event", evt);

      if (evt.type === "ORDER_CREATED") {
        // @ts-ignore
        window?.duuminiToast?.({
          title: evt.payload?.title || "Nouvelle commande",
          message: evt.payload?.body || "",
        });
      }

      if (evt.type === "ORDER_STATUS") {
        // Ici tu peux plus tard rafraîchir une liste, etc.
      }
    });

    sseRef.current = sub;

    return () => {
      socket.disconnect();
      sub.close();
    };
  }, [user]);

  return (
    <RealtimeContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
