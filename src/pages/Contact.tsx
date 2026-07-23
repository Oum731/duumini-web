// src/pages/Contact.tsx
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Mail, Phone, MessageSquare, MapPin } from "lucide-react";
import { Seo } from "../components/Seo";

const RAW_WHATSAPP = "+21262367784";
const EMAIL = "duuminima@gmail.com";
const MAP_Q = "33.555706,-7.704473";
const MAP_URL = `https://maps.google.com/?q=${MAP_Q}`;

function normalizePhoneIntl(p?: string) {
  const raw = String(p || "").replace(/\s+/g, "");
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return "+" + raw.slice(2);
  if (/^0\d{9,}$/.test(raw)) return "+212" + raw.slice(1);
  return raw;
}

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const wantsToSell = searchParams.get("intent") === "join";

  const phoneIntl = useMemo(() => normalizePhoneIntl(RAW_WHATSAPP), []);
  const waLink = useMemo(() => {
    const text = encodeURIComponent(
      wantsToSell
        ? "Bonjour, je souhaite vendre mes produits sur DUUMINI."
        : "Bonjour, j’aimerais avoir des informations, merci."
    );
    const num = phoneIntl.replace(/^\+/, "");
    return `https://wa.me/${num}?text=${text}`;
  }, [phoneIntl, wantsToSell]);

  const telLink = `tel:${phoneIntl}`;

  return (
    <section className="container-xxl py-4">
      <Seo
        title="Contact"
        description="Contactez l'équipe DUUMINI par WhatsApp, email ou téléphone pour toute question sur nos produits, notre logistique ou pour rejoindre le réseau."
        path="/contact"
      />
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 m-0" style={{ color: "var(--duu-black)" }}>Contact</h1>
        <Link to="/" className="btn btn-outline-dark">Accueil</Link>
      </div>

      {wantsToSell && (
        <div
          className="alert mb-4"
          style={{
            background: "rgba(var(--duu-green-rgb), .08)",
            border: "1px solid rgba(var(--duu-green-rgb), .25)",
            color: "var(--duu-green)",
          }}
        >
          Vous souhaitez vendre sur DUUMINI ? Écrivez-nous, nous vous
          recontactons sous 24h.
        </div>
      )}

      <p className="text-muted mb-4">
        Une question sur un produit, une commande ou une livraison&nbsp;? Écrivez-nous ou contactez-nous directement.
      </p>

      <div className="row g-3">
        {/* WhatsApp */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <div className="d-flex align-items-center gap-2 mb-2">
                <MessageSquare size={20} />
                <h2 className="h6 m-0" style={{ color: "var(--duu-black)" }}>WhatsApp</h2>
              </div>
              <div className="text-muted mb-3">{RAW_WHATSAPP}</div>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-success mt-auto"
                aria-label="Ouvrir WhatsApp"
              >
                Discuter sur WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <div className="d-flex align-items-center gap-2 mb-2">
                <Mail size={20} />
                <h2 className="h6 m-0" style={{ color: "var(--duu-black)" }}>Email</h2>
              </div>
              <div className="text-muted mb-3">{EMAIL}</div>
              <a
                href={`mailto:${EMAIL}?subject=${encodeURIComponent("Contact Duumini")}`}
                className="btn btn-outline-dark mt-auto"
              >
                Écrire un email
              </a>
            </div>
          </div>
        </div>

        {/* Téléphone */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <Phone size={18} />
                <div>
                  <div className="fw-semibold" style={{ color: "var(--duu-black)" }}>Appel direct</div>
                  <div className="text-muted small">{RAW_WHATSAPP}</div>
                </div>
              </div>
              <a href={telLink} className="btn btn-outline-secondary">Appeler</a>
            </div>
          </div>
        </div>

        {/* Localisation */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                <div className="d-flex align-items-center gap-2">
                  <MapPin size={18} />
                  <h2 className="h6 m-0" style={{ color: "var(--duu-black)" }}>Localisation</h2>
                </div>
                <a className="btn btn-duu" href={MAP_URL} target="_blank" rel="noopener noreferrer">
                  Voir sur Google Maps
                </a>
              </div>
              <p className="text-muted mb-3">
                Casablanca — <strong>Riad Oulfa</strong>, non loin du <strong>terminus 20</strong>.
              </p>

              {/* Carte responsive */}
              <div className="ratio ratio-16x9 rounded overflow-hidden" style={{ background: "#f7f7f7" }}>
                <iframe
                  title="Carte — Duumini"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(MAP_Q)}&output=embed`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
