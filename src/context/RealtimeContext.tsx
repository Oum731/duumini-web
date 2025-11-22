// src/context/RealtimeContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { subscribeSSE, type ServerEvent } from "../services/events";
import { getAccessToken } from "../services/auth";
import { useAuth } from "./AuthContext";
import { API_BASE } from "../services/http"; // ✅ très important

type RealtimeContextType = {
  socket: Socket | null;
};

const RealtimeContext = createContext<RealtimeContextType>({ socket: null });

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const sseRef = useRef<{ close: () => void } | null>(null);

  // état exposé pour rerender
  const [socketState, setSocketState] = useState<Socket | null>(null);

  useEffect(() => {
    const userId = user?.id;

    // Pas d'utilisateur → on ferme tout
    if (!userId) {
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch {}
        socketRef.current = null;
      }
      if (sseRef.current) {
        try {
          sseRef.current.close();
        } catch {}
        sseRef.current = null;
      }
      setSocketState(null);
      return;
    }

    const token = getAccessToken();
    const base = (API_BASE || window.location.origin).replace(/\/+$/, "");

    if (!token) {
      console.warn("[Realtime] user défini mais aucun access token trouvé");
      return;
    }

    /* ========= WebSocket (Socket.IO) ========= */
    let socket: Socket | null = null;
    try {
      socket = io(base, {
        transports: ["websocket"],
        auth: { token },
      });
    } catch (e) {
      console.error("[WS] init error", e);
    }

    if (socket) {
      socketRef.current = socket;
      setSocketState(socket);

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
    }

    /* ========= SSE (Server-Sent Events) ========= */
    const sseUrl = `${base}/api/events/stream${
      token ? `?access_token=${encodeURIComponent(token)}` : ""
    }`;

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
        // plus tard : refresh listes commandes
      }
    });

    sseRef.current = sub;

    return () => {
      try {
        socket?.disconnect();
      } catch {}
      try {
        sub.close();
      } catch {}
      socketRef.current = null;
      sseRef.current = null;
      setSocketState(null);
    };
  }, [user?.id]);

  return (
    <RealtimeContext.Provider value={{ socket: socketState }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
