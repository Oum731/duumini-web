// src/pages/home/SellIntentGate.tsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Modal } from "../profile/components/Modal";
import NetworkIllustration from "./NetworkIllustration";

const STORAGE_KEY = "duumini:sellIntentGate:v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
const SHOW_DELAY_MS = 2500;

const EXCLUDED_PREFIXES = ["/admin", "/vendeur", "/ma-boutique", "/contact"];

type StoredIntent = { seen: boolean; choice: "yes" | "no"; ts: string };

function shouldSkip(pathname: string) {
  return EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p));
}

function readStored(): StoredIntent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredIntent) : null;
  } catch {
    return null;
  }
}

function writeStored(choice: "yes" | "no") {
  try {
    const payload: StoredIntent = { seen: true, choice, ts: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function isExpired(ts: string): boolean {
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > TTL_MS;
}

// ✅ Un seul affichage par session d'onglet, même si le composant reste
// monté à la racine et que l'utilisateur navigue entre plusieurs routes.
let shownThisTabSession = false;

export default function SellIntentGate() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shownThisTabSession) return;
    if (shouldSkip(location.pathname)) return;

    const stored = readStored();
    if (stored?.seen && !isExpired(stored.ts)) return;

    const timer = setTimeout(() => {
      shownThisTabSession = true;
      setOpen(true);
    }, SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  function handleYes() {
    writeStored("yes");
    setOpen(false);
    navigate("/contact?intent=join");
  }

  function handleNo() {
    writeStored("no");
    setOpen(false);
  }

  return (
    <Modal open={open} title="Vous souhaitez vendre sur DUUMINI ?" onClose={handleNo}>
      <div className="mb-3" style={{ aspectRatio: "4 / 3", maxHeight: 180, margin: "0 auto" }}>
        <NetworkIllustration />
      </div>

      <p className="text-muted">
        DUUMINI connecte vendeurs, fournisseurs et producteurs à travers
        l'Afrique — vos produits peuvent circuler entre le Maroc, la Côte
        d'Ivoire et d'autres pays du continent, dans les deux sens. Écrivez-nous,
        nous vous recontactons rapidement pour démarrer.
      </p>
      <div className="d-flex gap-2 justify-content-end mt-3">
        <button type="button" className="btn btn-outline-secondary" onClick={handleNo}>
          Non, merci
        </button>
        <button type="button" className="btn btn-duu-green" onClick={handleYes}>
          Oui, je veux vendre
        </button>
      </div>

      <div className="d-flex gap-3 justify-content-end mt-2">
        <Link
          to="/african-market"
          className="small text-decoration-none"
          onClick={() => setOpen(false)}
        >
          Voir Market
        </Link>
        <Link
          to="/african-food"
          className="small text-decoration-none"
          onClick={() => setOpen(false)}
        >
          Voir Food
        </Link>
      </div>
    </Modal>
  );
}
