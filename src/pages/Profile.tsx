// src/pages/Profile.tsx
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, UserRound, Phone, LogOut, Pencil, Eye, EyeOff } from "lucide-react";
import {
  type User,
  login,
  register,
  logout,
  me,
  getCurrentUser,
  updateProfile,
  mapCityCodeToVille,
} from "../services/auth";
import { http } from "../services/http";
import { normalizePhoneInput, isValidPhoneIntl } from "../utils/phone";
import { useLocationCity } from "../context/LocationContext";

/* =========================
 * ✅ Dynamic locations (localStorage)
 * - Ajout auto des nouvelles villes
 * - Ajout auto des nouvelles communes / quartiers liés à la ville
 * - Pays = Maroc (pour le moment)
 * ========================= */
const COUNTRY_FIXED = "Maroc";

const LS_LOCATIONS_KEY = "duumini:locations:v1";

/** Villes de base (tu peux éditer) */
const BASE_VILLES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Tanger",
  "Fès",
  "Agadir",
  "Meknès",
  "Oujda",
  "Kénitra",
  "Tétouan",
  "Safi",
  "El Jadida",
  "Béni Mellal",
  "Nador",
  "Laâyoune",
  "Dakhla",
] as const;

/** Communes/arrondissements de Casablanca */
const BASE_COMMUNES_CASA: string[] = [
  "Anfa",
  "Maârif",
  "Sidi Belyout",
  "Aïn Chock",
  "Hay Hassani",
  "Ben Msick",
  "Moulay Rachid",
  "Sidi Bernoussi",
  "Aïn Sebaâ",
  "Al Fida",
  "Mers Sultan",
  "Sidi Othmane",
];

/** Communes/arrondissements de Marrakech */
const BASE_COMMUNES_MARRAKECH: string[] = [
  "Guéliz",
  "Ménara",
  "Médina",
  "Sidi Youssef Ben Ali",
  "Annakhil",
  "Nakhil",
];

