// src/pages/Profile.tsx
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Lock,
  UserRound,
  Phone,
  LogOut,
  Pencil,
} from "lucide-react";
import { PageLoader } from "../components/ui/Spinner";
import {
  type User,
  login,
  register,
  logout,
  me,
  getCurrentUser,
  updateProfile,
  mapCityCodeToVille,
  changePassword,
} from "../services/auth";
import { http } from "../services/http";
import { normalizePhoneInput, isValidPhoneIntl } from "../utils/phone";
import { useLocationCity } from "../context/LocationContext";
import type { LocationsStore } from "./profile/types";
import { normKey, titleCase, uniqSorted } from "./profile/helpers/strings";
import {
  COUNTRY_FIXED,
  loadLocations,
  addVille,
  addCommune,
  addQuartier,
  communesForVille,
  quartiersForVille,
} from "./profile/helpers/locations";
import {
  validateRegisterForm,
  validateEditForm,
  validatePasswordForm,
} from "./profile/helpers/validation";
import { useLocationsApi } from "./profile/hooks/useLocationsApi";
import { Avatar } from "./profile/components/Avatar";
import { Modal } from "./profile/components/Modal";
import { PasswordField } from "./profile/components/PasswordField";
import { SmartPicker } from "./profile/components/SmartPicker";


