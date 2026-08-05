// src/pages/RejoindrePage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Seo } from "../components/Seo";
import { metaLead } from "../lib/metaPixel";
import { PERSONAS, type PersonaKey } from "./home/data";
import { listActiveCountries, type CountryConfig } from "../services/countries";
import {
  submitVendorApplication,
  applicationErrorMessage,
  type ApplicantType,
  type IdDocumentType,
} from "../services/vendorApplications";

const ID_DOCUMENT_TYPES: { value: IdDocumentType; label: string }[] = [
  { value: "CNI", label: "Carte d'identité nationale" },
  { value: "CARTE_SEJOUR", label: "Carte de séjour" },
  { value: "PASSPORT", label: "Passeport" },
];

// Livreur n'est pas un persona marketing de l'accueil (PERSONAS), c'est un
// profil propre au flux de candidature — type étendu localement plutôt que
// dans home/data.ts pour ne pas toucher la page d'accueil.
type RejoindreProfileKey = PersonaKey | "livreur";

// Fournisseur/Revendeur/Partenaire/Livreur passent par la candidature vétée
// (examinée par l'équipe admin) ; Client n'y figure pas — voir plus bas.
const TYPE_FROM_PERSONA: Partial<Record<RejoindreProfileKey, ApplicantType>> = {
  fournisseur: "FOURNISSEUR",
  revendeur: "VENDEUR",
  partenaire: "PARTENAIRE",
  livreur: "LIVREUR",
};

const FORM_COPY: Partial<
  Record<
    RejoindreProfileKey,
    {
      title: string;
      intro: string;
      nameLabel: string;
      namePlaceholder: string;
      showDocs: boolean;
      showIdentityDocs?: boolean;
    }
  >
> = {
  fournisseur: {
    title: "Devenir fournisseur DUUMINI",
    intro:
      "Producteur, fabricant ou marque africaine : dites-nous qui vous êtes, nous vous recontactons pour finaliser votre inscription. Deux documents sont nécessaires : votre Déclaration Fiscale d'Existence (DFE) et votre Registre de Commerce.",
    nameLabel: "Nom légal de l'entreprise",
    namePlaceholder: "Ex. Duumini Distribution SARL",
    showDocs: true,
  },
  revendeur: {
    title: "Devenir revendeur DUUMINI",
    intro:
      "Épicerie, restaurant, hôtel, grossiste ou distributeur : dites-nous qui vous êtes, nous vous recontactons pour finaliser votre inscription. Deux documents sont nécessaires : votre Déclaration Fiscale d'Existence (DFE) et votre Registre de Commerce.",
    nameLabel: "Nom légal de l'entreprise",
    namePlaceholder: "Ex. Duumini Distribution SARL",
    showDocs: true,
  },
  partenaire: {
    title: "Devenir partenaire DUUMINI",
    intro:
      "Investisseur, logisticien, institution, incubateur ou organisation : présentez votre structure, notre équipe vous recontacte pour identifier ensemble les opportunités de collaboration.",
    nameLabel: "Nom de l'organisation",
    namePlaceholder: "Ex. Nom de votre structure",
    showDocs: false,
  },
  livreur: {
    title: "Devenir livreur DUUMINI",
    intro:
      "Vous avez un moyen de transport (moto, voiture, vélo) ? Rejoignez le réseau de livreurs DUUMINI et acceptez des courses près de chez vous. Après cette candidature en ligne, vous devrez vous présenter à l'agence DUUMINI avec vos documents originaux pour validation avant de pouvoir accepter des courses.",
    nameLabel: "Nom complet",
    namePlaceholder: "Ex. Youssef El Amrani",
    showDocs: false,
    showIdentityDocs: true,
  },
};

