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
import { useCallback, useEffect, useMemo, useState } from "react";
import { Seo } from "../../components/Seo";
import { LoadingState } from "../../components/ui/Spinner";
import { moneyMAD } from "../../utils/money";
import { imgUrl } from "../../utils/media";
import { listProducts, type Product } from "../../services/products";
import { createAdminOrder, getOrder } from "../../services/orders";
import { waHref } from "../../components/ordersAdmin/orderUtils";
import OrderReceipt from "../../components/ordersAdmin/OrderReceipt";
import { useRealtime } from "../../context/RealtimeContext";
import {
  getMyCommercialProfile,
  commercialProfileErrorMessage,
  type MyCommercialProfile,
} from "../../services/commercialProfiles";

type CartLine = { product: Product; qty: number };

export default function CommercialHome() {
  const { socket } = useRealtime();
  const [profile, setProfile] = useState<MyCommercialProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");

  // ✅ Catalogue complet chargé une fois à l'ouverture du formulaire, puis
  // filtré côté client au fil de la frappe — même principe que
  // AdminOrderForClientModal (loadAllProducts + filtre local), pour que le
  // commercial puisse parcourir tous les produits (pas seulement ceux qui
  // matchent une recherche tapée), avec vignette + bouton "Ajouter" comme
  // côté admin.
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsErr, setProductsErr] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);
  // ✅ Reçu WhatsApp de la dernière déclaration enregistrée — reconstruit à
  // partir des données déjà en main (formulaire + réponse de création),
  // pas besoin de recharger la commande. Même message que celui envoyé
  // par un admin depuis OrdersAdminPage/OrderViewModal (buildAdminWhatsappMessage).
  const [lastReceiptHref, setLastReceiptHref] = useState<string | null>(null);
  // ✅ Commande complète de la dernière déclaration, pour afficher le même
  // ticket <OrderReceipt> que l'admin (OrderViewModal) — avec son bouton
  // natif "Partager WhatsApp (image)" en plus du lien texte ci-dessus.
  const [lastOrder, setLastOrder] = useState<Record<string, unknown> | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

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

  // ✅ Rafraîchit automatiquement le CA/commandes/commission dès qu'une
  // vente lui est rattachée — notamment quand c'est un admin qui déclare
  // la commande pour son compte (le commercial ne l'a jamais soumise
  // lui-même, donc rien ne le mettait à jour sans recharger la page).
  // Même event WS "notify"/ORDER_CREATED déjà émis côté serveur pour les
  // admins, désormais aussi envoyé au commercial concerné (orders.js).
  useEffect(() => {
    if (!socket) return;
    function onNotify(data: { type?: string }) {
      if (data?.type !== "ORDER_CREATED") return;
      refresh();
    }
    socket.on("notify", onNotify);
    return () => {
      socket.off("notify", onNotify);
    };
  }, [socket]);

  const loadProducts = useCallback(async () => {
    if (!formOpen) return;
    setProductsLoading(true);
    setProductsErr(null);
    try {
      const pageSize = 100;
      let page = 1;
      let all: Product[] = [];
      let totalExpected = Infinity;
      while (page <= 50) {
        const res = await listProducts({ page, pageSize, onlyActive: true });
        const batch = res.items || [];
        all = all.concat(batch);
        const t = Number(res.pageInfo?.total ?? all.length);
        if (Number.isFinite(t)) totalExpected = t;
        if (all.length >= totalExpected || batch.length === 0) break;
        page += 1;
      }
      setProducts(all);
    } catch (e: unknown) {
      setProductsErr(e instanceof Error ? e.message : "Impossible de charger les produits.");
    } finally {
      setProductsLoading(false);
    }
  }, [formOpen]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const ql = productQuery.trim().toLowerCase();
    if (!ql) return products;
    return products.filter((p) => String(p.name || "").toLowerCase().includes(ql));
  }, [products, productQuery]);

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

      // ✅ On va rechercher la commande fraîchement créée via GET
      // /api/orders/:id — exactement la même route/forme de données que
      // celle utilisée par OrderViewModal côté admin (items, totaux,
      // livraison, contact complets, recalculés serveur) — plutôt que de
      // reconstruire le reçu à la main depuis le formulaire/panier local,
      // qui peut diverger (remise, frais de livraison, etc.). Filet de
      // secours : si ce GET échoue pour une raison quelconque, on retombe
      // sur l'ancienne reconstruction locale pour ne pas priver le
      // commercial du bouton d'envoi.
      try {
        const full = await getOrder(created.id);
        setLastReceiptHref(waHref(full));
        setLastOrder(full as unknown as Record<string, unknown>);
      } catch {
        const fallback = {
          id: created.id,
          display_code: created.display_code,
          status: created.status || "OPEN",
          created_at: new Date().toISOString(),
          contact: {
            first_name: firstName.trim() || undefined,
            last_name: lastName.trim() || undefined,
            phone: phone.trim(),
            city: city.trim(),
          },
          address: { city: city.trim() },
          items: cart.map((l) => ({
            product_id: l.product.id,
            product_name: l.product.name,
            qty: l.qty,
            unit_price: Number(l.product.price),
          })),
        };
        setLastReceiptHref(waHref(fallback));
        setLastOrder(fallback);
      }

      setFormOk("Déclaration enregistrée — rattachée à votre compte.");
      setShowReceipt(false);
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
        <div className="alert alert-success py-2 mb-2">
          <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
            <span>{formOk}</span>
            <div className="d-flex gap-2">
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
              {lastOrder ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={() => setShowReceipt((v) => !v)}
                >
                  {showReceipt ? "Masquer le reçu" : "Voir / partager le reçu"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ✅ Même composant que côté admin (OrderViewModal) — inclut son
          propre bouton "Partager WhatsApp (image)" (Web Share API native,
          image du ticket) en plus du lien texte ci-dessus. */}
      {showReceipt && lastOrder && (
        <div className="mb-4">
          <OrderReceipt order={lastOrder} />
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
            <div className="text-muted small">Commission à recevoir</div>
            <div className="fw-bold fs-4">{moneyMAD(profile?.pending_commission ?? 0, 2)}</div>
          </div>
        </div>
      </div>

      {/* ✅ C'est DUUMINI qui doit cette commission au commercial (un
          pourcentage de ses ventes, comme pour un affilié) — logique
          inverse de celle du livreur, qui lui doit une commission à
          DUUMINI sur les courses encaissées en cash. Ne jamais reprendre
          le wording "vous devez" ici. */}
      {profile && profile.pending_commission > 0 && (
        <div className="alert alert-secondary">
          DUUMINI vous doit <strong>{moneyMAD(profile.pending_commission, 2)}</strong> de
          commission sur vos ventes (taux : {(profile.commission_rate * 100).toFixed(1)}%).
          Versement effectué par l'administration selon vos accords.
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

          <label className="form-label small">Produits</label>
          <input
            className="form-control form-control-sm mb-2"
            placeholder="Filtrer par nom…"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
          />
          {productsErr && <div className="small text-danger mb-2">{productsErr}</div>}
          {productsLoading ? (
            <div className="small text-muted mb-3">Chargement du catalogue…</div>
          ) : (
            <div
              className="mb-3 border rounded"
              style={{ maxHeight: 280, overflowY: "auto" }}
            >
              {filteredProducts.length === 0 ? (
                <div className="small text-muted p-2">Aucun produit trouvé.</div>
              ) : (
                filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="d-flex align-items-center gap-2 p-2 border-bottom"
                  >
                    {p.cover ? (
                      <img
                        src={imgUrl(p.cover)}
                        alt={p.name}
                        style={{
                          width: 40,
                          height: 40,
                          objectFit: "cover",
                          borderRadius: 6,
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 6,
                          background: "var(--bs-secondary-bg, #eee)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div className="flex-grow-1 small">
                      <div className="fw-semibold">{p.name}</div>
                      <div className="text-muted">{moneyMAD(Number(p.price))}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={() => addToCart(p)}
                    >
                      Ajouter
                    </button>
                  </div>
                ))
              )}
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
