# 5–7. Modules, fonctionnalités, parcours utilisateurs

## 5–6. Les 6 modules et leurs fonctionnalités

Pour chaque module : ce qui existe déjà (à conserver/étendre) vs ce qui est nouveau (à construire).

### Module 1 — Marketplace

| Fonctionnalité | État |
|---|---|
| Catalogue produits (B2C) | ✅ Existant (`services/products.ts`, variantes, options, promos) |
| Recherche/filtres/catégories | ✅ Existant (`categories.ts`, `subCategories.ts`) |
| Panier, commande, paiement | ✅ Existant (`Cart.tsx`, `Checkout.tsx`, RIB/GAZHALA/cash) |
| Favoris | ⚠️ Partiel — à vérifier côté backend, pas de service frontend dédié trouvé |
| Catalogue B2B (prix par palier, MOQ) | ❌ **À créer** — extension du modèle `Product` : table `product_price_tiers(product_id, min_qty, unit_price)` |
| Recherche de fournisseurs (annuaire) | ❌ **À créer** — vue "annuaire boutiques" filtrable par `shop_type=SUPPLIER`, pays, catégorie, certifications |
| Demande de devis (RFQ) | ❌ **À créer** — voir modèle de données en [03](./03-architecture-technique.md) |
| Comparaison de produits | ❌ **À créer** — état local (pas de backend nécessaire au MVP, `localStorage` + vue comparateur) |
| Messagerie acheteur↔fournisseur | ❌ **À créer** — probable réutilisation du canal temps réel déjà en place (`services/ws.ts`, `RealtimeContext.tsx`) |

### Module 2 — Entreprises

| Fonctionnalité | État |
|---|---|
| Profil entreprise public | ❌ **À créer** — aujourd'hui le "profil" existant est celui du `Shop` (boutique), pas de la personne morale |
| Employés & rôles internes | ❌ **À créer** — voir [01-vision-produit.md §4](./01-vision-produit.md) |
| Catalogue par entreprise | ⚠️ Partiel — `Shop` existe déjà et pourrait devenir le catalogue de l'entreprise (1 entreprise → N boutiques dans un premier temps, pour ne pas casser le modèle actuel) |
| Tableau de bord entreprise | ⚠️ Partiel — dashboards vendeur/admin existent (`AdminHome.tsx`, `ma-boutique`) mais pas de vue "entreprise" transverse à plusieurs boutiques |
| Statistiques entreprise | ✅ Existant en partie (`reports.ts`, `ReportsSalesPage.tsx`) — à étendre au niveau entreprise plutôt que boutique seule |

### Module 3 — SaaS (outils de gestion)

| Fonctionnalité | État |
|---|---|
| Gestion du stock | ⚠️ Partiel — stock existe au niveau produit/variante, pas de mouvements de stock tracés (entrées/sorties/ajustements) |
| Gestion des commandes | ✅ Existant, robuste (`orders.ts`, `OrdersAdminPage.tsx`, statuts, paiement partiel) |
| CRM | ❌ **À créer** — aucune notion de "client" en dehors d'un compte utilisateur qui commande |
| Facturation | ⚠️ Partiel — reçus de commande existent (`OrderReceiptTicket.tsx`, `PublicReceiptPage.tsx`) mais pas de facture formelle (numérotation légale, TVA/taxes par pays, export PDF comptable) |
| Devis | ❌ **À créer**, lié au RFQ marketplace |
| Statistiques | ✅ Existant (`reports.ts`) — solide base à étendre |
| Gestion des employés | ❌ **À créer**, voir module Entreprises |
| Gestion des clients | ❌ **À créer** (= CRM) |
| Gestion des fournisseurs | ⚠️ Partiel — `supplierOrders.ts`, `supplierProducts.ts` existent déjà côté service, à vérifier l'usage réel dans les pages actuelles |

### Module 4 — Logistique

| Fonctionnalité | État |
|---|---|
| Livraison gérée par le fournisseur | ✅ Existant (mode par défaut actuel — `Checkout.tsx` gère `FulfillmentMode: DELIVERY/PICKUP/EXPEDITION`) |
| Zones de livraison / frais | ✅ Existant (`deliveryZones.ts`) |
| Livraison confiée à Duumini (3PL) | ❌ **À créer** — nouveau statut `fulfillment_by: "SELLER" \| "DUUMINI"` sur la commande/le produit |
| Réception entrepôt | ❌ **À créer** |
| Stockage / inventaire entrepôt | ❌ **À créer** |
| Préparation de commande (picking) | ❌ **À créer** |
| Expédition & suivi | ⚠️ Partiel — suivi de commande existe (statuts), pas de suivi transporteur détaillé (tracking number, étapes) |
| Livraison finale | ✅ Existant (rôle `LIVREUR`) |

### Module 5 — Financier

