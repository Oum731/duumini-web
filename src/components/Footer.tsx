// src/components/Footer.tsx
import React, { useMemo } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { DUUMINI_SLOGAN } from "../lib/brand";

/* 📅 Date d'ouverture (doit matcher Home.tsx) */
const DUUMINI_OPEN_ISO = "2025-12-21T00:00:00+01:00";

/** Helper date */
function isDateReached(iso: string) {
  return Date.now() >= new Date(iso).getTime();
}

/** Link qui remonte en haut de page au clic (Footer) */
function TopLink(
  props: LinkProps & { className?: string; children?: React.ReactNode }
) {
  const { onClick, ...rest } = props;
  return (
    <Link
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          requestAnimationFrame(() => {
            try {
              window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            } catch {
              window.scrollTo(0, 0);
            }
          });
        }
      }}
    />
  );
}

export default function Footer() {
  const isOpen = useMemo(
    () => isDateReached(DUUMINI_OPEN_ISO),
    []
  );

  return (
    <footer className="border-top mt-4" style={{ background: "#fff" }}>
      <style>{`
        .duu-footer-slogan{
          font-weight: 900;
          color: rgba(0,0,0,.75);
          margin-bottom: .35rem;
        }
      `}</style>

      <div className="container-xxl py-4">
        <div className="row g-4">
          {/* ================= Brand ================= */}
          <div className="col-12 col-md-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <img
                src="/logo.jpeg"
                alt="Duumini"
                height={36}
                className="rounded"
              />
              <span className="fw-bold" style={{ color: "var(--duu-black)" }}>
                Duumini
              </span>
            </div>

            <div className="duu-footer-slogan">{DUUMINI_SLOGAN}</div>

            <p className="text-muted mb-2" style={{ maxWidth: 420 }}>
              Produits et saveurs d’Afrique subsaharienne — livrés à Casablanca
              et Marrakech.
            </p>

            <div className="d-flex gap-2">
              <a
                href="https://wa.me/212623677884"
                className="btn btn-duu btn-sm"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a
                href="mailto:duuminima@gmail.com"
                className="btn btn-outline-dark btn-sm"
              >
                Email
              </a>
            </div>
          </div>

          {/* ================= Navigation ================= */}
          <div className="col-6 col-md-2">
            <h6 className="fw-bold" style={{ color: "var(--duu-black)" }}>
              Menu
            </h6>
            <ul className="list-unstyled m-0">
              <li>
                <TopLink className="link-dark d-block py-1" to="/">
                  Accueil
                </TopLink>
              </li>

              {/* ✅ Duumini Market → visible SEULEMENT après ouverture */}
              {isOpen && (
                <li>
                  <TopLink
                    className="link-dark d-block py-1"
                    to="/african-market"
                  >
                    Duumini Market
                  </TopLink>
                </li>
              )}

              <li>
                <TopLink className="link-dark d-block py-1" to="/cart">
                  Panier
                </TopLink>
              </li>
              <li>
                <TopLink className="link-dark d-block py-1" to="/orders">
                  Mes commandes
                </TopLink>
              </li>
              <li>
                <TopLink className="link-dark d-block py-1" to="/contact">
                  Contact
                </TopLink>
              </li>
              <li>
                <TopLink className="link-dark d-block py-1" to="/about">
                  À propos
                </TopLink>
              </li>
            </ul>
          </div>

          {/* ================= Légal ================= */}
          <div className="col-6 col-md-3">
            <h6 className="fw-bold" style={{ color: "var(--duu-black)" }}>
              Informations légales
            </h6>
            <ul className="list-unstyled m-0">
              <li>
                <TopLink className="link-dark d-block py-1" to="/legal/privacy">
                  Confidentialité &amp; données
                </TopLink>
              </li>
              <li>
                <TopLink className="link-dark d-block py-1" to="/legal/terms">
                  Conditions d’utilisation
                </TopLink>
              </li>
              <li>
                <TopLink className="link-dark d-block py-1" to="/legal/returns">
                  Politique de retour
                </TopLink>
              </li>
            </ul>
          </div>

          {/* ================= Support ================= */}
          <div className="col-12 col-md-3">
            <h6 className="fw-bold" style={{ color: "var(--duu-black)" }}>
              Support
            </h6>
            <ul className="list-unstyled m-0">
              <li className="py-1">
                <span className="text-muted d-block small">WhatsApp</span>
                <a
                  className="link-dark text-decoration-none"
                  href="https://wa.me/212623677884"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  +212 6 23 67 78 84
                </a>
              </li>
              <li className="py-1">
                <span className="text-muted d-block small">Email</span>
                <a
                  className="link-dark text-decoration-none"
                  href="mailto:duuminima@gmail.com"
                >
                  duuminima@gmail.com
                </a>
              </li>
              <li className="py-1">
                <span className="text-muted d-block small">Horaires</span>
                <span>09:00 — 20:00 (tous les jours)</span>
              </li>
            </ul>
          </div>
        </div>

        <hr className="my-3" />

        <div className="d-flex flex-column flex-sm-row justify-content-between gap-2">
          <div className="small text-muted">
            © {new Date().getFullYear()} Duumini — Tous droits réservés.
          </div>
          <div className="small">
            <TopLink to="/legal/privacy" className="link-dark text-decoration-none">
              Confidentialité
            </TopLink>
            <span className="text-muted mx-2">•</span>
            <TopLink to="/legal/terms" className="link-dark text-decoration-none">
              Conditions
            </TopLink>
            <span className="text-muted mx-2">•</span>
            <TopLink to="/legal/returns" className="link-dark text-decoration-none">
              Retours
            </TopLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