/* ===== OTP start ===== */
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
  const locApi = useLocationsApi();

  const villeFromContext = useMemo(() => {
    const v = mapCityCodeToVille(city);
    return titleCase(v || "") || "Casablanca";
  }, [city]);

  const [locations, setLocations] = useState<LocationsStore>(() =>
    loadLocations()
  );

  /* User */
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const tabFromUrl = (sp.get("tab") as "login" | "register" | "forgot" | null) || null;
  const [tab, setTab] = useState<"login" | "register" | "forgot">(
    tabFromUrl || "login"
  );

  /* Login */
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

  /* Register */
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");

  const [regVille, setRegVille] = useState<string>(() => villeFromContext);
  const [regCommune, setRegCommune] = useState<string>("");
  const [regQuartier, setRegQuartier] = useState<string>("");

  const [regSexe, setRegSexe] = useState<"M" | "F">("M");
  const [regAccept, setRegAccept] = useState(false);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  /* Forgot */
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotErrors, setForgotErrors] = useState<Record<string, string>>({});

  /* Edit */
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");

  const [editVille, setEditVille] = useState<string>(() =>
    titleCase((user as any)?.ville || villeFromContext)
  );
  const [editCommune, setEditCommune] = useState<string>(() =>
    titleCase((user as any)?.commune || "")
  );
  const [editQuartier, setEditQuartier] = useState<string>(() =>
    titleCase((user as any)?.quartier || "")
  );
  const [editSexe, setEditSexe] = useState<"M" | "F">(
    ((user as any)?.sexe as "M" | "F") || "M"
  );
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  /* Change password */
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {}
  );
  const [passwordLoading, setPasswordLoading] = useState(false);

  /* Modals */
  const [openRegVille, setOpenRegVille] = useState(false);
  const [openEditVille, setOpenEditVille] = useState(false);
  const [openRegCommune, setOpenRegCommune] = useState(false);
  const [openEditCommune, setOpenEditCommune] = useState(false);
  const [openRegQuartier, setOpenRegQuartier] = useState(false);
  const [openEditQuartier, setOpenEditQuartier] = useState(false);

  /* Boot user */
  useEffect(() => {
    (async () => {
      try {
        const u = await me();
        if (u) {
          setUser(u);

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

          setEditVille(uVille);
          setEditCommune(uCommune);
          setEditQuartier(uQuartier);

          if ((u as any)?.sexe === "M" || (u as any)?.sexe === "F")
            setEditSexe((u as any).sexe);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [villeFromContext]);

  /* Sync when user updates */
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

    if ((user as any)?.sexe === "M" || (user as any)?.sexe === "F")
      setEditSexe((user as any).sexe);
  }, [user, villeFromContext]);

  /* =========================
   * Options loaders
   * ========================= */
  const loadCities = useMemo(() => {
    return async (q: string) => {
      const apiList = await locApi.listCities(q);
      const local = locations.villes || [];
      return uniqSorted([...apiList, ...local]);
    };
  }, [locApi, locations.villes]);

  const loadCommunesFor = useMemo(() => {
    return (cityName: string) => async (q: string) => {
      const city = titleCase(cityName);
      const apiList = city ? await locApi.listCommunes(city) : [];
      const local = city ? communesForVille(locations, city) : [];
      const merged = uniqSorted([...apiList, ...local]);

      if (!q?.trim()) return merged;
      const needle = normKey(q);
      return merged.filter((x) => normKey(x).includes(needle));
    };
  }, [locApi, locations]);

  const loadQuartiersFor = useMemo(() => {
    return (cityName: string, communeName: string) => async (q: string) => {
      const city = titleCase(cityName);
      const commune = titleCase(communeName);
      const apiList =
        city && commune ? await locApi.listQuartiers(city, commune) : [];
      const local = city ? quartiersForVille(locations, city) : [];
      const merged = uniqSorted([...apiList, ...local]);

      if (!q?.trim()) return merged;
      const needle = normKey(q);
      return merged.filter((x) => normKey(x).includes(needle));
    };
  }, [locApi, locations]);

  /* ================== Handlers ================== */
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

    const errors: Record<string, string> = {};
    const phoneVal = normalizePhoneInput(loginPhone.trim());

    if (!phoneVal) errors.phone = "Téléphone requis.";
    else if (!isValidPhoneIntl(phoneVal))
      errors.phone = "Numéro invalide. Utilisez le format international ex : +212";

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

      locApi.addCity(uVille);
      if (uCommune) locApi.addCommune(uVille, uCommune);
      if (uCommune && uQuartier)
        locApi.addQuartier(uVille, uCommune, uQuartier);

      navigate("/", { replace: true });
    } catch (e: any) {
      setErr(e.message || "Erreur de connexion");
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

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
      setErr(
        "Vous devez accepter les Conditions d’utilisation et la Politique de confidentialité pour créer un compte."
      );
      return;
    }

    setRegErrors({});
    const phoneVal = normalizePhoneInput(regPhone.trim());

    try {
      setLocations((prev) => {
        let next = prev;
        next = addVille(next, villeFinal);
        next = addCommune(next, villeFinal, communeFinal);
        next = addQuartier(next, villeFinal, quartierFinal);
        return next;
      });

      locApi.addCity(villeFinal);
      locApi.addCommune(villeFinal, communeFinal);
      locApi.addQuartier(villeFinal, communeFinal, quartierFinal);

      await register({
        phone: phoneVal,
        password: regPassword,
        first_name: regFirstName || undefined,
        last_name: regLastName || undefined,
        ville: villeFinal,
        commune: communeFinal || null,
        quartier: quartierFinal,
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
    setSuccess(null);

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
      setLocations((prev) => {
        let next = prev;
        next = addVille(next, villeFinal);
        next = addCommune(next, villeFinal, communeFinal);
        next = addQuartier(next, villeFinal, quartierFinal);
        return next;
      });

      locApi.addCity(villeFinal);
      locApi.addCommune(villeFinal, communeFinal);
      locApi.addQuartier(villeFinal, communeFinal, quartierFinal);

      const u = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        phone: phoneVal,
        ville: villeFinal,
        commune: communeFinal || null,
        quartier: quartierFinal,
        sexe: editSexe,
      } as any);

      setUser(u);
      setEditing(false);
      setSuccess("Profil mis à jour avec succès.");
    } catch (e: any) {
      setErr(e.message || "Erreur de mise à jour du profil");
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

    const errors = validatePasswordForm({
      currentPassword: passwordCurrent,
      newPassword: passwordNew,
      confirmPassword: passwordConfirm,
    });

    setPasswordErrors(errors);

    if (Object.keys(errors).length) {
      setErr(Object.values(errors)[0]);
      return;
    }

    setPasswordErrors({});
    setPasswordLoading(true);

    try {
      const res = await changePassword(passwordCurrent, passwordNew);
      setSuccess(res?.message || "Mot de passe modifié avec succès.");
      setPasswordCurrent("");
      setPasswordNew("");
      setPasswordConfirm("");
    } catch (e: any) {
      setErr(e.message || "Erreur de changement du mot de passe");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

    const phoneVal = normalizePhoneInput(forgotPhone.trim());
    const errors: Record<string, string> = {};

    if (!phoneVal) errors.phone = "Téléphone requis.";
    else if (!isValidPhoneIntl(phoneVal))
      errors.phone =
        "Téléphone invalide. Utilisez le format international ex : +2126…";

    if (Object.keys(errors).length) {
      setForgotErrors(errors);
      setErr(Object.values(errors)[0]);
      return;
    }

    setForgotErrors({});
    try {
      await apiOtpStart(phoneVal, "reset");
      navigate(
        `/verify?phone=${encodeURIComponent(phoneVal)}&purpose=reset`
      );
    } catch (e: any) {
      setErr(
        e?.message || "Impossible d'envoyer le code de réinitialisation."
      );
    }
  }

  /* ================== UI ================== */
  if (loading) {
    return (
      <div className="container-xxl py-4">
        <PageLoader />
      </div>
    );
  }

  /* =========================
   * CONNECTED
   * ========================= */
  if (user) {
    const effectiveVille =
      titleCase((user as any)?.ville || editVille || villeFromContext) || "—";
    const effectiveCommune =
      titleCase((user as any)?.commune || editCommune) || "—";
    const effectiveQuartier =
      titleCase((user as any)?.quartier || editQuartier) || "—";

    return (
      <div className="container-xxl py-4">
        {err && <div className="alert alert-danger">{err}</div>}
        {success && <div className="alert alert-success">{success}</div>}

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
                      <div className="invalid-feedback">
                        {forgotErrors.phone}
                      </div>
                    )}
                    <div className="d-grid mt-3">
                      <button className="btn btn-dark" type="submit">
                        Envoyer
                      </button>
                    </div>
                    <div className="form-text mt-2">
                      Nous t’enverrons un code par SMS. Tu le renseigneras sur
                      la page suivante.
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="card border-0 shadow-sm mt-3">
              <div className="card-body">
                <h2 className="h6 d-flex align-items-center gap-2">
                  <Lock size={18} /> Changer mon mot de passe
                </h2>

                <form className="row g-3 mt-1" onSubmit={handleChangePassword}>
                  <div className="col-12">
                    <label className="form-label">
                      Mot de passe actuel{" "}
                      <span className="text-danger">*</span>
                    </label>
                    <PasswordField
                      id="currentPassword"
                      value={passwordCurrent}
                      onChange={(e) => {
                        setPasswordCurrent(e.target.value);
                        setPasswordErrors((prev) => ({
                          ...prev,
                          currentPassword: "",
                        }));
                      }}
                      required
                      invalid={!!passwordErrors.currentPassword}
                      placeholder="Saisissez votre mot de passe actuel"
                      autoComplete="current-password"
                    />
                    {passwordErrors.currentPassword && (
                      <div className="invalid-feedback d-block">
                        {passwordErrors.currentPassword}
                      </div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label">
                      Nouveau mot de passe{" "}
                      <span className="text-danger">*</span>
                    </label>
                    <PasswordField
                      id="newPassword"
                      value={passwordNew}
                      onChange={(e) => {
                        setPasswordNew(e.target.value);
                        setPasswordErrors((prev) => ({
                          ...prev,
                          newPassword: "",
                        }));
                      }}
                      required
                      invalid={!!passwordErrors.newPassword}
                      placeholder="Nouveau mot de passe"
                      autoComplete="new-password"
                    />
                    <div className="form-text">
                      Min 8 caractères, inclure au moins 1 lettre et 1 chiffre.
                    </div>
                    {passwordErrors.newPassword && (
                      <div className="invalid-feedback d-block">
                        {passwordErrors.newPassword}
                      </div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label">
                      Confirmer le nouveau mot de passe{" "}
                      <span className="text-danger">*</span>
                    </label>
                    <PasswordField
                      id="confirmPassword"
                      value={passwordConfirm}
                      onChange={(e) => {
                        setPasswordConfirm(e.target.value);
                        setPasswordErrors((prev) => ({
                          ...prev,
                          confirmPassword: "",
                        }));
                      }}
                      required
                      invalid={!!passwordErrors.confirmPassword}
                      placeholder="Confirmez le nouveau mot de passe"
                      autoComplete="new-password"
                    />
                    {passwordErrors.confirmPassword && (
                      <div className="invalid-feedback d-block">
                        {passwordErrors.confirmPassword}
                      </div>
                    )}
                  </div>

                  <div className="col-12 d-grid">
                    <button
                      className="btn btn-dark"
                      type="submit"
                      disabled={passwordLoading}
                    >
                      {passwordLoading
                        ? "Modification..."
                        : "Modifier le mot de passe"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
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
                        <div className="invalid-feedback">
                          {editErrors.phone}
                        </div>
                      )}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Pays</label>
                      <input
                        className="form-control"
                        value={COUNTRY_FIXED}
                        disabled
                      />
                      <div className="form-text">
                        Duumini est disponible au Maroc pour le moment.
                      </div>
                    </div>

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
                            setEditCommune("");
                            setEditQuartier("");
                            setEditErrors((prev) => ({
                              ...prev,
                              ville: "",
                              commune: "",
                              quartier: "",
                            }));
                          }}
                          placeholder="Saisir votre ville"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setOpenEditVille(true)}
                        >
                          Liste
                        </button>
                      </div>
                      {editErrors.ville && (
                        <div className="invalid-feedback d-block">
                          {editErrors.ville}
                        </div>
                      )}

                      <Modal
                        open={openEditVille}
                        title="Sélectionner une ville"
                        onClose={() => setOpenEditVille(false)}
                      >
                        <SmartPicker
                          value={editVille}
                          onSelect={(val) => {
                            setEditVille(val);
                            setEditCommune("");
                            setEditQuartier("");
                            setEditErrors((prev) => ({
                              ...prev,
                              ville: "",
                              commune: "",
                              quartier: "",
                            }));
                            setOpenEditVille(false);

                            setLocations((prev) => addVille(prev, val));
                            locApi.addCity(val);
                          }}
                          loadOptions={loadCities}
                          allowCreate
                          onCreate={async (val) => {
                            setLocations((prev) => addVille(prev, val));
                            await locApi.addCity(val);
                          }}
                          createLabel={(v) => `Ajouter la ville "${v}"`}
                          placeholder="Rechercher une ville…"
                        />
                      </Modal>
                    </div>

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
                            setEditQuartier("");
                            setEditErrors((prev) => ({
                              ...prev,
                              commune: "",
                              quartier: "",
                            }));
                          }}
                          placeholder="Saisir votre commune"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setOpenEditCommune(true)}
                        >
                          Liste
                        </button>
                      </div>
                      {editErrors.commune && (
                        <div className="invalid-feedback d-block">
                          {editErrors.commune}
                        </div>
                      )}

                      <Modal
                        open={openEditCommune}
                        title={`Communes — ${titleCase(editVille) || "Ville"}`}
                        onClose={() => setOpenEditCommune(false)}
                      >
                        <SmartPicker
                          value={editCommune}
                          onSelect={(val) => {
                            setEditCommune(val);
                            setEditQuartier("");
                            setEditErrors((prev) => ({
                              ...prev,
                              commune: "",
                              quartier: "",
                            }));
                            setOpenEditCommune(false);

                            const cityVal = titleCase(editVille);
                            setLocations((prev) =>
                              addCommune(prev, cityVal, val)
                            );
                            locApi.addCommune(cityVal, val);
                          }}
                          loadOptions={loadCommunesFor(editVille)}
                          allowCreate={!!titleCase(editVille)}
                          onCreate={async (val) => {
                            const cityVal = titleCase(editVille);
                            setLocations((prev) =>
                              addCommune(prev, cityVal, val)
                            );
                            await locApi.addCommune(cityVal, val);
                          }}
                          createLabel={(v) => `Ajouter la commune "${v}"`}
                          placeholder="Rechercher une commune…"
                        />
                      </Modal>
                      <div className="form-text">
                        La liste dépend de la ville.
                      </div>
                    </div>

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
                            setEditErrors((prev) => ({
                              ...prev,
                              quartier: "",
                            }));
                          }}
                          placeholder="Ex. Riad Oulfa, Terminus 20"
                          autoCapitalize="words"
                          autoComplete="address-level3"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setOpenEditQuartier(true)}
                        >
                          Liste
                        </button>
                      </div>
                      {editErrors.quartier && (
                        <div className="invalid-feedback d-block">
                          {editErrors.quartier}
                        </div>
                      )}

                      <Modal
                        open={openEditQuartier}
                        title={`Quartiers — ${titleCase(editVille) || "Ville"} / ${titleCase(editCommune) || "Commune"}`}
                        onClose={() => setOpenEditQuartier(false)}
                      >
                        <SmartPicker
                          value={editQuartier}
                          onSelect={(val) => {
                            setEditQuartier(val);
                            setEditErrors((prev) => ({
                              ...prev,
                              quartier: "",
                            }));
                            setOpenEditQuartier(false);

                            const cityVal = titleCase(editVille);
                            const communeVal = titleCase(editCommune);
                            setLocations((prev) =>
                              addQuartier(prev, cityVal, val)
                            );
                            if (communeVal)
                              locApi.addQuartier(cityVal, communeVal, val);
                          }}
                          loadOptions={loadQuartiersFor(
                            editVille,
                            editCommune
                          )}
                          allowCreate={
                            !!titleCase(editVille) && !!titleCase(editCommune)
                          }
                          onCreate={async (val) => {
                            const cityVal = titleCase(editVille);
                            const communeVal = titleCase(editCommune);
                            setLocations((prev) =>
                              addQuartier(prev, cityVal, val)
                            );
                            await locApi.addQuartier(
                              cityVal,
                              communeVal,
                              val
                            );
                          }}
                          createLabel={(v) => `Ajouter le quartier "${v}"`}
                          placeholder="Rechercher un quartier…"
                        />
                      </Modal>
                      <div className="form-text">
                        La liste dépend de la ville + commune.
                      </div>
                    </div>

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
                          <label
                            className="form-check-label"
                            htmlFor="editSexeM"
                          >
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
                          <label
                            className="form-check-label"
                            htmlFor="editSexeF"
                          >
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
                        ✅ Recherche en direct + cache. Les nouvelles valeurs
                        peuvent être ajoutées à la base (suggestions).
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
                      <div className="fw-semibold">
                        {user.first_name || "—"}
                      </div>
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

  /* =========================
   * NOT CONNECTED
   * ========================= */
  return (
    <div className="container-xxl py-4">
      {err && <div className="alert alert-danger">{err}</div>}
      {success && <div className="alert alert-success">{success}</div>}

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
                        setLoginErrors((prev) => ({
                          ...prev,
                          password: "",
                        }));
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
                      <Lock size={16} /> Mot de passe{" "}
                      <span className="text-danger">*</span>
                    </label>
                    <PasswordField
                      id="registerPassword"
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        setRegErrors((prev) => ({
                          ...prev,
                          password: "",
                        }));
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

                  <div className="col-12 col-md-6">
                    <label className="form-label">Pays</label>
                    <input className="form-control" value={COUNTRY_FIXED} disabled />
                  </div>

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
                          setRegCommune("");
                          setRegQuartier("");
                          setRegErrors((prev) => ({
                            ...prev,
                            ville: "",
                            commune: "",
                            quartier: "",
                          }));
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
                      <div className="invalid-feedback d-block">
                        {regErrors.ville}
                      </div>
                    )}

                    <Modal
                      open={openRegVille}
                      title="Sélectionner une ville"
                      onClose={() => setOpenRegVille(false)}
                    >
                      <SmartPicker
                        value={regVille}
                        onSelect={(val) => {
                          setRegVille(val);
                          setRegCommune("");
                          setRegQuartier("");
                          setRegErrors((prev) => ({
                            ...prev,
                            ville: "",
                            commune: "",
                            quartier: "",
                          }));
                          setOpenRegVille(false);

                          setLocations((prev) => addVille(prev, val));
                          locApi.addCity(val);
                        }}
                        loadOptions={loadCities}
                        allowCreate
                        onCreate={async (val) => {
                          setLocations((prev) => addVille(prev, val));
                          await locApi.addCity(val);
                        }}
                        createLabel={(v) => `Ajouter la ville "${v}"`}
                        placeholder="Rechercher une ville…"
                      />
                    </Modal>
                  </div>

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
                          setRegQuartier("");
                          setRegErrors((prev) => ({
                            ...prev,
                            commune: "",
                            quartier: "",
                          }));
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
                      <div className="invalid-feedback d-block">
                        {regErrors.commune}
                      </div>
                    )}

                    <Modal
                      open={openRegCommune}
                      title={`Communes — ${titleCase(regVille) || "Ville"}`}
                      onClose={() => setOpenRegCommune(false)}
                    >
                      <SmartPicker
                        value={regCommune}
                        onSelect={(val) => {
                          setRegCommune(val);
                          setRegQuartier("");
                          setRegErrors((prev) => ({
                            ...prev,
                            commune: "",
                            quartier: "",
                          }));
                          setOpenRegCommune(false);

                          const cityVal = titleCase(regVille);
                          setLocations((prev) => addCommune(prev, cityVal, val));
                          locApi.addCommune(cityVal, val);
                        }}
                        loadOptions={loadCommunesFor(regVille)}
                        allowCreate={!!titleCase(regVille)}
                        onCreate={async (val) => {
                          const cityVal = titleCase(regVille);
                          setLocations((prev) => addCommune(prev, cityVal, val));
                          await locApi.addCommune(cityVal, val);
                        }}
                        createLabel={(v) => `Ajouter la commune "${v}"`}
                        placeholder="Rechercher une commune…"
                      />
                    </Modal>
                    <div className="form-text">
                      La liste dépend de la ville.
                    </div>
                  </div>

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
                          setRegErrors((prev) => ({
                            ...prev,
                            quartier: "",
                          }));
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
                      <div className="invalid-feedback d-block">
                        {regErrors.quartier}
                      </div>
                    )}

                    <Modal
                      open={openRegQuartier}
                      title={`Quartiers — ${titleCase(regVille) || "Ville"} / ${titleCase(regCommune) || "Commune"}`}
                      onClose={() => setOpenRegQuartier(false)}
                    >
                      <SmartPicker
                        value={regQuartier}
                        onSelect={(val) => {
                          setRegQuartier(val);
                          setRegErrors((prev) => ({
                            ...prev,
                            quartier: "",
                          }));
                          setOpenRegQuartier(false);

                          const cityVal = titleCase(regVille);
                          const communeVal = titleCase(regCommune);
                          setLocations((prev) => addQuartier(prev, cityVal, val));
                          if (communeVal)
                            locApi.addQuartier(cityVal, communeVal, val);
                        }}
                        loadOptions={loadQuartiersFor(
                          regVille,
                          regCommune
                        )}
                        allowCreate={
                          !!titleCase(regVille) && !!titleCase(regCommune)
                        }
                        onCreate={async (val) => {
                          const cityVal = titleCase(regVille);
                          const communeVal = titleCase(regCommune);
                          setLocations((prev) => addQuartier(prev, cityVal, val));
                          await locApi.addQuartier(cityVal, communeVal, val);
                        }}
                        createLabel={(v) => `Ajouter le quartier "${v}"`}
                        placeholder="Rechercher un quartier…"
                      />
                    </Modal>

                    <div className="form-text">
                      La liste dépend de la ville + commune.
                    </div>
                  </div>

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
                        <label
                          className="form-check-label"
                          htmlFor="regSexeM"
                        >
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
                        <label
                          className="form-check-label"
                          htmlFor="regSexeF"
                        >
                          F
                        </label>
                      </div>
                    </div>
                  </div>

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

                  <div className="col-12">
                    <div className="alert alert-light border small mb-0">
                      ✅ Recherche en direct + cache. Les nouvelles valeurs
                      peuvent être ajoutées à la base (suggestions).
                    </div>
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
                Utilisez votre numéro de téléphone et votre mot de passe pour
                vous connecter.
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