| Fonctionnalité | État |
|---|---|
| Paiement commande (client) | ✅ Existant (RIB, GAZHALA, cash à la livraison) |
| Commissions marketplace | ✅ Existant pour l'affiliation (`affiliates.ts`, taux de commission, historique) — **pattern directement réutilisable** pour la commission fournisseur↔plateforme |
| Abonnements SaaS | ❌ **À créer** — plans, cycle de facturation, essai gratuit |
| Facturation formelle | ❌ **À créer**, voir module SaaS |
| Portefeuille (wallet) | ❌ **À créer** — solde interne par entreprise/fournisseur (commissions dues, remboursements, crédits) |
| Historique financier | ✅ Partiellement existant côté commandes/affiliation, à unifier dans une vue "portefeuille" par entreprise |

### Module 6 — Administration

| Fonctionnalité | État |
|---|---|
| Utilisateurs | ✅ Existant (`UsersAdminPage.tsx`, `adminUsers.ts`) |
| Entreprises | ❌ **À créer** |
| Catégories/produits | ✅ Existant (`ProductsAdminPage.tsx`, gestion catégories) |
| Commandes | ✅ Existant (`OrdersAdminPage.tsx`) |
| Fournisseurs/vendeurs/transporteurs | ⚠️ Partiel — gestion boutiques existe (`ShopsAdminPage.tsx`), pas de vue dédiée par type d'acteur |
| Entrepôts | ❌ **À créer** |
| Paiements | ⚠️ Partiel (vue commande), pas de vue paiements transverse |
| Abonnements | ❌ **À créer** |
| Statistiques globales | ✅ Existant (`ReportSalesViewPage.tsx`) |
| Signalements (modération) | ❌ **À créer** |
| Contenu (CMS léger) | ⚠️ Partiel — `pageCopy.ts`, `contentAi.ts` suggèrent un embryon de gestion de contenu |

## 7. Parcours utilisateurs (principaux)

### Parcours A — Fournisseur publie un catalogue B2B
1. Inscription / connexion (existant) → rôle `FOURNISSEUR`.
2. Création ou complétion du profil entreprise (nouveau) : nom légal, pays, type (fabricant/importateur/grossiste), certifications.
3. Création de boutique/catalogue (existant, `shop_type=SUPPLIER`).
4. Ajout produit avec paliers de prix + MOQ (nouveau champ sur le formulaire produit existant, `ProductForm.tsx` — extension, pas remplacement).
5. Choix du mode de livraison (nouveau : gestion propre vs confiée à Duumini).
6. Publication → visible dans l'annuaire fournisseurs et le catalogue marketplace.

### Parcours B — Entreprise acheteuse demande un devis
1. Recherche dans l'annuaire fournisseurs (nouveau) ou le catalogue (existant).
2. Ajout au comparateur (nouveau) de 2-3 fournisseurs équivalents.
3. Demande de devis groupée (nouveau, module RFQ) → notifications aux fournisseurs concernés (canal temps réel existant).
4. Réception des offres, négociation via messagerie (nouveau).
5. Acceptation → conversion automatique en commande (réutilise le flux `Checkout`/`orders.ts` existant avec un `order_type: "RFQ"`).

### Parcours C — Entreprise gère son activité au quotidien (SaaS)
1. Connexion → tableau de bord entreprise (nouveau, transverse aux boutiques).
2. Consultation stock (existant au niveau produit, nouveau au niveau mouvements).
3. Traitement des commandes entrantes (existant, `OrdersAdminPage.tsx` généralisé au contexte entreprise).
4. Gestion CRM : suivi client, historique d'achats (nouveau).
5. Émission de facture (nouveau) à partir d'une commande existante.
6. Consultation statistiques (existant, `reports.ts`).

### Parcours D — Fournisseur confie sa logistique à Duumini
1. Choix "Distribution Duumini" sur son profil/produit (nouveau).
2. Dépôt physique en entrepôt → réception scannée par un opérateur (nouveau, module Logistique).
3. Stock visible en temps réel dans le tableau de bord SaaS du fournisseur (nouveau, mais réutilise l'infra temps réel existante `RealtimeContext.tsx`/`ws.ts`).
4. Commande passée par un acheteur → préparation automatiquement assignée à l'entrepôt compétent (nouveau).
5. Expédition + suivi transporteur (extension du système de statuts de commande existant).

### Parcours E — Admin plateforme supervise
1. Connexion admin (existant).
2. Vue globale : nouveaux utilisateurs/entreprises en attente de validation (nouveau workflow de vérification KYB — Know Your Business).
3. Résolution de signalements (nouveau).
4. Supervision paiements/abonnements/commissions (existant pour commandes, nouveau pour SaaS/wallet).

Diagrammes de flux détaillés (BPMN-like) pour ces 5 parcours : voir [05-diagrammes.md §5](./05-diagrammes.md).
