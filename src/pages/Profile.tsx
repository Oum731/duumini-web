// src/pages/Profile.tsx
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useRef,
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
  mapCityCodeToVille, // ✅ helper ville (CASABLANCA/MARRAKECH → Casablanca/Marrakech)
} from "../services/auth";
import { http } from "../services/http";
import {
  normalizePhoneInput,
  isValidPhoneIntl,
} from "../utils/phone";
import { useLocationCity } from "../context/LocationContext"; // ✅ ville choisie (CASABLANCA / MARRAKECH)

/* ====== Villes & Communes ====== */
const VILLE_OPTIONS = ["Casablanca", "Marrakech"] as const;
type Ville = (typeof VILLE_OPTIONS)[number];

const DEFAULT_VILLE: Ville = "Casablanca";

/** Communes/arrondissements de Casablanca */
const COMMUNES_CASA: string[] = [
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
  "__other__", // → Autre…
];

/** Communes/arrondissements de Marrakech (exemples) */
const COMMUNES_MARRAKECH: string[] = [
  "Guéliz",
  "Ménara",
  "Médina",
  "Sidi Youssef Ben Ali",
  "Annakhil",
  "Nakhil",
  "__other__", // → Autre…
];

function getCommunesForVille(ville: string | null | undefined): string[] {
  const v = (ville || "").toLowerCase();
  if (v === "marrakech") return COMMUNES_MARRAKECH;
  // Par défaut : Casablanca
  return COMMUNES_CASA;
}

/* ====== Helpers ====== */
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
const rePassword = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/; // min 8, 1 lettre, 1 chiffre

function validateRegisterForm(params: {
  phone: string;
  password: string;
  quartierText: string;
  commune: string;
}) {
  const errors: Record<string, string> = {};
  const phoneVal = normalizePhoneInput(params.phone.trim());

  if (!phoneVal) {
    errors.phone = "Téléphone requis.";
  } else if (!isValidPhoneIntl(phoneVal)) {
    errors.phone =
      "Numéro invalide. Utilisez le format international ex : +2126…, +22507…, +22360…, +1415…";
  }

  if (!params.password) {
    errors.password = "Mot de passe requis.";
  } else if (!rePassword.test(params.password)) {
    errors.password = "Au moins 8 caractères, avec 1 lettre et 1 chiffre.";
  }
  if (!params.quartierText.trim()) {
    errors.quartier = "Veuillez préciser votre quartier.";
  }
  if (!params.commune) {
    errors.commune = "Veuillez choisir une commune.";
  }
  return errors;
}

function validateEditForm(params: {
  phone: string;
  quartierText: string;
  commune: string;
}) {
  const errors: Record<string, string> = {};
  const phoneVal = normalizePhoneInput(params.phone.trim());

  if (!phoneVal) {
    errors.phone = "Téléphone requis.";
  } else if (!isValidPhoneIntl(phoneVal)) {
    errors.phone =
      "Numéro invalide. Utilisez le format international ex : +2126…, +22507…, +22360…, +1415…";
  }
  if (!params.quartierText.trim()) {
    errors.quartier = "Veuillez préciser votre quartier.";
  }
  if (!params.commune) {
    errors.commune = "Veuillez choisir une commune.";
  }
  return errors;
}

