// src/components/InstallPWA.tsx
import { useEffect, useMemo, useState } from "react";
import { usePWAInstall } from "../hooks/usePWAInstall";

function isiOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isSafari() {
  // Safari iOS ou desktop (approx)
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

type InstallStatus = "idle" | "accepted" | "dismissed" | "error";

export default function InstallPWA({ className = "" }: { className?: string }) {
  const { installed, supportsPrompt, promptInstall } = usePWAInstall();

  const [openTips, setOpenTips] = useState(false);
  const [status, setStatus] = useState<InstallStatus>("idle");
  const [installing, setInstalling] = useState(false);

  // ✅ ne plus afficher toute la carte si hide_until dans le futur
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const until = Number(localStorage.getItem("pwa_install_hide_until") || 0);
    setHidden(Date.now() < until);
  }, []);

  const hideForADay = () => {
    localStorage.setItem(
      "pwa_install_hide_until",
      String(Date.now() + 24 * 3600 * 1000)
    );
    setHidden(true);
    setOpenTips(false);
  };

  const showIosTips = useMemo(() => {
    // iOS Safari ne supporte pas beforeinstallprompt
    return isiOS() && isSafari() && !supportsPrompt;
  }, [supportsPrompt]);

  // ✅ Important: si on n’est ni éligible (supportsPrompt) ni iOS tips,
  // on n’affiche PAS la carte. Ça évite le cas “preventDefault sans prompt”.
  const shouldRender = useMemo(() => {
    return !installed && !hidden && (supportsPrompt || showIosTips);
  }, [installed, hidden, showIosTips, supportsPrompt]);

  if (!shouldRender) return null;

  async function handleInstallClick() {
    try {
      setInstalling(true);
      setStatus("idle");

      const res = await promptInstall();
      // hook corrigé: { shown: boolean, outcome: "accepted"|"dismissed"|null }
      if (!res?.shown) {
        setStatus("error");
        hideForADay();
        return;
      }

      const outcome = res.outcome;
      if (outcome === "accepted") {
        setStatus("accepted");
        // en général appinstalled arrivera, sinon on laisse le composant disparaître via installed=true
        return;
      }

      // dismissed
      setStatus("dismissed");
      hideForADay();
    } catch {
      setStatus("error");
      hideForADay();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className={`card border-0 shadow-sm ${className}`}>
      <div className="card-body d-flex flex-column flex-md-row align-items-md-center gap-2">
        <div className="flex-grow-1">
          <div className="fw-semibold">Installe l’application Duumini</div>
          <div className="text-muted small">
            Accès rapide, plein écran, notifications.
          </div>

          {status === "accepted" && (
            <div className="mt-2 small text-success">
              Installation lancée. Merci !
            </div>
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
          <div className="d-flex gap-2">
            <button
              className="btn btn-duu d-inline-flex align-items-center gap-2"
              onClick={handleInstallClick}
              disabled={installing}
              type="button"
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

            <button
              className="btn btn-outline-dark"
              type="button"
              onClick={hideForADay}
            >
              Plus tard
            </button>
          </div>
        ) : (
          // iOS Safari
          <div className="d-flex flex-column flex-md-row gap-2 align-items-md-start w-100">
            <button
              className="btn btn-dark"
              onClick={() => setOpenTips((v) => !v)}
              type="button"
            >
              Comment installer ?
            </button>

            {openTips && (
              <div className="alert alert-secondary mb-0 flex-grow-1">
                <div className="fw-semibold mb-1">iPhone/iPad (Safari)</div>
                <ol className="m-0 ps-3 small">
                  <li>
                    Ouvre le menu <strong>Partager</strong> (icône carré + flèche).
                  </li>
                  <li>
                    Choisis <strong>« Ajouter à l’écran d’accueil »</strong>.
                  </li>
                  <li>
                    Valide le nom puis <strong>Ajouter</strong>.
                  </li>
                </ol>
                <div className="d-flex gap-2 mt-2">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={hideForADay}
                    type="button"
                  >
                    Ne plus afficher aujourd’hui
                  </button>
                  <button
                    className="btn btn-sm btn-outline-dark"
                    onClick={() => setOpenTips(false)}
                    type="button"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .btn-duu{ background: var(--duu-yellow); color:#1f1f1f; border:none; }
        .btn-duu:hover{ filter: brightness(0.95); }
      `}</style>
    </div>
  );
}
