// src/components/InstallPWA.tsx
import { useEffect, useState } from "react";
import { usePWAInstall } from "../hooks/usePWAInstall";

function isiOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isSafari() {
  // iOS Safari ou Safari desktop
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

type InstallStatus = "idle" | "accepted" | "dismissed" | "error";

export default function InstallPWA({ className = "" }: { className?: string }) {
  const { installed, supportsPrompt, promptInstall } = usePWAInstall();
  const [openTips, setOpenTips] = useState(false);
  const [status, setStatus] = useState<InstallStatus>("idle");
  const [installing, setInstalling] = useState(false);

  // fréquence : ne pas réafficher si l’utilisateur a fermé récemment
  useEffect(() => {
    const last = Number(localStorage.getItem("pwa_install_hide_until") || 0);
    if (Date.now() < last) setOpenTips(false);
  }, []);
  const hideForADay = () => {
    localStorage.setItem("pwa_install_hide_until", String(Date.now() + 24 * 3600 * 1000));
    setOpenTips(false);
  };

  if (installed) return null;

  const showIosTips = isiOS() && isSafari() && !supportsPrompt;

  async function handleInstallClick() {
    try {
      setInstalling(true);
      setStatus("idle");
      const { outcome } = await promptInstall(); // "accepted" | "dismissed"
      setStatus(outcome);
      // Si refus, ne plus déranger pendant 24h
      if (outcome === "dismissed") {
        hideForADay();
      }
      // Analytics facultatif
      // console.info("[PWA] install outcome:", outcome);
    } catch {
      setStatus("error");
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className={`card border-0 shadow-sm ${className}`}>
      <div className="card-body d-flex flex-column flex-md-row align-items-md-center gap-2">
        <div className="flex-grow-1">
          <div className="fw-semibold">Installe l’application Duumini</div>
          <div className="text-muted small">Accès rapide, plein écran, notifications.</div>

          {/* Feedback non intrusif */}
          {status === "accepted" && (
            <div className="mt-2 small text-success">Installation lancée. Merci !</div>
          )}
          {status === "dismissed" && (
            <div className="mt-2 small text-muted">
              D’accord, on ne reproposera pas avant 24h.
            </div>
          )}
          {status === "error" && (
            <div className="mt-2 small text-danger">
              Impossible d’ouvrir l’invite d’installation.
            </div>
          )}
        </div>

        {supportsPrompt ? (
          <button
            className="btn btn-duu d-inline-flex align-items-center gap-2"
            onClick={handleInstallClick}
            disabled={installing}
          >
            {installing && (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              />
            )}
            <span>{installing ? "Ouverture…" : "Installer maintenant"}</span>
          </button>
        ) : showIosTips ? (
          <>
            <button className="btn btn-dark" onClick={() => setOpenTips(true)}>
              Comment installer ?
            </button>
            {openTips && (
              <div className="mt-2 alert alert-secondary mb-0">
                <div className="fw-semibold mb-1">iPhone/iPad (Safari)</div>
                <ol className="m-0 ps-3 small">
                  <li>Ouvre le menu <strong>Partager</strong> (icône carré + flèche).</li>
                  <li>Choisis <strong>« Ajouter à l’écran d’accueil »</strong>.</li>
                  <li>Valide le nom puis <strong>Ajouter</strong>.</li>
                </ol>
                <div className="d-flex gap-2 mt-2">
                  <button className="btn btn-sm btn-outline-secondary" onClick={hideForADay}>
                    Ne plus afficher aujourd’hui
                  </button>
                  <button className="btn btn-sm btn-outline-dark" onClick={() => setOpenTips(false)}>
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          // Fallback autres navigateurs : lien explicatif
          <a
            className="btn btn-outline-dark"
            href="https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing"
            target="_blank"
            rel="noreferrer"
          >
            En savoir plus
          </a>
        )}
      </div>
    </div>
  );
}
