// src/components/Footer.tsx
import React, { useEffect, useState } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { DUUMINI_SLOGAN, WHATSAPP_DISPLAY, WHATSAPP_LINK } from "../lib/brand";
import { getSiteStatus, type SiteStatus } from "../services/products";
import { useConsent } from "../context/ConsentContext";
import { btnClass } from "./ui/dzClass";

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
  const { openPanel } = useConsent();
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);
  const [siteStatusLoading, setSiteStatusLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setSiteStatusLoading(true);
        const res = await getSiteStatus();
        if (!mounted) return;
        setSiteStatus(res);
      } catch {
        if (!mounted) return;
        setSiteStatus(null);
      } finally {
        if (mounted) setSiteStatusLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const siteClosed = !!siteStatus?.is_closed;
  const showShopLinks = !siteStatusLoading && !siteClosed;

  return (
    // ✅ Refonte 2026 : footer repris en vert foncé (--dz-green-dark), en
    // écho aux bannières CTA de l'accueil, au lieu du fond blanc précédent —
    // même structure/liens/logique (statut boutique, cookies) qu'avant.
    <footer className="duu-footer-dark mt-4" style={{ background: "var(--dz-green-dark)" }}>
      <style>{`
        .duu-footer-dark{ font-family: var(--dz-font-body); }
        .duu-footer-slogan{
          font-weight: 900;
          color: rgba(255,255,255,.9);
          margin-bottom: .35rem;
        }
        .duu-footer-dark h6{
          color: #fff !important;
        }
        .duu-footer-dark .text-muted{
          color: rgba(255,255,255,.55) !important;
        }
        .duu-footer-link{
          color: rgba(255,255,255,.75);
          text-decoration: none;
        }
        .duu-footer-link:hover{
          color: var(--dz-yellow);
        }
        .duu-footer-dark hr{
          border-color: rgba(255,255,255,.15);
          opacity: 1;
        }
      `}</style>

      <div className="container-xxl py-4">
        <div className="row g-4">
          <div className="col-12 col-md-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <img
                src="/logo.jpeg"
                alt="Duumini"
                height={36}
                className="rounded"
              />
            </div>

            <div className="duu-footer-slogan">{DUUMINI_SLOGAN}</div>

            <p className="text-muted mb-2" style={{ maxWidth: 420 }}>
              DUUMINI est le réseau qui met en relation vendeurs, fournisseurs
              et producteurs à travers l’Afrique — le commerce circule d’un
              pays à l’autre, dans les deux sens.
            </p>

            <div className="d-flex gap-2">
              <a
                href={WHATSAPP_LINK}
                className="btn btn-duu btn-sm"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a
                href="mailto:duuminima@gmail.com"
                className={btnClass("outline", "btn-sm")}
                style={{ borderColor: "rgba(255,255,255,.5)", color: "#fff", padding: "6px 16px", fontSize: 14 }}
              >
                Email
              </a>
            </div>
          </div>

          <div className="col-6 col-md-2">
            <h6 className="fw-bold">Menu</h6>
            <ul className="list-unstyled m-0">
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/">
                  Accueil
                </TopLink>
              </li>

              {showShopLinks && (
                <li>
                  <TopLink
                    className="duu-footer-link d-block py-1"
                    to="/african-market"
                  >
                    Duumini Market
                  </TopLink>
                </li>
              )}

              {showShopLinks && (
                <li>
                  <TopLink
                    className="duu-footer-link d-block py-1"
                    to="/african-food"
                  >
                    Duumini Food
                  </TopLink>
                </li>
              )}

              {showShopLinks && (
                <li>
                  <TopLink className="duu-footer-link d-block py-1" to="/fashion">
                    Duumini Fashion
                  </TopLink>
                </li>
              )}

              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/cart">
                  Panier
                </TopLink>
              </li>
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/orders">
                  Mes commandes
                </TopLink>
              </li>
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/contact">
                  Contact
                </TopLink>
              </li>
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/about">
                  Notre vision
                </TopLink>
              </li>
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/comment-ca-marche">
                  Comment ça marche
                </TopLink>
              </li>
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/solutions">
                  Solutions
                </TopLink>
              </li>
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/pays">
                  Pays
                </TopLink>
              </li>
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/blog">
                  Ressources
                </TopLink>
              </li>
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/rejoindre">
                  Devenir vendeur/fournisseur
                </TopLink>
              </li>
            </ul>
          </div>

          <div className="col-6 col-md-3">
            <h6 className="fw-bold">Informations légales</h6>
            <ul className="list-unstyled m-0">
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/legal/privacy">
                  Confidentialité &amp; données
                </TopLink>
              </li>
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/legal/terms">
                  Conditions d’utilisation
                </TopLink>
              </li>
              <li>
                <TopLink className="duu-footer-link d-block py-1" to="/legal/returns">
                  Politique de retour
                </TopLink>
              </li>
              <li>
                <button
                  type="button"
                  className="btn btn-link duu-footer-link text-decoration-none p-0 d-block py-1"
                  onClick={openPanel}
                >
                  Gérer les cookies
                </button>
              </li>
            </ul>
          </div>

          <div className="col-12 col-md-3">
            <h6 className="fw-bold">Support</h6>
            <ul className="list-unstyled m-0">
              <li className="py-1">
                <span className="text-muted d-block small">WhatsApp</span>
                <a className="duu-footer-link" href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                  {WHATSAPP_DISPLAY}
                </a>
              </li>
              <li className="py-1">
                <span className="text-muted d-block small">Email</span>
                <a className="duu-footer-link" href="mailto:duuminima@gmail.com">
                  duuminima@gmail.com
                </a>
              </li>
              <li className="py-1">
                <span className="text-muted d-block small">Horaires</span>
                <span style={{ color: "rgba(255,255,255,.85)" }}>09:00 — 20:00 (tous les jours)</span>
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
            <TopLink to="/legal/privacy" className="duu-footer-link">
              Confidentialité
            </TopLink>
            <span className="text-muted mx-2">•</span>
            <TopLink to="/legal/terms" className="duu-footer-link">
              Conditions
            </TopLink>
            <span className="text-muted mx-2">•</span>
            <TopLink to="/legal/returns" className="duu-footer-link">
              Retours
            </TopLink>
            <span className="text-muted mx-2">•</span>
            <button
              type="button"
              className="btn btn-link duu-footer-link text-decoration-none p-0 align-baseline"
              onClick={openPanel}
            >
              Gérer les cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
