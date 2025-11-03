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
} from "../services/auth";
import { http } from "../services/http";

/* ====== Données (Casablanca) ====== */
const VILLE_FIXE = "Casablanca";

/** Communes/arrondissements courants de Casablanca */
const COMMUNES = [
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
] as const;

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

/* ====== Validation ====== */
const rePhoneMA = /^\+2126\d{8}$/; // +2126XXXXXXXX
const rePassword = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/; // min 8, 1 lettre, 1 chiffre

function validateRegisterForm(params: {
  phone: string;
  password: string;
  quartierText: string;
  commune: string;
}) {
  const errors: Record<string, string> = {};
  if (!rePhoneMA.test(params.phone.trim())) {
    errors.phone = "Format attendu: +2126XXXXXXXX (ex: +212600000000)";
  }
  if (!rePassword.test(params.password)) {
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
  if (!rePhoneMA.test(params.phone.trim())) {
    errors.phone = "Format attendu: +2126XXXXXXXX (ex: +212600000000)";
  }
  if (!params.quartierText.trim()) {
    errors.quartier = "Veuillez préciser votre quartier.";
  }
  if (!params.commune) {
    errors.commune = "Veuillez choisir une commune.";
  }
  return errors;
}

/* ====== Modal & ListPicker (pour Commune uniquement) ====== */
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
  options: readonly string[];
  value?: string | null;
  onSelect: (val: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options as string[];
    return (options as string[]).filter((o) =>
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
        onClick={() => setShow(s => !s)}
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        title={show ? "Masquer" : "Afficher"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/* ====== API Helpers locaux (OTP start) ====== */
async function apiOtpStart(phone: string, purpose: "signup" | "login" | "reset" = "reset") {
  return http<{ ok: true; message?: string }>("/api/auth/otp/start", {
    method: "POST",
    body: JSON.stringify({ phone, purpose }),
  });
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

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

  /* ====== Forms: Register ====== */
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regCommune, setRegCommune] = useState<(typeof COMMUNES)[number]>(COMMUNES[0]);
  const [regCommuneOther, setRegCommuneOther] = useState("");
  const [regQuartierText, setRegQuartierText] = useState(""); // ← libre
  const [regSexe, setRegSexe] = useState<"M" | "F">("M");
  const [regAccept, setRegAccept] = useState(false); // ✅ Acceptation CGU/Privacy
  const communeRegisterValue =
    regCommune === "__other__" ? (regCommuneOther.trim() || "") : regCommune;

  /* ====== Forms: Forgot ====== */
  const [forgotPhone, setForgotPhone] = useState("");

  /* ====== Forms: Edit (user connecté) ====== */
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [editCommune, setEditCommune] = useState<(typeof COMMUNES)[number]>(
    (user as any)?.commune || COMMUNES[0]
  );
  const [editCommuneOther, setEditCommuneOther] = useState("");
  const [editQuartierText, setEditQuartierText] = useState<string>((user as any)?.quartier || ""); // ← libre
  const [editSexe, setEditSexe] = useState<"M" | "F">(
    ((user as any)?.sexe as "M" | "F") || "M"
  );
  const communeEditValue =
    editCommune === "__other__" ? (editCommuneOther.trim() || "") : editCommune;

  /* ====== Modals (uniquement Commune) ====== */
  const [openRegCommune, setOpenRegCommune] = useState(false);
  const [openEditCommune, setOpenEditCommune] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const u = await me();
        if (u) {
          setUser(u);
          setEditQuartierText((u as any).quartier || "");
          setEditCommune((u as any).commune || COMMUNES[0]);
          if ((u as any).sexe === "M" || (u as any).sexe === "F") setEditSexe((u as any).sexe);
        }
      } catch {
        // pas grave si non loggé
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useMemo(() => {
    setFirstName(user?.first_name || "");
    setLastName(user?.last_name || "");
    setPhone(user?.phone || "");
    if ((user as any)?.quartier) setEditQuartierText((user as any).quartier);
    if ((user as any)?.commune) setEditCommune((user as any).commune);
    if ((user as any)?.sexe === "M" || (user as any)?.sexe === "F") setEditSexe((user as any).sexe);
  }, [user]);

  /* ================== Handlers ================== */
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const u = await login(loginPhone, loginPassword);
      setUser(u);
      // Redirection immédiate vers l'accueil après connexion
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

    try {
      await register({
        phone: regPhone.trim(),
        password: regPassword,
        first_name: regFirstName || undefined,
        last_name: regLastName || undefined,
        ville: VILLE_FIXE,
        commune: communeRegisterValue || null,
        quartier: regQuartierText.trim(),
        sexe: regSexe,
      } as any);
      const u = await login(regPhone.trim(), regPassword);
      setUser(u);
      // Redirection immédiate vers l'accueil après création + connexion
      navigate("/", { replace: true });
    } catch (e: any) {
      setErr(e.message || "Erreur d'inscription");
    }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setEditing(false);
    // Retour sur l’onglet Connexion
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
    if (Object.keys(errors).length) {
      setErr(Object.values(errors)[0]);
      return;
    }

    try {
      const u = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        phone: phone.trim(),
        ville: VILLE_FIXE,
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
    const phone = forgotPhone.trim();
    if (!rePhoneMA.test(phone)) {
      setErr("Téléphone invalide. Format attendu: +2126XXXXXXXX");
      return;
    }
    try {
      await apiOtpStart(phone, "reset");
      navigate(`/verify?phone=${encodeURIComponent(phone)}&purpose=reset`);
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
                    <label className="form-label">Téléphone</label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="+2126..."
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      required
                    />
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
                        <Phone size={16} /> Téléphone
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        className={`form-control ${phone && !rePhoneMA.test(phone) ? "is-invalid" : ""}`}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        placeholder="+2126XXXXXXXX"
                        autoComplete="tel"
                      />
                      {phone && !rePhoneMA.test(phone) && (
                        <div className="invalid-feedback">Format: +2126XXXXXXXX</div>
                      )}
                    </div>

                    {/* Ville (figée) */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">Ville</label>
                      <input className="form-control" value={VILLE_FIXE} disabled />
                    </div>

                    {/* Commune (modal) */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">Commune</label>
                      <button
                        type="button"
                        className="form-select text-start"
                        onClick={() => setOpenEditCommune(true)}
                      >
                        {editCommune === "__other__" ? "Autre…" : editCommune}
                      </button>
                      {editCommune === "__other__" && (
                        <input
                          className="form-control mt-2"
                          placeholder="Saisir votre commune"
                          value={editCommuneOther}
                          onChange={(e) => setEditCommuneOther(e.target.value)}
                        />
                      )}
                      <Modal
                        open={openEditCommune}
                        title="Sélectionner une commune"
                        onClose={() => setOpenEditCommune(false)}
                      >
                        <ListPicker
                          options={COMMUNES}
                          value={editCommune}
                          onSelect={(val) => {
                            setEditCommune(val as any);
                            setOpenEditCommune(false);
                          }}
                          placeholder="Rechercher une commune…"
                        />
                      </Modal>
                    </div>

                    {/* Quartier (TEXTE LIBRE) */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">Quartier</label>
                      <input
                        className="form-control"
                        placeholder="Ex. Riad Oulfa, Terminus 20"
                        value={editQuartierText}
                        onChange={(e) => setEditQuartierText(e.target.value)}
                        autoCapitalize="words"
                        autoComplete="address-level3"
                      />
                      <div className="form-text">Saisissez librement votre quartier.</div>
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
                      <div className="fw-semibold">{(user as any).ville || VILLE_FIXE}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-muted small">Commune</div>
                      <div className="fw-semibold">
                        {(user as any).commune ||
                          (editCommune === "__other__" ? editCommuneOther : editCommune) ||
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
                      <Phone size={16} /> Téléphone
                    </label>
                    <input
                      type="tel"
                      className={`form-control ${loginPhone && !rePhoneMA.test(loginPhone) ? "is-invalid" : ""}`}
                      placeholder="+2126..."
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      required
                    />
                    {loginPhone && !rePhoneMA.test(loginPhone) && (
                      <div className="invalid-feedback">Format: +2126XXXXXXXX</div>
                    )}
                  </div>
                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Lock size={16} /> Mot de passe
                    </label>
                    <PasswordField
                      id="loginPassword"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      placeholder="Votre mot de passe"
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="col-12 d-grid">
                    <button className="btn btn-dark" type="submit" disabled={!rePhoneMA.test(loginPhone)}>
                      Se connecter
                    </button>
                  </div>
                </form>
              )}

              {tab === "register" && (
                <form onSubmit={handleRegister} className="row g-3">
                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Phone size={16} /> Téléphone
                    </label>
                    <input
                      type="tel"
                      className={`form-control ${regPhone && !rePhoneMA.test(regPhone) ? "is-invalid" : ""}`}
                      placeholder="+2126..."
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      required
                    />
                    {regPhone && !rePhoneMA.test(regPhone) && (
                      <div className="invalid-feedback">Format: +2126XXXXXXXX</div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Lock size={16} /> Mot de passe
                    </label>
                    <PasswordField
                      id="registerPassword"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      invalid={!!(regPassword && !rePassword.test(regPassword))}
                      placeholder="Créer un mot de passe"
                      autoComplete="new-password"
                    />
                    <div className="form-text">
                      Min 8 caractères, inclure au moins 1 lettre et 1 chiffre.
                    </div>
                    {regPassword && !rePassword.test(regPassword) && (
                      <div className="invalid-feedback d-block">Mot de passe trop faible.</div>
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

                  {/* Ville (fixe) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label">Ville</label>
                    <input className="form-control" value={VILLE_FIXE} disabled />
                  </div>

                  {/* Commune (modal) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label">Commune</label>
                    <button
                      type="button"
                      className="form-select text-start"
                      onClick={() => setOpenRegCommune(true)}
                    >
                      {regCommune === "__other__" ? "Autre…" : regCommune}
                    </button>
                    {regCommune === "__other__" && (
                      <input
                        className="form-control mt-2"
                        placeholder="Saisir votre commune"
                        value={regCommuneOther}
                        onChange={(e) => setRegCommuneOther(e.target.value)}
                        required
                      />
                    )}

                    <Modal
                      open={openRegCommune}
                      title="Sélectionner une commune"
                      onClose={() => setOpenRegCommune(false)}
                    >
                      <ListPicker
                        options={COMMUNES}
                        value={regCommune}
                        onSelect={(val) => {
                          setRegCommune(val as any);
                          setOpenRegCommune(false);
                        }}
                        placeholder="Rechercher une commune…"
                      />
                    </Modal>
                  </div>

                  {/* Quartier (TEXTE LIBRE) */}
                  <div className="col-12">
                    <label className="form-label">Quartier</label>
                    <input
                      className="form-control"
                      placeholder="Ex. Riad Oulfa, Terminus 20"
                      value={regQuartierText}
                      onChange={(e) => setRegQuartierText(e.target.value)}
                      autoCapitalize="words"
                      autoComplete="address-level3"
                      required
                    />
                  </div>

                  {/* Sexe (M/F) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label">Sexe</label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="regSexe"
                          id="regSexeM"
                          checked={regSexe === "M"}
                          onChange={() => setRegSexe("M")}
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
                        <Link to="/legal/terms" className="link-dark">Conditions d’utilisation</Link>{" "}
                        et la{" "}
                        <Link to="/legal/privacy" className="link-dark">Politique de confidentialité</Link>.
                      </label>
                    </div>
                    <div className="form-text">
                      Tu peux les consulter en cliquant sur les liens ci-dessus avant de continuer.
                    </div>
                  </div>

                  <div className="col-12 d-grid">
                    <button
                      className="btn btn-dark"
                      type="submit"
                      disabled={
                        !rePhoneMA.test(regPhone) ||
                        !rePassword.test(regPassword) ||
                        (regCommune === "__other__" && !regCommuneOther.trim()) ||
                        !regQuartierText.trim() ||
                        !regAccept
                      }
                    >
                      Créer le compte
                    </button>
                  </div>
                </form>
              )}

              {tab === "forgot" && (
                <form onSubmit={handleForgot} className="row g-3">
                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">
                      <Phone size={16} /> Téléphone
                    </label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="+2126..."
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      required
                    />
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
