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

type RealtimeContextType = {
  socket: Socket | null;
};

const RealtimeContext = createContext<RealtimeContextType>({ socket: null });

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const sseRef = useRef<{ close: () => void } | null>(null);

  // 👇 état exposé dans le contexte (pour forcer le rerender des consumers)
  const [socketState, setSocketState] = useState<Socket | null>(null);

  useEffect(() => {
    const userId = user?.id;

    // 👉 Pas d'utilisateur connecté → on ferme tout
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
    const API_BASE = import.meta.env.VITE_API_BASE as string;
    const base = API_BASE.replace(/\/$/, "");

    if (!token) {
      // utilisateur en mémoire mais pas de token → on ne tente pas les connexions protégées
      console.warn("[Realtime] user défini mais aucun access token trouvé");
      return;
    }

    // ===== WebSocket (Socket.IO) =====
    const socket = io(base, {
      transports: ["websocket"],
      auth: { token },
    });

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

    // ===== SSE (Server-Sent Events) =====
    // On passe le token en query string pour que le backend authRequired puisse l’utiliser
    const sseUrl = `${base}/api/events/stream?access_token=${encodeURIComponent(
      token
    )}`;

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
        // Ici tu pourras plus tard déclencher un refresh des listes de commandes
      }
    });

    sseRef.current = sub;

    return () => {
      try {
        socket.disconnect();
      } catch {}
      try {
        sub.close();
      } catch {}
      socketRef.current = null;
      sseRef.current = null;
      setSocketState(null);
    };
    // 🟢 On dépend UNIQUEMENT de l'id user (login / logout / changement user)
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