function ProfilePicker() {
  const navigate = useNavigate();

  return (
    <section className="container-xxl py-5" style={{ maxWidth: 900 }}>
      <Seo
        title="Rejoindre DUUMINI"
        description="Fournisseur, revendeur, client ou partenaire : choisissez votre profil pour rejoindre le réseau DUUMINI."
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

      <p className="text-muted mb-4">Choisissez le profil qui vous correspond.</p>

      <div className="row g-3">
        {PERSONAS.map((p) => (
          <div className="col-12 col-sm-6" key={p.key}>
            <button
              type="button"
              className="card border-0 shadow-sm w-100 h-100 text-start p-4"
              style={{ borderRadius: "var(--duu-radius-xl)", background: "#fff" }}
              onClick={() =>
                p.key === "client"
                  ? navigate("/profile")
                  : navigate(`/rejoindre?type=${p.key}`)
              }
            >
              <div className="fs-2 mb-2" aria-hidden="true">
                {p.emoji}
              </div>
              <div className="fw-bold mb-1">Je suis {p.title.toLowerCase()}</div>
              <div className="text-muted small">{p.description}</div>
            </button>
          </div>
        ))}

        <div className="col-12 col-sm-6">
          <button
            type="button"
            className="card border-0 shadow-sm w-100 h-100 text-start p-4"
            style={{ borderRadius: "var(--duu-radius-xl)", background: "#fff" }}
            onClick={() => navigate("/rejoindre?type=livreur")}
          >
            <div className="fs-2 mb-2" aria-hidden="true">
              🛵
            </div>
            <div className="fw-bold mb-1">Je suis livreur</div>
            <div className="text-muted small">
              Moto, voiture ou vélo : rejoignez le réseau de livreurs DUUMINI
              et touchez une part sur chaque course.
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}

export default function RejoindrePage() {
  const [searchParams] = useSearchParams();
  const personaParam = (searchParams.get("type") || "") as RejoindreProfileKey;
  const applicantType = TYPE_FROM_PERSONA[personaParam];

  if (!applicantType) {
    return <ProfilePicker />;
  }

  return <ApplicationForm persona={personaParam} applicantType={applicantType} />;
}

function ApplicationForm({
  persona,
  applicantType,
}: {
  persona: RejoindreProfileKey;
  applicantType: ApplicantType;
}) {
  const [searchParams] = useSearchParams();
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [legalName, setLegalName] = useState(searchParams.get("name") || "");
  const [phone, setPhone] = useState(searchParams.get("phone") || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [countryCode, setCountryCode] = useState("MA");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [dfeFile, setDfeFile] = useState<File | null>(null);
  const [rcFile, setRcFile] = useState<File | null>(null);
  const [idDocumentType, setIdDocumentType] = useState<IdDocumentType>("CNI");
  const [idDocumentFile, setIdDocumentFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // ✅ Position GPS (livreur uniquement) — permet un suivi/dispatch des
  // courses proches dès l'approbation, sans attendre la première connexion
  // au tableau de bord. Jamais obligatoire (dégradation gracieuse).
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleLocate() {
    if (!navigator.geolocation) {
      setLocateError("Géolocalisation non disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? "Localisation refusée — vous pourrez la renseigner plus tard depuis votre tableau de bord."
            : "Impossible d'obtenir votre position pour le moment."
        );
      },
      { timeout: 8000 }
    );
  }

  const copy = FORM_COPY[persona]!;

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
    if (copy.showIdentityDocs && (!idDocumentFile || !photoFile)) {
      setError("Votre pièce d'identité et votre photo sont obligatoires.");
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
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          message: message.trim() || null,
          id_document_type: copy.showIdentityDocs ? idDocumentType : null,
        },
        copy.showDocs
          ? { dfe: dfeFile, rc: rcFile }
          : copy.showIdentityDocs
          ? { idDocument: idDocumentFile, photo: photoFile }
          : {}
      );
      metaLead({ content_name: applicantType });
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
            {persona === "partenaire" ? "Demande envoyée" : "Candidature envoyée"}
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
        title={copy.title}
        description="Fournisseur, revendeur, client ou partenaire ? Rejoignez le réseau DUUMINI."
        path="/rejoindre"
      />
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          {copy.title}
        </h1>
        <Link to="/rejoindre" className="btn btn-outline-dark">
          Changer de profil
        </Link>
      </div>

      <p className="text-muted mb-4">{copy.intro}</p>

      <form onSubmit={handleSubmit} className="card border-0 shadow-sm p-4">
        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="row g-3">
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
            <label className="form-label">{copy.nameLabel}</label>
            <input
              className="form-control"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder={copy.namePlaceholder}
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

          {copy.showDocs && (
            <>
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
            </>
          )}

          {copy.showIdentityDocs && (
            <>
              <div className="col-12">
                <label className="form-label">Type de pièce d'identité</label>
                <select
                  className="form-select"
                  value={idDocumentType}
                  onChange={(e) => setIdDocumentType(e.target.value as IdDocumentType)}
                >
                  {ID_DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-sm-6">
                <label className="form-label">Photo de la pièce d'identité</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="form-control"
                  onChange={(e) => setIdDocumentFile(e.target.files?.[0] || null)}
                  required
                />
                {idDocumentFile && <div className="form-text">{idDocumentFile.name}</div>}
              </div>

              <div className="col-12 col-sm-6">
                <label className="form-label">Votre photo</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  required
                />
                <div className="form-text">
                  Sert à vous identifier auprès de DUUMINI et des clients.
                </div>
                {photoFile && <div className="form-text">{photoFile.name}</div>}
              </div>

              <div className="col-12">
                <label className="form-label d-block">Votre position (optionnel)</label>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-dark"
                    onClick={handleLocate}
                    disabled={locating}
                  >
                    {locating
                      ? "Localisation…"
                      : coords
                      ? "Position enregistrée ✓ — réessayer"
                      : "📍 Utiliser ma position"}
                  </button>
                  {locateError && <span className="small text-danger">{locateError}</span>}
                </div>
                <div className="form-text">
                  Nous permet de vous proposer des courses proches de chez
                  vous dès l'activation de votre compte.
                </div>
              </div>
            </>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-duu-green mt-4"
          disabled={submitting}
        >
          {submitting ? "Envoi…" : persona === "partenaire" ? "Envoyer ma demande" : "Envoyer ma candidature"}
        </button>
      </form>
    </section>
  );
}