/* ====== Modal & ListPicker (générique : villes + communes) ====== */
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
  const ref = useRef<HTMLDivElement | null>(null);

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
        ref={ref}
      >
        <div className="d-flex align-items-center justify-content-between p-3 border-bottom">
          <h5 className="m-0">{title}</h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
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
    return options.filter((o) =>
      (o === "__other__" ? "autre" : o).toLowerCase().includes(needle)
    );
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
            const label = opt === "__other__" ? "Autre…" : opt;
            const active = value === opt;
            return (
              <li
                key={opt}
                className={`list-group-item d-flex align-items-center justify-content-between ${active ? "bg-light" : ""}`}
                role="button"
                onClick={() => onSelect(opt)}
              >
                <span>{label}</span>
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

/* ====== Champ mot de passe avec affichage/masquage ====== */
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
  const { city } = useLocationCity(); // ✅ CASABLANCA / MARRAKECH

  // Ville "par défaut" pour ce formulaire (context → libellé)
  const villeFromContext: Ville = useMemo(
    () => (mapCityCodeToVille(city) as Ville) || DEFAULT_VILLE,
    [city]
  );

  /* User state */
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /* Tabs when not logged (lit ?tab=login/register/forgot) */
  const tabFromUrl = (sp.get("tab") as "login" | "register" | "forgot" | null) || null;
  const [tab, setTab] = useState<"login" | "register" | "forgot">(tabFromUrl || "login");

  /* ====== Forms: Login ====== */
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

  /* ====== Forms: Register ====== */
  const [regVille, setRegVille] = useState<Ville>(() => villeFromContext);
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regCommune, setRegCommune] = useState<string>(
    getCommunesForVille(villeFromContext)[0]
  );
  const [regCommuneOther, setRegCommuneOther] = useState("");
  const [regQuartierText, setRegQuartierText] = useState(""); // ← libre
  const [regSexe, setRegSexe] = useState<"M" | "F">("M");
  const [regAccept, setRegAccept] = useState(false); // ✅ Acceptation CGU/Privacy
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const communeRegisterValue =
    regCommune === "__other__" ? regCommuneOther.trim() || "" : regCommune;

  /* ====== Forms: Forgot ====== */
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotErrors, setForgotErrors] = useState<Record<string, string>>({});

  /* ====== Forms: Edit (user connecté) ====== */
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");

  const initialEditVille: Ville =
    ((user as any)?.ville as Ville) || villeFromContext || DEFAULT_VILLE;
  const [editVille, setEditVille] = useState<Ville>(initialEditVille);

  const [editCommune, setEditCommune] = useState<string>(
    (user as any)?.commune || getCommunesForVille(initialEditVille)[0]
  );
  const [editCommuneOther, setEditCommuneOther] = useState("");
  const [editQuartierText, setEditQuartierText] = useState<string>(
    (user as any)?.quartier || ""
  ); // ← libre
  const [editSexe, setEditSexe] = useState<"M" | "F">(
    ((user as any)?.sexe as "M" | "F") || "M"
  );
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const communeEditValue =
    editCommune === "__other__" ? editCommuneOther.trim() || "" : editCommune;

  /* ====== Modals (ville + commune) ====== */
  const [openRegVille, setOpenRegVille] = useState(false);
  const [openEditVille, setOpenEditVille] = useState(false);
  const [openRegCommune, setOpenRegCommune] = useState(false);
  const [openEditCommune, setOpenEditCommune] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const u = await me();
        if (u) {
          setUser(u);
          setEditQuartierText((u as any).quartier || "");
          const uVille = ((u as any).ville as Ville) || villeFromContext;
          setEditVille(uVille);
          setEditCommune((u as any).commune || getCommunesForVille(uVille)[0]);
          if ((u as any).sexe === "M" || (u as any).sexe === "F")
            setEditSexe((u as any).sexe);
        }
      } catch {
        // pas grave si non loggé
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMemo(() => {
    setFirstName(user?.first_name || "");
    setLastName(user?.last_name || "");
    setPhone(user?.phone || "");
    if ((user as any)?.quartier) setEditQuartierText((user as any).quartier);
    if ((user as any)?.ville) {
      const v = (user as any).ville as Ville;
      setEditVille(v);
      setEditCommune((user as any)?.commune || getCommunesForVille(v)[0]);
    }
    if ((user as any)?.sexe === "M" || (user as any)?.sexe === "F")
      setEditSexe((user as any).sexe);
  }, [user]);

  /* ================== Handlers ================== */
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const errors: Record<string, string> = {};

    const phoneVal = normalizePhoneInput(loginPhone.trim());
    if (!phoneVal) {
      errors.phone = "Téléphone requis.";
    } else if (!isValidPhoneIntl(phoneVal)) {
      errors.phone =
        "Numéro invalide. Utilisez le format international ex : +212";
    }
    if (!loginPassword) {
      errors.password = "Mot de passe requis.";
    }

    if (Object.keys(errors).length) {
      setLoginErrors(errors);
      setErr(Object.values(errors)[0]);
      return;
    }

    setLoginErrors({});
    try {
      const u = await login(phoneVal, loginPassword);
      setUser(u);
      navigate("/", { replace: true });
    } catch (e: any) {
      setErr(e.message || "Erreur de connexion");
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    const errors = validateRegisterForm({
      phone: regPhone,
      password: regPassword,
      quartierText: regQuartierText,
      commune: communeRegisterValue,
    });
    setRegErrors(errors);
    if (Object.keys(errors).length) {
      setErr(Object.values(errors)[0]);
      return;
    }

    // ✅ Blocage si l'utilisateur n'a pas accepté
    if (!regAccept) {
      setErr(
        "Vous devez accepter les Conditions d’utilisation et la Politique de confidentialité pour créer un compte."
      );
      return;
    }

    setRegErrors({});
    const phoneVal = normalizePhoneInput(regPhone.trim());
    try {
      await register({
        phone: phoneVal,
        password: regPassword,
        first_name: regFirstName || undefined,
        last_name: regLastName || undefined,
        ville: regVille, // ✅ ville choisie (Casablanca / Marrakech)
        commune: communeRegisterValue || null,
        quartier: regQuartierText.trim(),
        sexe: regSexe,
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

    const errors = validateEditForm({
      phone,
      quartierText: editQuartierText,
      commune: communeEditValue,
    });
    setEditErrors(errors);
    if (Object.keys(errors).length) {
      setErr(Object.values(errors)[0]);
      return;
    }

    setEditErrors({});
    const phoneVal = normalizePhoneInput(phone.trim());
    try {
      const u = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        phone: phoneVal,
        ville: editVille, // ✅ ville choisie et modifiable
        commune: communeEditValue || null,
        quartier: editQuartierText.trim(),
        sexe: editSexe,
      } as any);
      setUser(u);
      setEditing(false);
    } catch (e: any) {
      setErr(e.message || "Erreur de mise à jour du profil");
    }
  }

  // === Démarrer OTP + rediriger vers /verify (flow reset) ===
  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const phoneVal = normalizePhoneInput(forgotPhone.trim());
    const errors: Record<string, string> = {};

    if (!phoneVal) {
      errors.phone = "Téléphone requis.";
    } else if (!isValidPhoneIntl(phoneVal)) {
      errors.phone =
        "Téléphone invalide. Utilisez le format international ex : +2126…, +22507…, +22360…, +1415…";
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
    const effectiveVille = (user as any)?.ville || editVille || villeFromContext;

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
                  >
                    <Pencil size={16} />
                    {editing ? "Annuler" : "Modifier le profil"}
                  </button>
                  <button
                    className="btn btn-outline-dark d-inline-flex align-items-center gap-2"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    Se déconnecter
                  </button>
                  <button
                    className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
                    onClick={() => setTab("forgot")}
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
                      className={`form-control ${
                        forgotErrors.phone ? "is-invalid" : ""
                      }`}
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
                      Nous t’enverrons un code par SMS. Tu le renseigneras sur la page
                      suivante.
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
                        <Phone size={16} /> Téléphone{" "}
                        <span className="text-danger">*</span>
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        className={`form-control ${
                          editErrors.phone ? "is-invalid" : ""
                        }`}
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

                    {/* Ville (modifiable via modal) */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">
                        Ville <span className="text-danger">*</span>
                      </label>
                      <button
                        type="button"
                        className="form-select text-start"
                        onClick={() => setOpenEditVille(true)}
                      >
                        {editVille}
                      </button>
                      <Modal
                        open={openEditVille}
                        title="Sélectionner une ville"
                        onClose={() => setOpenEditVille(false)}
                      >
                        <ListPicker
                          options={VILLE_OPTIONS as unknown as string[]}
                          value={editVille}
                          onSelect={(val) => {
                            const v = (val as Ville) || DEFAULT_VILLE;
                            setEditVille(v);
                            // reset commune selon nouvelle ville
                            const list = getCommunesForVille(v);
                            setEditCommune(list[0] || "__other__");
                            setEditCommuneOther("");
                            setEditErrors((prev) => ({ ...prev, commune: "" }));
                            setOpenEditVille(false);
                          }}
                          placeholder="Rechercher une ville…"
                        />
                      </Modal>
                    </div>

                    {/* Commune (modal, dépend de la ville) */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">
                        Commune <span className="text-danger">*</span>
                      </label>
                      <button
                        type="button"
                        className={`form-select text-start ${
                          editErrors.commune ? "border border-danger" : ""
                        }`}
                        onClick={() => setOpenEditCommune(true)}
                      >
                        {editCommune === "__other__" ? "Autre…" : editCommune}
                      </button>
                      {editCommune === "__other__" && (
                        <input
                          className="form-control mt-2"
                          placeholder="Saisir votre commune"
                          value={editCommuneOther}
                          onChange={(e) => {
                            setEditCommuneOther(e.target.value);
                            setEditErrors((prev) => ({ ...prev, commune: "" }));
                          }}
                        />
                      )}
                      {editErrors.commune && (
                        <div className="text-danger small mt-1">
                          {editErrors.commune}
                        </div>
                      )}
                      <Modal
                        open={openEditCommune}
                        title="Sélectionner une commune"
                        onClose={() => setOpenEditCommune(false)}
                      >
                        <ListPicker
                          options={getCommunesForVille(editVille)}
                          value={editCommune}
                          onSelect={(val) => {
                            setEditCommune(val);
                            setEditCommuneOther("");
                            setEditErrors((prev) => ({ ...prev, commune: "" }));
                            setOpenEditCommune(false);
                          }}
                          placeholder="Rechercher une commune…"
                        />
                      </Modal>
                    </div>

                    {/* Quartier (TEXTE LIBRE) */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">
                        Quartier <span className="text-danger">*</span>
                      </label>
                      <input
                        className={`form-control ${
                          editErrors.quartier ? "is-invalid" : ""
                        }`}
                        placeholder="Ex. Riad Oulfa, Terminus 20"
                        value={editQuartierText}
                        onChange={(e) => {
                          setEditQuartierText(e.target.value);
                          setEditErrors((prev) => ({ ...prev, quartier: "" }));
                        }}
                        autoCapitalize="words"
                        autoComplete="address-level3"
                      />
                      {editErrors.quartier && (
                        <div className="invalid-feedback">{editErrors.quartier}</div>
                      )}
                      <div className="form-text">
                        Saisissez librement votre quartier.
                      </div>
                    </div>

                    {/* Sexe (M/F) */}
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
                  </form>
                </div>
              </div>
            ) : (
              // Récap infos
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
                      <div className="text-muted small">Ville</div>
                      <div className="fw-semibold">
                        {(user as any).ville || effectiveVille}
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Commune</div>
                      <div className="fw-semibold">
                        {(user as any).commune ||
                          (editCommune === "__other__"
                            ? editCommuneOther
                            : editCommune) ||
                          "—"}
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Quartier</div>
                      <div className="fw-semibold">
                        {(user as any).quartier || editQuartierText || "—"}
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Sexe</div>
                      <div className="fw-semibold">
                        {(user as any).sexe || "—"}
                      </div>
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
                      <Phone size={16} /> Téléphone{" "}
                      <span className="text-danger">*</span>
                    </label>
                    <input
                      type="tel"
                      className={`form-control ${
                        loginErrors.phone ? "is-invalid" : ""
                      }`}
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
                      <div className="invalid-feedback">
                        {loginErrors.phone}
                      </div>
                    )}
                  </div>
                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Lock size={16} /> Mot de passe{" "}
                      <span className="text-danger">*</span>
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
                      <div className="invalid-feedback d-block">
                        {loginErrors.password}
                      </div>
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
                      <Phone size={16} /> Téléphone{" "}
                      <span className="text-danger">*</span>
                    </label>
                    <input
                      type="tel"
                      className={`form-control ${
                        regErrors.phone ? "is-invalid" : ""
                      }`}
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
                      <div className="invalid-feedback">
                        {regErrors.phone}
                      </div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Lock size={16} /> Mot de passe{" "}
                      <span className="text-danger">*</span>
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
                      <div className="invalid-feedback d-block">
                        {regErrors.password}
                      </div>
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

                  {/* Ville (sélectionnable) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label">
                      Ville <span className="text-danger">*</span>
                    </label>
                    <button
                      type="button"
                      className="form-select text-start"
                      onClick={() => setOpenRegVille(true)}
                    >
                      {regVille}
                    </button>
                    <Modal
                      open={openRegVille}
                      title="Sélectionner une ville"
                      onClose={() => setOpenRegVille(false)}
                    >
                      <ListPicker
                        options={VILLE_OPTIONS as unknown as string[]}
                        value={regVille}
                        onSelect={(val) => {
                          const v = (val as Ville) || DEFAULT_VILLE;
                          setRegVille(v);
                          // reset commune selon nouvelle ville
                          const list = getCommunesForVille(v);
                          setRegCommune(list[0] || "__other__");
                          setRegCommuneOther("");
                          setRegErrors((prev) => ({ ...prev, commune: "" }));
                          setOpenRegVille(false);
                        }}
                        placeholder="Rechercher une ville…"
                      />
                    </Modal>
                  </div>

                  {/* Commune (modal, dépend de la ville) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label">
                      Commune <span className="text-danger">*</span>
                    </label>
                    <button
                      type="button"
                      className={`form-select text-start ${
                        regErrors.commune ? "border border-danger" : ""
                      }`}
                      onClick={() => setOpenRegCommune(true)}
                    >
                      {regCommune === "__other__" ? "Autre…" : regCommune}
                    </button>
                    {regCommune === "__other__" && (
                      <input
                        className="form-control mt-2"
                        placeholder="Saisir votre commune"
                        value={regCommuneOther}
                        onChange={(e) => {
                          setRegCommuneOther(e.target.value);
                          setRegErrors((prev) => ({ ...prev, commune: "" }));
                        }}
                        required
                      />
                    )}
                    {regErrors.commune && (
                      <div className="text-danger small mt-1">
                        {regErrors.commune}
                      </div>
                    )}

                    <Modal
                      open={openRegCommune}
                      title="Sélectionner une commune"
                      onClose={() => setOpenRegCommune(false)}
                    >
                      <ListPicker
                        options={getCommunesForVille(regVille)}
                        value={regCommune}
                        onSelect={(val) => {
                          setRegCommune(val);
                          setRegCommuneOther("");
                          setRegErrors((prev) => ({ ...prev, commune: "" }));
                          setOpenRegCommune(false);
                        }}
                        placeholder="Rechercher une commune…"
                      />
                    </Modal>
                  </div>

                  {/* Quartier (TEXTE LIBRE) */}
                  <div className="col-12">
                    <label className="form-label">
                      Quartier <span className="text-danger">*</span>
                    </label>
                    <input
                      className={`form-control ${
                        regErrors.quartier ? "is-invalid" : ""
                      }`}
                      placeholder="Ex. Riad Oulfa, Terminus 20"
                      value={regQuartierText}
                      onChange={(e) => {
                        setRegQuartierText(e.target.value);
                        setRegErrors((prev) => ({ ...prev, quartier: "" }));
                      }}
                      autoCapitalize="words"
                      autoComplete="address-level3"
                      required
                    />
                    {regErrors.quartier && (
                      <div className="invalid-feedback">
                        {regErrors.quartier}
                      </div>
                    )}
                  </div>

                  {/* Sexe (M/F) */}
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

                  {/* ✅ Acceptation des Conditions & Politique */}
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
                      Tu peux les consulter en cliquant sur les liens ci-dessus
                      avant de continuer.
                    </div>
                  </div>

                  <div className="col-12 d-grid">
                    <button className="btn btn-dark" type="submit">
                      Créer le compte
                    </button>
                  </div>
                </form>
              )}

              {tab === "forgot" && (
                <form onSubmit={handleForgot} className="row g-3">
                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Phone size={16} /> Téléphone{" "}
                      <span className="text-danger">*</span>
                    </label>
                    <input
                      type="tel"
                      className={`form-control ${
                        forgotErrors.phone ? "is-invalid" : ""
                      }`}
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
                      <div className="invalid-feedback">
                        {forgotErrors.phone}
                      </div>
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
                Utilisez votre numéro de téléphone et votre mot de passe pour vous
                connecter.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
