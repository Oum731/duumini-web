// src/components/EnableNotificationsButton.tsx
import { useState } from "react";
import { initPush, registerDeviceWithApi } from "../services/push";

export default function EnableNotificationsButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "granted" | "denied" | "error">("idle");

  async function handleEnable() {
    try {
      setLoading(true);
      const token = await initPush(); // permission + SW + Pushy.register
      if (token) {
        await registerDeviceWithApi(token);
        setStatus("granted");
      } else {
        setStatus(Notification.permission === "denied" ? "denied" : "idle");
      }
    } catch (e) {
      console.warn("[EnableNotificationsButton] error", e);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  const label =
    status === "granted" ? "Notifications activées ✅" :
    status === "denied"  ? "Notifications bloquées (navigateur) ❌" :
    status === "error"   ? "Erreur — réessayer" :
    "Activer les notifications";

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-dark"
      onClick={handleEnable}
      disabled={loading || status === "granted"}
      aria-busy={loading}
    >
      {loading ? "Activation…" : label}
    </button>
  );
}
