// src/components/CookieBanner.tsx
import { useState } from "react";
import { Modal } from "../pages/profile/components/Modal";
import { useConsent } from "../context/ConsentContext";

const CATEGORY_COPY = {
  essential: {
    label: "Essentiels",
    description: "Nécessaires au fonctionnement du Site (panier, session). Toujours actifs.",
  },
  audience: {
    label: "Mesure d'audience",
    description:
      "Statistiques anonymisées de fréquentation (Google Tag Manager, Metricool) — nous aident à comprendre l'usage du Site.",
  },
  marketing: {
    label: "Marketing",
    description:
      "Publicités et retargeting (Meta Pixel) — nous permettent de vous montrer des offres pertinentes sur Facebook/Instagram.",
  },
} as const;

export default function CookieBanner() {
  const { hasDecided, categories, acceptAll, rejectAll, setCategories, isPanelOpen, openPanel, closePanel } =
    useConsent();

  const [draft, setDraft] = useState({ audience: categories.audience, marketing: categories.marketing });

  function openCustomize() {
    setDraft({ audience: categories.audience, marketing: categories.marketing });
    openPanel();
  }

  function saveDraft() {
    setCategories(draft);
  }

  return (
    <>
      {!hasDecided && (
        <div
          className="position-fixed bottom-0 start-0 w-100"
          style={{
            zIndex: 1040,
            background: "#fff",
            boxShadow: "var(--duu-shadow-lg)",
            borderTop: "1px solid rgba(0,0,0,.08)",
          }}
          role="region"
          aria-label="Consentement cookies"
        >
          <div className="container-xxl py-3 d-flex flex-column flex-md-row align-items-md-center gap-3">
            <p className="text-muted small mb-0 flex-fill">
              DUUMINI utilise des cookies essentiels au fonctionnement du Site, et — avec votre accord —
              des cookies de mesure d'audience et marketing pour améliorer votre expérience.{" "}
              <a href="/legal/privacy" className="link-dark">En savoir plus</a>.
            </p>
            <div className="d-flex gap-2 flex-shrink-0">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={rejectAll}>
                Refuser tout
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={openCustomize}>
                Personnaliser
              </button>
              <button type="button" className="btn btn-duu-green btn-sm" onClick={acceptAll}>
                Accepter tout
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal open={isPanelOpen} title="Gérer vos préférences cookies" onClose={closePanel}>
        <div className="vstack gap-3">
          {(["essential", "audience", "marketing"] as const).map((key) => {
            const copy = CATEGORY_COPY[key];
            const isEssential = key === "essential";
            const checked = isEssential ? true : draft[key];
            return (
              <div key={key} className="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <div className="fw-semibold">{copy.label}</div>
                  <div className="text-muted small">{copy.description}</div>
                </div>
                <div className="form-check form-switch flex-shrink-0 mt-1">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={checked}
                    disabled={isEssential}
                    onChange={(e) =>
                      !isEssential && setDraft((d) => ({ ...d, [key]: e.target.checked }))
                    }
                    aria-label={copy.label}
                  />
                </div>
              </div>
            );
          })}

          <div className="d-flex flex-wrap gap-2 justify-content-end pt-2 border-top">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={rejectAll}>
              Tout refuser
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={acceptAll}>
              Tout accepter
            </button>
            <button type="button" className="btn btn-duu-green btn-sm" onClick={saveDraft}>
              Enregistrer mes choix
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