type LocationsStore = {
  version: 1;
  villes: string[]; // villes connues
  communesByVille: Record<string, string[]>; // key = villeNorm
  quartiersByVille: Record<string, string[]>; // key = villeNorm
};

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function stripDiacritics(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normKey(s: string) {
  return stripDiacritics(String(s || ""))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function titleCase(s: string) {
  const t = String(s || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function uniqSorted(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const v = String(x || "").trim();
    if (!v) continue;
    const k = normKey(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  out.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  return out;
}

function loadLocations(): LocationsStore {
  const fallback: LocationsStore = {
    version: 1,
    villes: uniqSorted([...BASE_VILLES]),
    communesByVille: {
      [normKey("Casablanca")]: uniqSorted(BASE_COMMUNES_CASA),
      [normKey("Marrakech")]: uniqSorted(BASE_COMMUNES_MARRAKECH),
    },
    quartiersByVille: {},
  };

  const stored = safeJsonParse<LocationsStore>(
    localStorage.getItem(LS_LOCATIONS_KEY),
    fallback
  );

  // merge base au cas où
  const villes = uniqSorted([...(stored?.villes || []), ...fallback.villes]);

  const communesByVille: Record<string, string[]> = { ...(stored?.communesByVille || {}) };
  const quartiersByVille: Record<string, string[]> = { ...(stored?.quartiersByVille || {}) };

  const casaKey = normKey("Casablanca");
  const marKey = normKey("Marrakech");
  communesByVille[casaKey] = uniqSorted([...(communesByVille[casaKey] || []), ...BASE_COMMUNES_CASA]);
  communesByVille[marKey] = uniqSorted([...(communesByVille[marKey] || []), ...BASE_COMMUNES_MARRAKECH]);

  const out: LocationsStore = {
    version: 1,
    villes,
    communesByVille,
    quartiersByVille,
  };

  localStorage.setItem(LS_LOCATIONS_KEY, JSON.stringify(out));
  return out;
}

function saveLocations(store: LocationsStore) {
  localStorage.setItem(LS_LOCATIONS_KEY, JSON.stringify(store));
}

function addVille(store: LocationsStore, ville: string) {
  const v = titleCase(ville);
  if (!v) return store;

  const next: LocationsStore = { ...store };
  next.villes = uniqSorted([...(store.villes || []), v]);

  const key = normKey(v);
  if (!next.communesByVille[key]) next.communesByVille[key] = [];
  if (!next.quartiersByVille[key]) next.quartiersByVille[key] = [];

  saveLocations(next);
  return next;
}

function addCommune(store: LocationsStore, ville: string, commune: string) {
  const v = titleCase(ville);
  const c = titleCase(commune);
  if (!v || !c) return store;

  let next = addVille(store, v);
  const key = normKey(v);

  next = { ...next, communesByVille: { ...next.communesByVille } };
  next.communesByVille[key] = uniqSorted([...(next.communesByVille[key] || []), c]);

  saveLocations(next);
  return next;
}

function addQuartier(store: LocationsStore, ville: string, quartier: string) {
  const v = titleCase(ville);
  const q = titleCase(quartier);
  if (!v || !q) return store;

  let next = addVille(store, v);
  const key = normKey(v);

  next = { ...next, quartiersByVille: { ...next.quartiersByVille } };
  next.quartiersByVille[key] = uniqSorted([...(next.quartiersByVille[key] || []), q]);

  saveLocations(next);
  return next;
}

function communesForVille(store: LocationsStore, ville: string) {
  const key = normKey(ville);
  const list = store.communesByVille[key] || [];
  return uniqSorted(list);
}

function quartiersForVille(store: LocationsStore, ville: string) {
  const key = normKey(ville);
  const list = store.quartiersByVille[key] || [];
  return uniqSorted(list);
}

/* ====== Helpers UI ====== */
function initials(u: User | null): string {
  const fn = (u?.first_name || "").trim();
  const ln = (u?.last_name || "").trim();
  const phone = u?.phone || "";
  if (fn || ln) return `${fn?.[0] || ""}${ln?.[0] || ""}`.toUpperCase() || phone.slice(-2);
  return phone ? phone.slice(-2) : "U";
}

function Avatar({ user, size = 64 }: { user: User | null; size?: number }) {
  const src = user?.avatar?.trim() || "";
  const text = initials(user);
  if (src) {
    return (
      <img
        src={src}
        alt="Avatar"
        width={size}
        height={size}
        className="rounded-circle object-fit-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-circle d-flex align-items-center justify-content-center"
      style={{
        width: size,
        height: size,
        background: "var(--duu-black, #111)",
        color: "#fff",
        fontWeight: 700,
      }}
      aria-label="Avatar"
    >
      {text}
    </div>
  );
}

/* ====== Validation & mot de passe ====== */
const rePassword = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function validateRegisterForm(params: {
  phone: string;
  password: string;
  villeText: string;
  communeText: string;
  quartierText: string;
}) {
  const errors: Record<string, string> = {};
  const phoneVal = normalizePhoneInput(params.phone.trim());

  if (!phoneVal) {
    errors.phone = "Téléphone requis.";
  } else if (!isValidPhoneIntl(phoneVal)) {
    errors.phone = "Numéro invalide. Utilisez le format international ex : +2126…";
  }

  if (!params.password) {
    errors.password = "Mot de passe requis.";
  } else if (!rePassword.test(params.password)) {
    errors.password = "Au moins 8 caractères, avec 1 lettre et 1 chiffre.";
  }

  if (!params.villeText.trim()) errors.ville = "Veuillez saisir votre ville.";
  if (!params.communeText.trim()) errors.commune = "Veuillez saisir votre commune.";
  if (!params.quartierText.trim()) errors.quartier = "Veuillez préciser votre quartier.";

  return errors;
}

function validateEditForm(params: {
  phone: string;
  villeText: string;
  communeText: string;
  quartierText: string;
}) {
  const errors: Record<string, string> = {};
  const phoneVal = normalizePhoneInput(params.phone.trim());

  if (!phoneVal) {
    errors.phone = "Téléphone requis.";
  } else if (!isValidPhoneIntl(phoneVal)) {
    errors.phone = "Numéro invalide. Utilisez le format international ex : +2126…";
  }

  if (!params.villeText.trim()) errors.ville = "Veuillez saisir votre ville.";
  if (!params.communeText.trim()) errors.commune = "Veuillez saisir votre commune.";
  if (!params.quartierText.trim()) errors.quartier = "Veuillez préciser votre quartier.";

  return errors;
}

/* ====== Modal & ListPicker (generic) ====== */
function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{ background: "rgba(0,0,0,.5)", zIndex: 1050 }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded shadow-lg position-absolute start-50 translate-middle-x"
        style={{ top: "10vh", width: "min(560px, 92vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex align-items-center justify-content-between p-3 border-bottom">
          <h5 className="m-0">{title}</h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose} type="button">
            Fermer
          </button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

function ListPicker({
  options,
  value,
  onSelect,
  placeholder = "Rechercher…",
}: {
  options: string[];
  value?: string | null;
  onSelect: (val: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.toLowerCase().includes(needle));
  }, [q, options]);

  return (
    <>
      <input
        className="form-control mb-3"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="border rounded" style={{ maxHeight: "50vh", overflowY: "auto" }}>
        <ul className="list-group list-group-flush">
          {filtered.map((opt) => {
            const active = (value || "") === opt;
            return (
              <li
                key={opt}
                className={`list-group-item d-flex align-items-center justify-content-between ${
                  active ? "bg-light" : ""
                }`}
                role="button"
                onClick={() => onSelect(opt)}
              >
                <span>{opt}</span>
                {active && <span className="badge bg-dark">Choisi</span>}
              </li>
            );
          })}
          {!filtered.length && (
            <li className="list-group-item text-muted">Aucun résultat</li>
          )}
        </ul>
      </div>
    </>
  );
}

/* ====== Champ mot de passe ====== */
function PasswordField({
  id,
  value,
  onChange,
  required,
  invalid,
  placeholder,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  invalid?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-group">
      <input
        id={id}
        type={show ? "text" : "password"}
        className={`form-control ${invalid ? "is-invalid" : ""}`}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        title={show ? "Masquer" : "Afficher"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/* ====== API Helpers locaux (OTP start) ====== */
async function apiOtpStart(
  phone: string,
  purpose: "signup" | "login" | "reset" = "reset"
) {
  return http<{ ok: true; message?: string }>("/api/auth/otp/start", {
    method: "POST",
    body: JSON.stringify({ phone, purpose }),
  });
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { city } = useLocationCity();

  // Suggestion ville context → libellé
  const villeFromContext = useMemo(() => {
    const v = mapCityCodeToVille(city);
    return titleCase(v || "") || "Casablanca";
  }, [city]);

  /* ✅ store dynamique villes/communes/quartiers */
  const [locations, setLocations] = useState<LocationsStore>(() => loadLocations());

  /* User state */
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /* Tabs when not logged */
  const tabFromUrl = (sp.get("tab") as "login" | "register" | "forgot" | null) || null;
  const [tab, setTab] = useState<"login" | "register" | "forgot">(tabFromUrl || "login");

  /* ===== Login ===== */
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

  /* ===== Register ===== */
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");

  // Ville / Commune / Quartier : ✅ libres + enrichissement dynamique
  const [regVille, setRegVille] = useState<string>(() => villeFromContext);
  const [regCommune, setRegCommune] = useState<string>(() => {
    const list = communesForVille(loadLocations(), villeFromContext);
    return list[0] || "";
  });
  const [regQuartier, setRegQuartier] = useState<string>("");

  const [regSexe, setRegSexe] = useState<"M" | "F">("M");
  const [regAccept, setRegAccept] = useState(false);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  /* ===== Forgot ===== */
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotErrors, setForgotErrors] = useState<Record<string, string>>({});

  /* ===== Edit (connected) ===== */
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");

  const [editVille, setEditVille] = useState<string>(() => titleCase((user as any)?.ville || villeFromContext));
  const [editCommune, setEditCommune] = useState<string>(() => titleCase((user as any)?.commune || ""));
  const [editQuartier, setEditQuartier] = useState<string>(() => titleCase((user as any)?.quartier || ""));
  const [editSexe, setEditSexe] = useState<"M" | "F">(((user as any)?.sexe as "M" | "F") || "M");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  /* ===== Modals ===== */
  const [openRegVille, setOpenRegVille] = useState(false);
  const [openEditVille, setOpenEditVille] = useState(false);
  const [openRegCommune, setOpenRegCommune] = useState(false);
  const [openEditCommune, setOpenEditCommune] = useState(false);
  const [openRegQuartier, setOpenRegQuartier] = useState(false);
  const [openEditQuartier, setOpenEditQuartier] = useState(false);

  // Chargement initial
  useEffect(() => {
    (async () => {
      try {
        const u = await me();
        if (u) {
          setUser(u);

          const uVille = titleCase((u as any)?.ville || "") || villeFromContext;
          const uCommune = titleCase((u as any)?.commune || "");
          const uQuartier = titleCase((u as any)?.quartier || "");

          // ✅ enrichir store avec les infos existantes
          setLocations((prev) => {
            let next = prev;
            next = addVille(next, uVille);
            if (uCommune) next = addCommune(next, uVille, uCommune);
            if (uQuartier) next = addQuartier(next, uVille, uQuartier);
            return next;
          });

          setEditVille(uVille);
          setEditCommune(uCommune);
          setEditQuartier(uQuartier);

          if ((u as any)?.sexe === "M" || (u as any)?.sexe === "F") setEditSexe((u as any).sexe);
        }
      } catch {
        // non loggé => ok
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync champs quand user change
  useEffect(() => {
    setFirstName(user?.first_name || "");
    setLastName(user?.last_name || "");
    setPhone(user?.phone || "");

    const uVille = titleCase((user as any)?.ville || "") || villeFromContext;
    const uCommune = titleCase((user as any)?.commune || "");
    const uQuartier = titleCase((user as any)?.quartier || "");

    setEditVille(uVille);
    setEditCommune(uCommune);
    setEditQuartier(uQuartier);

    if ((user as any)?.sexe === "M" || (user as any)?.sexe === "F") setEditSexe((user as any).sexe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ===== Helpers options (dépend de la ville) =====
  const regVilleOptions = useMemo(() => uniqSorted([...locations.villes, regVille].filter(Boolean)), [locations.villes, regVille]);
  const editVilleOptions = useMemo(() => uniqSorted([...locations.villes, editVille].filter(Boolean)), [locations.villes, editVille]);

  const regCommuneOptions = useMemo(() => {
    const list = communesForVille(locations, regVille);
    return uniqSorted([...list, regCommune].filter(Boolean));
  }, [locations, regVille, regCommune]);

  const editCommuneOptions = useMemo(() => {
    const list = communesForVille(locations, editVille);
    return uniqSorted([...list, editCommune].filter(Boolean));
  }, [locations, editVille, editCommune]);

  const regQuartierOptions = useMemo(() => {
    const list = quartiersForVille(locations, regVille);
    return uniqSorted([...list, regQuartier].filter(Boolean));
  }, [locations, regVille, regQuartier]);

  const editQuartierOptions = useMemo(() => {
    const list = quartiersForVille(locations, editVille);
    return uniqSorted([...list, editQuartier].filter(Boolean));
  }, [locations, editVille, editQuartier]);

  /* ================== Handlers ================== */
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    const errors: Record<string, string> = {};
    const phoneVal = normalizePhoneInput(loginPhone.trim());

    if (!phoneVal) errors.phone = "Téléphone requis.";
    else if (!isValidPhoneIntl(phoneVal)) errors.phone = "Numéro invalide. Utilisez le format international ex : +212";

    if (!loginPassword) errors.password = "Mot de passe requis.";

    if (Object.keys(errors).length) {
      setLoginErrors(errors);
      setErr(Object.values(errors)[0]);
      return;
    }

    setLoginErrors({});
    try {
      const u = await login(phoneVal, loginPassword);
      setUser(u);

      // ✅ enrichir store (si user a déjà ville/commune/quartier)
      const uVille = titleCase((u as any)?.ville || "") || villeFromContext;
      const uCommune = titleCase((u as any)?.commune || "");
      const uQuartier = titleCase((u as any)?.quartier || "");
      setLocations((prev) => {
        let next = prev;
        next = addVille(next, uVille);
        if (uCommune) next = addCommune(next, uVille, uCommune);
        if (uQuartier) next = addQuartier(next, uVille, uQuartier);
        return next;
      });

      navigate("/", { replace: true });
    } catch (e: any) {
      setErr(e.message || "Erreur de connexion");
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    const villeFinal = titleCase(regVille);
    const communeFinal = titleCase(regCommune);
    const quartierFinal = titleCase(regQuartier);

    const errors = validateRegisterForm({
      phone: regPhone,
      password: regPassword,
      villeText: villeFinal,
      communeText: communeFinal,
      quartierText: quartierFinal,
    });
    setRegErrors(errors);

    if (Object.keys(errors).length) {
      setErr(Object.values(errors)[0]);
      return;
    }

    if (!regAccept) {
      setErr("Vous devez accepter les Conditions d’utilisation et la Politique de confidentialité pour créer un compte.");
      return;
    }

    setRegErrors({});
    const phoneVal = normalizePhoneInput(regPhone.trim());

    try {
      // ✅ enrichir store AVANT envoi (UI instant)
      setLocations((prev) => {
        let next = prev;
        next = addVille(next, villeFinal);
        next = addCommune(next, villeFinal, communeFinal);
        next = addQuartier(next, villeFinal, quartierFinal);
        return next;
      });

      await register({
        phone: phoneVal,
        password: regPassword,
        first_name: regFirstName || undefined,
        last_name: regLastName || undefined,
        ville: villeFinal,
        commune: communeFinal || null,
        quartier: quartierFinal,
        sexe: regSexe,
        // country: COUNTRY_FIXED, // ✅ active si backend
      } as any);

      const u = await login(phoneVal, regPassword);
      setUser(u);
      navigate("/", { replace: true });
    } catch (e: any) {
      setErr(e.message || "Erreur d'inscription");
    }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setEditing(false);
    navigate("/profile?tab=login", { replace: true });
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    const villeFinal = titleCase(editVille);
    const communeFinal = titleCase(editCommune);
    const quartierFinal = titleCase(editQuartier);

    const errors = validateEditForm({
      phone,
      villeText: villeFinal,
      communeText: communeFinal,
      quartierText: quartierFinal,
    });
    setEditErrors(errors);

    if (Object.keys(errors).length) {
      setErr(Object.values(errors)[0]);
      return;
    }

    setEditErrors({});
    const phoneVal = normalizePhoneInput(phone.trim());

    try {
      // ✅ enrichir store
      setLocations((prev) => {
        let next = prev;
        next = addVille(next, villeFinal);
        next = addCommune(next, villeFinal, communeFinal);
        next = addQuartier(next, villeFinal, quartierFinal);
        return next;
      });

      const u = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        phone: phoneVal,
        ville: villeFinal,
        commune: communeFinal || null,
        quartier: quartierFinal,
        sexe: editSexe,
        // country: COUNTRY_FIXED,
      } as any);

      setUser(u);
      setEditing(false);
    } catch (e: any) {
      setErr(e.message || "Erreur de mise à jour du profil");
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    const phoneVal = normalizePhoneInput(forgotPhone.trim());
    const errors: Record<string, string> = {};

    if (!phoneVal) {
      errors.phone = "Téléphone requis.";
    } else if (!isValidPhoneIntl(phoneVal)) {
      errors.phone = "Téléphone invalide. Utilisez le format international ex : +2126…";
    }

    if (Object.keys(errors).length) {
      setForgotErrors(errors);
      setErr(Object.values(errors)[0]);
      return;
    }

    setForgotErrors({});
    try {
      await apiOtpStart(phoneVal, "reset");
      navigate(`/verify?phone=${encodeURIComponent(phoneVal)}&purpose=reset`);
    } catch (e: any) {
      setErr(e?.message || "Impossible d'envoyer le code de réinitialisation.");
    }
  }

  /* ================== UI ================== */
  if (loading) {
    return (
      <div className="container-xxl py-4">
        <div className="text-muted">Chargement…</div>
      </div>
    );
  }

  // ——— CONNECTÉ ———
  if (user) {
    const effectiveVille = titleCase((user as any)?.ville || editVille || villeFromContext) || "—";
    const effectiveCommune = titleCase((user as any)?.commune || editCommune) || "—";
    const effectiveQuartier = titleCase((user as any)?.quartier || editQuartier) || "—";

    return (
      <div className="container-xxl py-4">
        {err && <div className="alert alert-danger">{err}</div>}

        <div className="row g-4">
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center gap-3">
                  <Avatar user={user} size={72} />
                  <div>
                    <h1 className="h5 m-0">
                      {user.first_name || user.last_name
                        ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                        : "Utilisateur"}
                    </h1>
                    <div className="text-muted small">{user.phone}</div>
                    <div className="badge bg-dark mt-2">{user.role}</div>
                  </div>
                </div>

                <div className="mt-3 d-flex flex-wrap gap-2">
                  <button
                    className="btn btn-dark d-inline-flex align-items-center gap-2"
                    onClick={() => setEditing((v) => !v)}
                    type="button"
                  >
                    <Pencil size={16} />
                    {editing ? "Annuler" : "Modifier le profil"}
                  </button>
                  <button
                    className="btn btn-outline-dark d-inline-flex align-items-center gap-2"
                    onClick={handleLogout}
                    type="button"
                  >
                    <LogOut size={16} />
                    Se déconnecter
                  </button>
                  <button
                    className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
                    onClick={() => setTab("forgot")}
                    type="button"
                  >
                    <Lock size={16} />
                    Mot de passe oublié
                  </button>
                </div>
              </div>
            </div>

            {tab === "forgot" && (
              <div className="card border-0 shadow-sm mt-3">
                <div className="card-body">
                  <h2 className="h6">Réinitialiser le mot de passe</h2>
                  <form className="mt-2" onSubmit={handleForgot}>
                    <label className="form-label">
                      Téléphone <span className="text-danger">*</span>
                    </label>
                    <input
                      type="tel"
                      className={`form-control ${forgotErrors.phone ? "is-invalid" : ""}`}
                      placeholder="+212..."
                      value={forgotPhone}
                      onChange={(e) => {
                        const v = normalizePhoneInput(e.target.value);
                        setForgotPhone(v);
                        setForgotErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                      required
                    />
                    {forgotErrors.phone && (
                      <div className="invalid-feedback">{forgotErrors.phone}</div>
                    )}
                    <div className="d-grid mt-3">
                      <button className="btn btn-dark" type="submit">
                        Envoyer
                      </button>
                    </div>
                    <div className="form-text mt-2">
                      Nous t’enverrons un code par SMS. Tu le renseigneras sur la page suivante.
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>

          <div className="col-12 col-lg-8">
            {editing ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h2 className="h6 d-flex align-items-center gap-2">
                    <UserRound size={18} /> Modifier mes informations
                  </h2>

                  <form className="row g-3 mt-1" onSubmit={handleUpdate}>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Prénom</label>
                      <input
                        className="form-control"
                        placeholder="Ex. Aïcha"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Nom</label>
                      <input
                        className="form-control"
                        placeholder="Ex. Traoré"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        autoComplete="family-name"
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label d-flex align-items-center gap-2">
                        <Phone size={16} /> Téléphone <span className="text-danger">*</span>
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        className={`form-control ${editErrors.phone ? "is-invalid" : ""}`}
                        value={phone}
                        onChange={(e) => {
                          const v = normalizePhoneInput(e.target.value);
                          setPhone(v);
                          setEditErrors((prev) => ({ ...prev, phone: "" }));
                        }}
                        required
                        placeholder="+212..."
                        autoComplete="tel"
                      />
                      {editErrors.phone && (
                        <div className="invalid-feedback">{editErrors.phone}</div>
                      )}
                    </div>

                    {/* Pays (fixe) */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">Pays</label>
                      <input className="form-control" value={COUNTRY_FIXED} disabled />
                      <div className="form-text">Duumini est disponible au Maroc pour le moment.</div>
                    </div>

                    {/* Ville (modal + saisie libre) */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">
                        Ville <span className="text-danger">*</span>
                      </label>

                      <div className="input-group">
                        <input
                          className={`form-control ${editErrors.ville ? "is-invalid" : ""}`}
                          value={editVille}
                          onChange={(e) => {
                            setEditVille(e.target.value);
                            setEditErrors((prev) => ({ ...prev, ville: "" }));
                          }}
                          placeholder="Saisir votre ville"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setOpenEditVille(true)}
                          title="Choisir dans la liste"
                        >
                          Liste
                        </button>
                      </div>
                      {editErrors.ville && (
                        <div className="invalid-feedback d-block">{editErrors.ville}</div>
                      )}

                      <Modal
                        open={openEditVille}
                        title="Sélectionner une ville"
                        onClose={() => setOpenEditVille(false)}
                      >
                        <ListPicker
                          options={editVilleOptions}
                          value={titleCase(editVille) || null}
                          onSelect={(val) => {
                            setEditVille(val);
                            // reset commune & quartier quand ville change
                            setEditCommune("");
                            setEditQuartier("");
                            setEditErrors((prev) => ({ ...prev, ville: "", commune: "", quartier: "" }));
                            setOpenEditVille(false);
                          }}
                          placeholder="Rechercher une ville…"
                        />
                      </Modal>
                    </div>

                    {/* Commune (modal + saisie libre, liée à la ville) */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">
                        Commune <span className="text-danger">*</span>
                      </label>

                      <div className="input-group">
                        <input
                          className={`form-control ${editErrors.commune ? "is-invalid" : ""}`}
                          value={editCommune}
                          onChange={(e) => {
                            setEditCommune(e.target.value);
                            setEditErrors((prev) => ({ ...prev, commune: "" }));
                          }}
                          placeholder="Saisir votre commune"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setOpenEditCommune(true)}
                          title="Choisir dans la liste"
                        >
                          Liste
                        </button>
                      </div>
                      {editErrors.commune && (
                        <div className="invalid-feedback d-block">{editErrors.commune}</div>
                      )}

                      <Modal
                        open={openEditCommune}
                        title={`Communes — ${titleCase(editVille) || "Ville"}`}
                        onClose={() => setOpenEditCommune(false)}
                      >
                        <ListPicker
                          options={editCommuneOptions}
                          value={titleCase(editCommune) || null}
                          onSelect={(val) => {
                            setEditCommune(val);
                            setEditErrors((prev) => ({ ...prev, commune: "" }));
                            setOpenEditCommune(false);
                          }}
                          placeholder="Rechercher une commune…"
                        />
                      </Modal>
                      <div className="form-text">La liste dépend de la ville (et s’enrichit automatiquement).</div>
                    </div>

                    {/* Quartier (modal + saisie libre, liée à la ville) */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">
                        Quartier <span className="text-danger">*</span>
                      </label>

                      <div className="input-group">
                        <input
                          className={`form-control ${editErrors.quartier ? "is-invalid" : ""}`}
                          value={editQuartier}
                          onChange={(e) => {
                            setEditQuartier(e.target.value);
                            setEditErrors((prev) => ({ ...prev, quartier: "" }));
                          }}
                          placeholder="Ex. Riad Oulfa, Terminus 20"
                          autoCapitalize="words"
                          autoComplete="address-level3"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setOpenEditQuartier(true)}
                          title="Choisir dans la liste"
                        >
                          Liste
                        </button>
                      </div>
                      {editErrors.quartier && (
                        <div className="invalid-feedback d-block">{editErrors.quartier}</div>
                      )}

                      <Modal
                        open={openEditQuartier}
                        title={`Quartiers — ${titleCase(editVille) || "Ville"}`}
                        onClose={() => setOpenEditQuartier(false)}
                      >
                        <ListPicker
                          options={editQuartierOptions}
                          value={titleCase(editQuartier) || null}
                          onSelect={(val) => {
                            setEditQuartier(val);
                            setEditErrors((prev) => ({ ...prev, quartier: "" }));
                            setOpenEditQuartier(false);
                          }}
                          placeholder="Rechercher un quartier…"
                        />
                      </Modal>
                    </div>

                    {/* Sexe */}
                    <div className="col-12">
                      <label className="form-label">Sexe</label>
                      <div className="d-flex gap-3">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="editSexe"
                            id="editSexeM"
                            checked={editSexe === "M"}
                            onChange={() => setEditSexe("M")}
                          />
                          <label className="form-check-label" htmlFor="editSexeM">
                            M
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="editSexe"
                            id="editSexeF"
                            checked={editSexe === "F"}
                            onChange={() => setEditSexe("F")}
                          />
                          <label className="form-check-label" htmlFor="editSexeF">
                            F
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="d-grid d-sm-flex gap-2">
                        <button className="btn btn-dark" type="submit">
                          Enregistrer
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          type="button"
                          onClick={() => setEditing(false)}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="alert alert-light border small mb-0">
                        ✅ Astuce : Toute nouvelle <b>ville</b>, <b>commune</b> ou <b>quartier</b> saisie sera
                        automatiquement ajoutée aux listes (et liée à la ville).
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h2 className="h6">Mes informations</h2>
                  <div className="row g-3 mt-1">
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Prénom</div>
                      <div className="fw-semibold">{user.first_name || "—"}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Nom</div>
                      <div className="fw-semibold">{user.last_name || "—"}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Téléphone</div>
                      <div className="fw-semibold">{user.phone}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Rôle</div>
                      <div className="fw-semibold">{user.role}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Pays</div>
                      <div className="fw-semibold">{COUNTRY_FIXED}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Ville</div>
                      <div className="fw-semibold">{effectiveVille}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Commune</div>
                      <div className="fw-semibold">{effectiveCommune}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Quartier</div>
                      <div className="fw-semibold">{effectiveQuartier}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Sexe</div>
                      <div className="fw-semibold">{(user as any).sexe || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ——— NON CONNECTÉ ———
  return (
    <div className="container-xxl py-4">
      {err && <div className="alert alert-danger">{err}</div>}

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <ul className="nav nav-pills mb-3" role="tablist">
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${tab === "login" ? "active" : ""}`}
                onClick={() => setTab("login")}
                type="button"
                role="tab"
              >
                Connexion
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${tab === "register" ? "active" : ""}`}
                onClick={() => setTab("register")}
                type="button"
                role="tab"
              >
                Créer un compte
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${tab === "forgot" ? "active" : ""}`}
                onClick={() => setTab("forgot")}
                type="button"
                role="tab"
              >
                Mot de passe oublié
              </button>
            </li>
          </ul>

          <div className="card border-0 shadow-sm">
            <div className="card-body">
              {tab === "login" && (
                <form onSubmit={handleLogin} className="row g-3">
                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Phone size={16} /> Téléphone <span className="text-danger">*</span>
                    </label>
                    <input
                      type="tel"
                      className={`form-control ${loginErrors.phone ? "is-invalid" : ""}`}
                      placeholder="+212..."
                      value={loginPhone}
                      onChange={(e) => {
                        const v = normalizePhoneInput(e.target.value);
                        setLoginPhone(v);
                        setLoginErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                      required
                    />
                    {loginErrors.phone && (
                      <div className="invalid-feedback">{loginErrors.phone}</div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Lock size={16} /> Mot de passe <span className="text-danger">*</span>
                    </label>
                    <PasswordField
                      id="loginPassword"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        setLoginErrors((prev) => ({ ...prev, password: "" }));
                      }}
                      required
                      placeholder="Votre mot de passe"
                      autoComplete="current-password"
                      invalid={!!loginErrors.password}
                    />
                    {loginErrors.password && (
                      <div className="invalid-feedback d-block">{loginErrors.password}</div>
                    )}
                  </div>

                  <div className="col-12 d-grid">
                    <button className="btn btn-dark" type="submit">
                      Se connecter
                    </button>
                  </div>
                </form>
              )}

              {tab === "register" && (
                <form onSubmit={handleRegister} className="row g-3">
                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Phone size={16} /> Téléphone <span className="text-danger">*</span>
                    </label>
                    <input
                      type="tel"
                      className={`form-control ${regErrors.phone ? "is-invalid" : ""}`}
                      placeholder="+212..."
                      value={regPhone}
                      onChange={(e) => {
                        const v = normalizePhoneInput(e.target.value);
                        setRegPhone(v);
                        setRegErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                      required
                    />
                    {regErrors.phone && (
                      <div className="invalid-feedback">{regErrors.phone}</div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Lock size={16} /> Mot de passe <span className="text-danger">*</span>
                    </label>
                    <PasswordField
                      id="registerPassword"
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        setRegErrors((prev) => ({ ...prev, password: "" }));
                      }}
                      required
                      invalid={!!regErrors.password}
                      placeholder="Créer un mot de passe"
                      autoComplete="new-password"
                    />
                    <div className="form-text">
                      Min 8 caractères, inclure au moins 1 lettre et 1 chiffre.
                    </div>
                    {regErrors.password && (
                      <div className="invalid-feedback d-block">{regErrors.password}</div>
                    )}
                  </div>

                  {/* Prénom / Nom */}
                  <div className="col-12 col-md-6">
                    <label className="form-label d-flex align-items-center gap-2">
                      <UserRound size={16} /> Prénom
                    </label>
                    <input
                      className="form-control"
                      placeholder="Ex. Aïcha"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Nom</label>
                    <input
                      className="form-control"
                      placeholder="Ex. Traoré"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </div>

                  {/* Pays (fixe) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label">Pays</label>
                    <input className="form-control" value={COUNTRY_FIXED} disabled />
                  </div>

                  {/* Ville (input + liste) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label">
                      Ville <span className="text-danger">*</span>
                    </label>

                    <div className="input-group">
                      <input
                        className={`form-control ${regErrors.ville ? "is-invalid" : ""}`}
                        value={regVille}
                        onChange={(e) => {
                          setRegVille(e.target.value);
                          setRegCommune(""); // reset (liée à la ville)
                          setRegQuartier("");
                          setRegErrors((prev) => ({ ...prev, ville: "", commune: "", quartier: "" }));
                        }}
                        placeholder="Saisir votre ville"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setOpenRegVille(true)}
                      >
                        Liste
                      </button>
                    </div>
                    {regErrors.ville && (
                      <div className="invalid-feedback d-block">{regErrors.ville}</div>
                    )}

                    <Modal
                      open={openRegVille}
                      title="Sélectionner une ville"
                      onClose={() => setOpenRegVille(false)}
                    >
                      <ListPicker
                        options={regVilleOptions}
                        value={titleCase(regVille) || null}
                        onSelect={(val) => {
                          setRegVille(val);
                          setRegCommune("");
                          setRegQuartier("");
                          setRegErrors((prev) => ({ ...prev, ville: "", commune: "", quartier: "" }));
                          setOpenRegVille(false);
                        }}
                        placeholder="Rechercher une ville…"
                      />
                    </Modal>
                  </div>

                  {/* Commune (input + liste) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label">
                      Commune <span className="text-danger">*</span>
                    </label>

                    <div className="input-group">
                      <input
                        className={`form-control ${regErrors.commune ? "is-invalid" : ""}`}
                        value={regCommune}
                        onChange={(e) => {
                          setRegCommune(e.target.value);
                          setRegErrors((prev) => ({ ...prev, commune: "" }));
                        }}
                        placeholder="Saisir votre commune"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setOpenRegCommune(true)}
                      >
                        Liste
                      </button>
                    </div>
                    {regErrors.commune && (
                      <div className="invalid-feedback d-block">{regErrors.commune}</div>
                    )}

                    <Modal
                      open={openRegCommune}
                      title={`Communes — ${titleCase(regVille) || "Ville"}`}
                      onClose={() => setOpenRegCommune(false)}
                    >
                      <ListPicker
                        options={regCommuneOptions}
                        value={titleCase(regCommune) || null}
                        onSelect={(val) => {
                          setRegCommune(val);
                          setRegErrors((prev) => ({ ...prev, commune: "" }));
                          setOpenRegCommune(false);
                        }}
                        placeholder="Rechercher une commune…"
                      />
                    </Modal>
                    <div className="form-text">La liste dépend de la ville (et s’enrichit automatiquement).</div>
                  </div>

                  {/* Quartier (input + liste) */}
                  <div className="col-12">
                    <label className="form-label">
                      Quartier <span className="text-danger">*</span>
                    </label>

                    <div className="input-group">
                      <input
                        className={`form-control ${regErrors.quartier ? "is-invalid" : ""}`}
                        value={regQuartier}
                        onChange={(e) => {
                          setRegQuartier(e.target.value);
                          setRegErrors((prev) => ({ ...prev, quartier: "" }));
                        }}
                        placeholder="Ex. Riad Oulfa, Terminus 20"
                        autoCapitalize="words"
                        autoComplete="address-level3"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setOpenRegQuartier(true)}
                      >
                        Liste
                      </button>
                    </div>
                    {regErrors.quartier && (
                      <div className="invalid-feedback d-block">{regErrors.quartier}</div>
                    )}

                    <Modal
                      open={openRegQuartier}
                      title={`Quartiers — ${titleCase(regVille) || "Ville"}`}
                      onClose={() => setOpenRegQuartier(false)}
                    >
                      <ListPicker
                        options={regQuartierOptions}
                        value={titleCase(regQuartier) || null}
                        onSelect={(val) => {
                          setRegQuartier(val);
                          setRegErrors((prev) => ({ ...prev, quartier: "" }));
                          setOpenRegQuartier(false);
                        }}
                        placeholder="Rechercher un quartier…"
                      />
                    </Modal>
                  </div>

                  {/* Sexe */}
                  <div className="col-12 col-md-6">
                    <label className="form-label">
                      Sexe <span className="text-danger">*</span>
                    </label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="regSexe"
                          id="regSexeM"
                          checked={regSexe === "M"}
                          onChange={() => setRegSexe("M")}
                          required
                        />
                        <label className="form-check-label" htmlFor="regSexeM">
                          M
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="regSexe"
                          id="regSexeF"
                          checked={regSexe === "F"}
                          onChange={() => setRegSexe("F")}
                        />
                        <label className="form-check-label" htmlFor="regSexeF">
                          F
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Acceptation */}
                  <div className="col-12">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="regAccept"
                        checked={regAccept}
                        onChange={(e) => setRegAccept(e.target.checked)}
                        required
                      />
                      <label className="form-check-label" htmlFor="regAccept">
                        Je confirme avoir lu et j’accepte les{" "}
                        <Link to="/legal/terms" className="link-dark">
                          Conditions d’utilisation
                        </Link>{" "}
                        et la{" "}
                        <Link to="/legal/privacy" className="link-dark">
                          Politique de confidentialité
                        </Link>
                        . <span className="text-danger">*</span>
                      </label>
                    </div>
                    <div className="form-text">
                      Tu peux les consulter en cliquant sur les liens ci-dessus avant de continuer.
                    </div>
                  </div>

                  <div className="col-12 d-grid">
                    <button className="btn btn-dark" type="submit">
                      Créer le compte
                    </button>
                  </div>

                  <div className="col-12">
                    <div className="alert alert-light border small mb-0">
                      ✅ Toute nouvelle <b>ville</b>, <b>commune</b> ou <b>quartier</b> saisi sera ajouté automatiquement aux listes.
                    </div>
                  </div>
                </form>
              )}

              {tab === "forgot" && (
                <form onSubmit={handleForgot} className="row g-3">
                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Phone size={16} /> Téléphone <span className="text-danger">*</span>
                    </label>
                    <input
                      type="tel"
                      className={`form-control ${forgotErrors.phone ? "is-invalid" : ""}`}
                      placeholder="+212..."
                      value={forgotPhone}
                      onChange={(e) => {
                        const v = normalizePhoneInput(e.target.value);
                        setForgotPhone(v);
                        setForgotErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                      required
                    />
                    {forgotErrors.phone && (
                      <div className="invalid-feedback">{forgotErrors.phone}</div>
                    )}
                  </div>
                  <div className="col-12 d-grid">
                    <button className="btn btn-dark" type="submit">
                      Envoyer
                    </button>
                  </div>
                  <div className="form-text">
                    Un code SMS te sera envoyé. Tu seras redirigé pour le saisir.
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Panneau d’info latéral */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h6">Pourquoi créer un compte ?</h2>
              <ul className="mt-2 text-muted">
                <li>Suivre vos commandes en temps réel</li>
                <li>Gagner du temps à la commande</li>
                <li>Accéder aux promotions et offres</li>
              </ul>
              <hr />
              <h2 className="h6">Déjà membre ?</h2>
              <p className="text-muted">
                Utilisez votre numéro de téléphone et votre mot de passe pour vous connecter.
              </p>
              <hr />
              <div className="small text-muted">
                🇲🇦 Duumini est disponible au Maroc pour le moment.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
