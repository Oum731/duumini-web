// src/services/events.ts
export type ServerEvent =
  | { type: "ORDER_CREATED"; payload?: any }
  | { type: "ORDER_STATUS"; payload?: any }
  | { type: string; payload?: any };

type Sub = { close(): void };

export function subscribeSSE(url: string, onEvent: (evt: ServerEvent) => void): Sub {
  if (typeof window === "undefined" || !("EventSource" in window)) {
    return { close() {} };
  }

  let es: EventSource | null = null;
  let stopped = false;
  let retry = 0;
  let retryTimer: any = null;

  const connect = () => {
    if (stopped) return;

    try {
      // ✅ withCredentials => cookies only (EventSource ne supporte pas Authorization header)
      es = new EventSource(url, { withCredentials: true });

      es.addEventListener("open", () => {
        retry = 0;
      });

      es.addEventListener("message", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.type) onEvent(data as ServerEvent);
        } catch {
          // ignore
        }
      });

      es.addEventListener("error", () => {
        // ✅ reconnexion progressive
        try {
          es?.close();
        } catch {}
        es = null;

        if (stopped) return;

        retry += 1;
        const wait = Math.min(30_000, 1000 * Math.pow(2, Math.min(6, retry))); // 1s -> 2s -> ... -> 30s

        clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, wait);
      });
    } catch {
      // même logique de retry si EventSource throw
      retry += 1;
      const wait = Math.min(30_000, 1000 * Math.pow(2, Math.min(6, retry)));
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, wait);
    }
  };

  connect();

  return {
    close() {
      stopped = true;
      clearTimeout(retryTimer);
      try {
        es?.close();
      } catch {}
      es = null;
    },
  };
}