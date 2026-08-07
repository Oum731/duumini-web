// src/pages/commercial/CommercialHome.tsx
// Tableau de bord commercial : CA du mois, solde de commission dû, et
// formulaire de déclaration de vente (remplace le report manuel WhatsApp
// — la commande créée ici est automatiquement rattachée au commercial
// connecté côté serveur, jamais choisie depuis le client).
//
// ✅ Formulaire volontairement léger (pas le AdminOrderForClientModal
// complet, 1700+ lignes, qui dépend de GET /api/admin/users réservé aux
// ADMIN) : un commercial saisit directement les infos client + produits,
// sans recherche de compte existant.
import { useEffect, useState } from "react";
import { Seo } from "../../components/Seo";
import { LoadingState } from "../../components/ui/Spinner";
import { moneyMAD } from "../../utils/money";
import { listProducts, type Product } from "../../services/products";
import { createAdminOrder } from "../../services/orders";
import { waHref } from "../../components/ordersAdmin/orderUtils";
import {
  getMyCommercialProfile,
  commercialProfileErrorMessage,
  type MyCommercialProfile,
} from "../../services/commercialProfiles";

type CartLine = { product: Product; qty: number };

export default function CommercialHome() {
  const [profile, setProfile] = useState<MyCommercialProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");

  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);
  // ✅ Reçu WhatsApp de la dernière déclaration enregistrée — reconstruit à
  // partir des données déjà en main (formulaire + réponse de création),
  // pas besoin de recharger la commande. Même message que celui envoyé
  // par un admin depuis OrdersAdminPage/OrderViewModal (buildAdminWhatsappMessage).
  const [lastReceiptHref, setLastReceiptHref] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const p = await getMyCommercialProfile();
      setProfile(p);
    } catch (e: any) {
      setError(commercialProfileErrorMessage(e, "Impossible de charger votre profil."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const q = productQuery.trim();
    if (!q) {
      setProductResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await listProducts({ q, onlyActive: true, pageSize: 8 });
        if (!cancelled) setProductResults(res.items || []);
      } catch {
        if (!cancelled) setProductResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [productQuery]);

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [...prev, { product: p, qty: 1 }];
    });
    setProductQuery("");
    setProductResults([]);
  }

  function updateQty(productId: number, qty: number) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.product.id !== productId)
        : prev.map((l) => (l.product.id === productId ? { ...l, qty } : l))
    );
  }

  const cartTotal = cart.reduce((sum, l) => sum + Number(l.product.price) * l.qty, 0);

  function resetForm() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setCity("");
    setCart([]);
    setProductQuery("");
    setFormError(null);
  }

  async function handleSubmit() {
    setFormError(null);
    setFormOk(null);

    if (!phone.trim()) {
      setFormError("Le téléphone du client est obligatoire.");
      return;
    }
    if (!city.trim()) {
      setFormError("La ville du client est obligatoire.");
      return;
    }
    if (cart.length === 0) {
      setFormError("Ajoutez au moins un produit.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createAdminOrder({
        customer: {
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          phone: phone.trim(),
          city: city.trim(),
          role: "CLIENT",
        },
        address: { city: city.trim() },
        items: cart.map((l) => ({
          product_id: l.product.id,
          qty: l.qty,
          name: l.product.name,
          price: Number(l.product.price),
        })),
      });

      setLastReceiptHref(
        waHref({
          id: created.id,
          display_code: created.display_code,
          status: created.status || "OPEN",
          created_at: new Date().toISOString(),
          contact: {
            first_name: firstName.trim() || undefined,
            last_name: lastName.trim() || undefined,
            phone: phone.trim(),
          },
          address: { city: city.trim() },
          items: cart.map((l) => ({
            product_id: l.product.id,
            product_name: l.product.name,
            qty: l.qty,
            unit_price: Number(l.product.price),
          })),
        })
      );

      setFormOk("Déclaration enregistrée — rattachée à votre compte.");
      resetForm();
      setFormOpen(false);
      await refresh();
    } catch (e: any) {
      setFormError(commercialProfileErrorMessage(e, "Impossible d'enregistrer cette déclaration."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container-xxl py-5">
        <LoadingState label="Chargement…" />
      </div>
    );
  }

  return (
    <section className="container-xxl py-5">
      <Seo
        title="Espace commercial"
        description="Déclarez vos ventes et suivez votre CA sur DUUMINI."
        path="/commercial"
      />

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          Espace commercial
        </h1>
        <button
          type="button"
          className="btn btn-duu-green btn-sm"
          onClick={() => setFormOpen((v) => !v)}
        >
          {formOpen ? "Fermer" : "+ Nouvelle déclaration"}
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {formOk && (
        <div className="alert alert-success py-2 d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <span>{formOk}</span>
          {lastReceiptHref ? (
            <a
              href={lastReceiptHref}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm btn-success"
            >
              Envoyer le reçu WhatsApp
            </a>
          ) : null}
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm p-3">
            <div className="text-muted small">CA du mois</div>
            <div className="fw-bold fs-4">{moneyMAD(profile?.revenue_month ?? 0, 2)}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm p-3">
            <div className="text-muted small">Commandes ce mois</div>
            <div className="fw-bold fs-4">{profile?.orders_month ?? 0}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm p-3">
            <div className="text-muted small">Clients ce mois</div>
            <div className="fw-bold fs-4">{profile?.clients_month ?? 0}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm p-3">
            <div className="text-muted small">Solde commission dû</div>
            <div className="fw-bold fs-4">{moneyMAD(profile?.pending_commission ?? 0, 2)}</div>
          </div>
        </div>
      </div>

      {profile && profile.pending_commission > 0 && (
        <div className="alert alert-secondary">
          Vous devez <strong>{moneyMAD(profile.pending_commission, 2)}</strong> à
          DUUMINI (taux : {(profile.commission_rate * 100).toFixed(1)}%). Réglé
          par l'administration selon vos accords.
        </div>
      )}

      {formOpen && (
        <div className="card border-0 shadow-sm p-3 mb-4">
          <h2 className="h6 mb-3">Nouvelle déclaration</h2>

          {formError && <div className="alert alert-danger py-2">{formError}</div>}

          <div className="row g-2 mb-3">
            <div className="col-6 col-md-3">
              <label className="form-label small">Prénom</label>
              <input
                className="form-control form-control-sm"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small">Nom</label>
              <input
                className="form-control form-control-sm"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small">Téléphone *</label>
              <input
                className="form-control form-control-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small">Ville *</label>
              <input
                className="form-control form-control-sm"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </div>
          </div>

          <label className="form-label small">Rechercher un produit</label>
          <input
            className="form-control form-control-sm mb-2"
            placeholder="Nom du produit…"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
          />
          {searching && <div className="small text-muted mb-2">Recherche…</div>}
          {productResults.length > 0 && (
            <div className="list-group mb-3">
              {productResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  onClick={() => addToCart(p)}
                >
                  <span>{p.name}</span>
                  <span className="text-muted small">{moneyMAD(Number(p.price))}</span>
                </button>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="table-responsive mb-3">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th style={{ width: 100 }}>Qté</th>
                    <th style={{ width: 120 }}>Sous-total</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((l) => (
                    <tr key={l.product.id}>
                      <td>{l.product.name}</td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          className="form-control form-control-sm"
                          value={l.qty}
                          onChange={(e) => updateQty(l.product.id, Number(e.target.value))}
                        />
                      </td>
                      <td>{moneyMAD(Number(l.product.price) * l.qty)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => updateQty(l.product.id, 0)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-end fw-bold mt-2">Total : {moneyMAD(cartTotal)}</div>
            </div>
          )}

          <button
            type="button"
            className="btn btn-duu-green"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Enregistrement…" : "Enregistrer la déclaration"}
          </button>
        </div>
      )}
    </section>
  );
}
