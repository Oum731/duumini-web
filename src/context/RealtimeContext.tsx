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
import { API_BASE } from "../services/http";

type NotificationKind =
  | "GENERIC"
  | "ORDER_CREATED"
  | "ORDER_STATUS"
  | "COURIER_TRIP_REQUESTED"
  | "COURIER_TRIP_STATUS";

type RealtimeContextType = {
  socket: Socket | null;
  lastNotification?: {
    title: string;
    message: string;
    href?: string;
  } | null;
  clearNotification: () => void;
};

const RealtimeContext = createContext<RealtimeContextType>({
  socket: null,
  lastNotification: null,
  clearNotification: () => {},
});

// 🔊 Audios (lazy, pour éviter les soucis SSR)
let audioGeneric: HTMLAudioElement | null = null;
let audioOrderCreated: HTMLAudioElement | null = null;
let audioOrderStatus: HTMLAudioElement | null = null;

function getAudioForKind(kind: NotificationKind): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;

  // Les courses livreur réutilisent les sons commande — pas de nouveaux
  // fichiers audio à ajouter pour ce type d'événement.
  if (kind === "ORDER_CREATED" || kind === "COURIER_TRIP_REQUESTED") {
    if (!audioOrderCreated) {
      audioOrderCreated = new Audio("/sounds/notify-order-created.mp3");
    }
    return audioOrderCreated;
  }

  if (kind === "ORDER_STATUS" || kind === "COURIER_TRIP_STATUS") {
    if (!audioOrderStatus) {
      audioOrderStatus = new Audio("/sounds/notify-order-status.mp3");
    }
    return audioOrderStatus;
  }

  if (!audioGeneric) {
    audioGeneric = new Audio("/sounds/notify-generic.mp3");
  }
  return audioGeneric;
}

/** 🔊 Joue un son selon le type de notification */
function playSound(kind: NotificationKind) {
  try {
    const el = getAudioForKind(kind);
    if (!el) return;
    el.currentTime = 0;
    el.volume = 0.9;
    el.play().catch(() => {});
  } catch {
    // ignore
  }
}

/** 📳 Vibre selon le type de notification (si supporté) */
function vibrate(kind: NotificationKind) {
  if (typeof navigator === "undefined") return;
  const anyNav = navigator as any;
  if (!anyNav.vibrate) return;

  let pattern: number[] | number = 60;
  if (kind === "ORDER_CREATED" || kind === "COURIER_TRIP_REQUESTED") {
    // vibration plus forte pour nouvelle commande / nouvelle course
    pattern = [140, 80, 140];
  } else if (kind === "ORDER_STATUS" || kind === "COURIER_TRIP_STATUS") {
    // vibration double pour changement de statut
    pattern = [90, 50, 90];
  } else {
    pattern = 60;
  }

  try {
    anyNav.vibrate(pattern);
  } catch {
    // ignore
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const sseRef = useRef<{ close: () => void } | null>(null);

  const [socketState, setSocketState] = useState<Socket | null>(null);
  const [lastNotification, setLastNotification] =
    useState<RealtimeContextType["lastNotification"]>(null);

  function clearNotification() {
    setLastNotification(null);
  }

  /** Affiche la bulle + toast + son + vibration */
  function showToast(data: {
    title?: string;
    body?: string;
    href?: string;
    kind?: NotificationKind;
  }) {
    const kind: NotificationKind = data.kind || "GENERIC";

    playSound(kind);
    vibrate(kind);

    setLastNotification({
      title: data.title || "Notification",
      message: data.body || "",
      href: data.href,
    });

    // Optionnel : toast Bootstrap globale si elle existe
    // @ts-ignore
    window?.duuminiToast?.({
      title: data.title || "Notification",
      message: data.body || "",
    });
  }

  useEffect(() => {
    const userId = user?.id;

    if (!userId) {
      // 🔴 Pas d'utilisateur → on ferme tout
      try {
        socketRef.current?.disconnect();
      } catch {}
      socketRef.current = null;

      try {
        sseRef.current?.close();
      } catch {}
      sseRef.current = null;

      setSocketState(null);
      setLastNotification(null);
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

      // 🔔 Notifs temps réel via WS
      socket.on("notify", (data: any) => {
        console.log("[WS] notify", data);
        const rawType = (data?.type || "").toString().toUpperCase();
        const KNOWN_KINDS: NotificationKind[] = [
          "ORDER_CREATED",
          "ORDER_STATUS",
          "COURIER_TRIP_REQUESTED",
          "COURIER_TRIP_STATUS",
        ];
        const kind: NotificationKind = KNOWN_KINDS.includes(rawType as NotificationKind)
          ? (rawType as NotificationKind)
          : "GENERIC";

        showToast({
          title: data.title,
          body: data.body,
          href: data.href,
          kind,
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
        showToast({
          title: evt.payload?.title || "Nouvelle commande",
          body: evt.payload?.body || "",
          href: "/orders",
          kind: "ORDER_CREATED",
        });
      }

      if (evt.type === "ORDER_STATUS") {
        showToast({
          title: evt.payload?.title || "Commande mise à jour",
          body: evt.payload?.body || "",
          href: evt.payload?.order_id
            ? `/orders?id=${evt.payload.order_id}`
            : "/orders",
          kind: "ORDER_STATUS",
        });
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
    <RealtimeContext.Provider
      value={{ socket: socketState, lastNotification, clearNotification }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
