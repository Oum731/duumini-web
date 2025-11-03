// src/pages/VerifyAndReset.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Lock, Phone, RotateCcw } from "lucide-react";
import { http } from "../services/http";

type OtpPurpose = "signup" | "login" | "reset";
type ApiOk = { ok: true; message?: string };

// API helpers
async function apiOtpStart(phone: string, purpose: OtpPurpose = "reset") {
  return http<ApiOk>("/api/auth/otp/start", {
    method: "POST",
    body: JSON.stringify({ phone, purpose }),
  });
}
async function apiOtpVerify(phone: string, code: string, purpose: OtpPurpose = "reset") {
  return http<ApiOk>("/api/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code, purpose }),
  });
}
async function apiPasswordReset(phone: string, new_password: string) {
  return http<ApiOk>("/api/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ phone, new_password }),
  });
}

const rePhoneMA = /^\+2126\d{8}$/;
const reOtp = /^\d{4,8}$/; // pour 000000 en DEV
const rePassword = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function VerifyAndResetPage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const initialPhone = (sp.get("phone") || "").trim();
  const initialPurpose = (sp.get("purpose") as OtpPurpose) || "reset";

  const [step, setStep] = useState<"otp" | "newpass">("otp");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [phone, setPhone] = useState(initialPhone);
  const [purpose] = useState<OtpPurpose>(initialPurpose);
  const [otp, setOtp] = useState("");

  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");

  const RESEND_DELAY = 60;
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const canSubmitOtp = useMemo(() => {
    return rePhoneMA.test(phone) && reOtp.test(otp);
  }, [phone, otp]);

  const canSubmitPwd = useMemo(() => {
    return rePassword.test(pwd1) && pwd1 === pwd2 && rePhoneMA.test(phone);
  }, [pwd1, pwd2, phone]);

  // Envoi auto si phone fourni
  useEffect(() => {
    (async () => {
      if (rePhoneMA.test(initialPhone)) {
        try {
          setErr(null);
          setInfo("Envoi du code en cours…");
          await apiOtpStart(initialPhone, initialPurpose);
          setInfo("Code envoyé par SMS. (En DEV: utilisez 000000)");
          setCooldown(RESEND_DELAY);
        } catch (e: any) {
          setErr(e?.message || "Impossible d'envoyer le code. Réessaie.");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!rePhoneMA.test(phone)) {
      setErr("Téléphone invalide (format +2126XXXXXXXX).");
      return;
    }
    try {
      setErr(null);
      setInfo("Envoi du code…");
      setLoading(true);
      await apiOtpStart(phone, purpose);
      setInfo("Code envoyé par SMS. (En DEV: utilisez 000000)");
      setCooldown(RESEND_DELAY);
    } catch (e: any) {
      setErr(e?.message || "Échec d'envoi du code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitOtp) {
      setErr("Vérifie le numéro et le code.");
      return;
    }
    try {
      setErr(null);
      setInfo("Vérification du code…");
      setLoading(true);
      await apiOtpVerify(phone, otp, purpose);
      setInfo("Code validé ✅. Tu peux maintenant définir un nouveau mot de passe.");
      setStep("newpass");
    } catch (e: any) {
      setErr(e?.message || "Code invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPwd(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitPwd) {
      setErr("Mot de passe invalide (min 8 caractères avec lettre + chiffre) ou confirmation différente.");
      return;
    }
    try {
      setErr(null);
      setInfo("Mise à jour du mot de passe…");
      setLoading(true);
      await apiPasswordReset(phone, pwd1);
      setInfo("Mot de passe modifié avec succès ✅ Redirection vers la connexion…");
      // 👉 redirection vers Profile avec l’onglet Connexion
      setTimeout(() => {
        nav("/profile?tab=login");
      }, 900);
    } catch (e: any) {
      setErr(e?.message || "Impossible de modifier le mot de passe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-xxl py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h1 className="h5 mb-3 d-flex align-items-center gap-2">
                {step === "otp" ? (
                  <>
                    <Phone size={18} /> Vérification par code SMS
                  </>
                ) : (
                  <>
                    <Lock size={18} /> Définir un nouveau mot de passe
                  </>
                )}
              </h1>

              {err && <div className="alert alert-danger py-2">{err}</div>}
              {info && <div className="alert alert-info py-2">{info}</div>}

              {step === "otp" && (
                <form onSubmit={handleVerifyOtp} className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Téléphone</label>
                    <input
                      type="tel"
                      className={`form-control ${phone && !rePhoneMA.test(phone) ? "is-invalid" : ""}`}
                      placeholder="+2126XXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                    {phone && !rePhoneMA.test(phone) && (
                      <div className="invalid-feedback">Format attendu: +2126XXXXXXXX</div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label">Code reçu par SMS</label>
                    <input
                      inputMode="numeric"
                      pattern="\d*"
                      className={`form-control ${otp && !reOtp.test(otp) ? "is-invalid" : ""}`}
                      placeholder="Ex: 000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      required
                    />
                    {otp && !reOtp.test(otp) && (
                      <div className="invalid-feedback">Code invalide</div>
                    )}
                    <div className="form-text">En DEV: le code de test est <code>000000</code>.</div>
                  </div>

                  <div className="col-12 d-grid d-sm-flex gap-2">
                    <button className="btn btn-dark" type="submit" disabled={!rePhoneMA.test(phone) || !reOtp.test(otp) || loading}>
                      Valider le code
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
                      onClick={handleSendCode}
                      disabled={loading || cooldown > 0 || !rePhoneMA.test(phone)}
                      title="Renvoyer le code"
                    >
                      <RotateCcw size={16} />
                      {cooldown > 0 ? `Renvoyer (${cooldown}s)` : "Renvoyer le code"}
                    </button>
                  </div>

                  <div className="col-12">
                    <div className="text-muted small">
                      Besoin d’aide ? <Link to="/contact">Contacte-nous</Link>.
                    </div>
                  </div>
                </form>
              )}

              {step === "newpass" && (
                <form onSubmit={handleResetPwd} className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Nouveau mot de passe</label>
                    <input
                      type="password"
                      className={`form-control ${pwd1 && !rePassword.test(pwd1) ? "is-invalid" : ""}`}
                      value={pwd1}
                      onChange={(e) => setPwd1(e.target.value)}
                      required
                    />
                    <div className="form-text">
                      Min 8 caractères, inclure au moins 1 lettre et 1 chiffre.
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label">Confirmer le mot de passe</label>
                    <input
                      type="password"
                      className={`form-control ${pwd2 && pwd1 !== pwd2 ? "is-invalid" : ""}`}
                      value={pwd2}
                      onChange={(e) => setPwd2(e.target.value)}
                      required
                    />
                    {pwd2 && pwd1 !== pwd2 && (
                      <div className="invalid-feedback">La confirmation ne correspond pas.</div>
                    )}
                  </div>

                  <div className="col-12 d-grid d-sm-flex gap-2">
                    <button className="btn btn-dark" type="submit" disabled={!canSubmitPwd || loading}>
                      Mettre à jour et aller à la connexion
                    </button>
                    <Link className="btn btn-outline-secondary" to="/profile?tab=login">
                      Annuler
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="text-center mt-3">
            <Link to="/profile?tab=login" className="text-decoration-none">Retour à la connexion</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
