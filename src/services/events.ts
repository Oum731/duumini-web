// src/services/events.ts
export type ServerEvent =
  | { type: "ORDER_CREATED"; payload?: any }
  | { type: "ORDER_STATUS"; payload?: any }
  | { type: string; payload?: any };

export function subscribeSSE(
  url: string,
  onEvent: (evt: ServerEvent) => void
) {
  if (typeof window === "undefined" || !("EventSource" in window)) {
    return { close() {} };
  }

  try {
    const es = new EventSource(url, { withCredentials: true });

    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.type) onEvent(data as ServerEvent);
      } catch {
        // message non JSON: on ignore
      }
    };

    es.addEventListener("message", handler);
    es.addEventListener("error", () => {
      // silencieux pour l'instant
    });

    return {
      close() {
        try {
          es.close();
        } catch {}
      },
    };
  } catch {
    return { close() {} };
  }
}
