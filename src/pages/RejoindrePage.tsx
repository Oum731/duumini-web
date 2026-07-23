// src/pages/RejoindrePage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { listActiveCountries, type CountryConfig } from "../services/countries";
import {
  submitVendorApplication,
  applicationErrorMessage,
  type ApplicantType,
} from "../services/vendorApplications";

const APPLICANT_TYPES: { value: ApplicantType; label: string }[] = [
  { value: "VENDEUR", label: "Vendeur" },
  { value: "FOURNISSEUR", label: "Fournisseur" },
  { value: "RESTAURANT", label: "Restaurant" },
];

export default function RejoindrePage() {
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [applicantType, setApplicantType] = useState<ApplicantType>("VENDEUR");
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("MA");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [dfeFile, setDfeFile] = useState<File | null>(null);
  const [rcFile, setRcFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    listActiveCountries()
      .then((items) => {
        if (mounted) setCountries(items);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!legalName.trim() || !phone.trim()) {
      setError("Le nom et le téléphone sont obligatoires.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitVendorApplication(
        {
          applicant_type: applicantType,
          legal_name: legalName.trim(),
          contact_phone: phone.trim(),
          contact_email: email.trim() || null,
          country_code: countryCode,
          city: city.trim() || null,
          message: message.trim() || null,
        },
        { dfe: dfeFile, rc: rcFile }
      );
      setDone(true);
    } catch (e: any) {
      setError(applicationErrorMessage(e, "Impossible d'envoyer votre candidature."));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="container-xxl py-5" style={{ maxWidth: 640 }}>
        <div className="card border-0 shadow-sm p-4 text-center">
          <h1 className="h4 mb-3" style={{ color: "var(--duu-green)" }}>
            Candidature envoyée
          </h1>
          <p className="text-muted mb-4">
            Merci ! Votre demande a bien été transmise. Notre équipe l'examine
            et vous recontacte sous 48h.
          </p>
          <Link to="/" className="btn btn-outline-dark align-self-center">
            Retour à l'accueil
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container-xxl py-5" style={{ maxWidth: 640 }}>
      <Seo
        title="Rejoindre DUUMINI"
        description="Vous êtes vendeur, fournisseur ou restaurateur ? Rejoignez le réseau DUUMINI et vendez vos produits à travers l'Afrique."
        path="/rejoindre"
      />
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          Rejoindre DUUMINI
        </h1>
        <Link to="/" className="btn btn-outline-dark">
          Accueil
        </Link>
      </div>

      <p className="text-muted mb-4">
        Vendeur, fournisseur ou restaurant : dites-nous qui vous êtes, nous
        vous recontactons pour finaliser votre inscription. Deux documents
        sont nécessaires : votre Déclaration Fiscale d'Existence (DFE) et
        votre Registre de Commerce.
      </p>

      <form onSubmit={handleSubmit} className="card border-0 shadow-sm p-4">
        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="row g-3">
          <div className="col-12 col-sm-6">
            <label className="form-label">Vous êtes</label>
            <select
              className="form-select"
              value={applicantType}
              onChange={(e) => setApplicantType(e.target.value as ApplicantType)}
            >
              {APPLICANT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-sm-6">
            <label className="form-label">Pays</label>
            <select
              className="form-select"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12">
            <label className="form-label">Nom légal de l'entreprise</label>
            <input
              className="form-control"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Ex. Duumini Distribution SARL"
              required
            />
          </div>

          <div className="col-12 col-sm-6">
            <label className="form-label">Téléphone</label>
            <input
              className="form-control"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212 6 00 00 00 00"
              required
            />
          </div>

          <div className="col-12 col-sm-6">
            <label className="form-label">Email (optionnel)</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="col-12">
            <label className="form-label">Ville</label>
            <input
              className="form-control"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="col-12">
            <label className="form-label">Message (optionnel)</label>
            <textarea
              className="form-control"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Décrivez brièvement votre activité..."
            />
          </div>

          <div className="col-12 col-sm-6">
            <label className="form-label">
              Déclaration Fiscale d'Existence (DFE)
            </label>
            <input
              type="file"
              accept="application/pdf,image/*"
              className="form-control"
              onChange={(e) => setDfeFile(e.target.files?.[0] || null)}
            />
            {dfeFile && <div className="form-text">{dfeFile.name}</div>}
          </div>

          <div className="col-12 col-sm-6">
            <label className="form-label">Registre de Commerce</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              className="form-control"
              onChange={(e) => setRcFile(e.target.files?.[0] || null)}
            />
            {rcFile && <div className="form-text">{rcFile.name}</div>}
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-duu-green mt-4"
          disabled={submitting}
        >
          {submitting ? "Envoi…" : "Envoyer ma candidature"}
        </button>
      </form>
    </section>
  );
}
