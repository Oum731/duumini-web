# 17–22. Design system, couleurs, composants, pages, dashboards, workflows

## 17. Design system — état actuel et direction retenue

Un design system existe déjà et vient d'être unifié (`src/theme.css`) : palette de marque + échelle de rayons/ombres cohérente sur toute la vitrine client. Direction retenue et validée : **"vibrant marché"** — assumer la palette jaune/noir/rouge, badges promo visibles, prix mis en avant, ambiance épicerie/marché africain énergique (par opposition à un style minimaliste type boutique premium).

Pour Duumini 2.0, ce design system devient **le design system du module Marketplace/grand public uniquement**. Le module SaaS (tableaux de bord entreprise) a des besoins différents (densité d'information, tableaux de données, formulaires complexes) et doit avoir sa propre déclinaison — voir §21.

## 18. Couleurs

```css
--duu-yellow: #fddc00;   /* couleur de marque primaire */
--duu-red:    #E53935;   /* accent — alerte, promo, hover, actif */
--duu-black:  #111111;   /* texte, fond sombre */
```

Échelle de rayons et d'ombres (ajoutée récemment, à respecter pour tout nouveau composant) :
```css
--duu-radius-sm: 14px;   /* boutons, inputs, select */
--duu-radius-md: 18px;   /* petites cartes, badges larges */
--duu-radius-lg: 22px;   /* cartes produit, cartes section */
--duu-radius-xl: 26px;   /* hero, grands blocs */

--duu-shadow-sm: 0 6px 16px rgba(17,17,17,.05);
--duu-shadow-md: 0 12px 26px rgba(17,17,17,.07);
--duu-shadow-lg: 0 18px 40px rgba(17,17,17,.08);
```

**Palette SaaS (nouvelle, à créer)** — le module SaaS a besoin d'une palette de statut plus riche que le grand public (marketplace n'a besoin que de "promo"/"rupture") :
```css
--duu-status-success: #1FA971;  /* déjà utilisé côté affiliation, à généraliser */
--duu-status-warning: #FFD54A;  /* variante jaune plus douce pour "en attente" */
--duu-status-danger:  var(--duu-red);
--duu-status-info:    #3B82C4;  /* nouveau — neutre informatif, absent du système actuel */
--duu-surface-1: #FFFDF6;        /* déjà utilisé côté admin (DUU palette locale) */
--duu-surface-2: #FFFFFF;
```

**Recommandation** : fusionner la palette locale `DUU` dupliquée dans `src/pages/admin/affiliates/shared.ts` (déjà extraite du doublon AffiliatesPage/AffiliateDashboardPage lors du refactor précédent) avec `theme.css`, pour que le SaaS et le grand public partagent une seule source de vérité de couleurs, même si les usages diffèrent.

## 19. Composants UI

### Composants grand public existants (à conserver, référence de qualité)
- `ProductCard` — carte produit, badges promo/rupture, variantes.
- `Avatar`, `Modal`, `PasswordField`, `SmartPicker` (extraits du module Profil) — **directement réutilisables** pour tout formulaire du module Entreprises/SaaS (sélection de pays, de rôle, etc. sont des cas d'usage de `SmartPicker`).
- `SectionTitle`, `KpiCard`, `PaginationBar`, `HistoryStat`, `TinyBar` (extraits du module Affiliation admin) — **directement réutilisables** pour tous les tableaux de bord SaaS (stock, CRM, facturation ont tous besoin de KPI cards et de pagination).
- `Navbar`, `Footer`, `FloatingCartButton`, `ScrollTopButton`.

### Composants à créer pour les nouveaux modules

| Composant | Usage |
|---|---|
| `CompanySwitcher` | Changer de contexte entreprise si un utilisateur appartient à plusieururs |
| `RoleBadge` | Afficher le rôle interne d'un employé (réutilise le pattern `statusBadgeClass` déjà en place côté affiliation) |
| `DataTable` | Table générique triable/filtrable/paginée — le SaaS en a besoin partout (stock, CRM, factures, commandes) ; généraliser le pattern déjà vu dans `AffiliatesListTable`/`OrdersAdminPage` plutôt que le dupliquer à chaque module |
| `StatCard` | Variante `KpiCard` avec tendance (▲/▼ %) — nécessaire pour les dashboards SaaS |
| `QuoteBuilder` | Formulaire de construction de devis (RFQ) |
| `ChatThread` / `MessageBubble` | Messagerie B2B |
| `CompareTable` | Comparateur de produits côte à côte |
| `InvoicePreview` | Aperçu facture avant génération PDF |
| `StockLevelBadge` | Indicateur visuel de niveau de stock (bas/normal/rupture) |
| `TrackingTimeline` | Suivi d'expédition étape par étape |
| `PlanPicker` | Sélection de plan d'abonnement SaaS |

Tous ces composants suivent la même règle que l'existant : **props uniquement, pas d'état métier interne**, styles via les tokens `--duu-*`.

## 20. Pages publiques

Existantes (conservées) : Accueil, African Market/Food/Fashion, Fiche produit, Panier, Checkout, Profil (connexion/inscription), Contact, À propos, mentions légales.

Nouvelles pages publiques :
- **Annuaire fournisseurs** (`/fournisseurs`) — liste filtrable par pays/catégorie/type.
- **Profil public entreprise** (`/entreprise/:slug`) — équivalent B2B de la fiche boutique actuelle.
- **Page plans SaaS** (`/tarifs`) — grille de plans d'abonnement, publique (nécessaire avant inscription pour convertir).
- **Page "Comment ça marche" B2B** — pédagogie sur le fonctionnement du RFQ/devis pour un public professionnel qui découvre la plateforme.

## 21. Tableaux de bord

Trois familles de dashboards, avec une identité visuelle commune (mêmes tokens de couleur/rayon) mais une densité d'information différente :

1. **Dashboard grand public** (existant, `AdminHome`-like pour vendeur solo) — peu dense, orienté action rapide.
2. **Dashboard entreprise/SaaS** (nouveau) — dense, orienté données : vue d'ensemble (KPI du jour), stock, commandes, CRM, factures, employés. Navigation par onglets latéraux (pattern à établir, absent aujourd'hui — le back-office actuel utilise une nav horizontale `AdminTopNav` qui ne scalera pas à autant de sections).
3. **Dashboard admin plateforme** (existant, `AdminHome.tsx`) — à étendre avec les nouvelles entités (entreprises, entrepôts, abonnements, signalements) en suivant le pattern déjà établi (`OrdersAdminPage`, `ShopsAdminPage`, `AffiliatesPage`).

**Recommandation UI concrète** : introduire une nouvelle disposition "sidebar + contenu" pour le dashboard SaaS (le pattern top-nav actuel devient vite illisible au-delà de 6-7 sections). C'est un changement de layout, pas de design system — la palette et les composants restent identiques.

## 22. Workflows (UI)

Workflows transverses à concevoir en détail au moment du développement de chaque module, mais dont la structure est fixée ici :

- **Onboarding entreprise** : inscription → choix rôle (fournisseur/vendeur/les deux) → informations légales → (optionnel) vérification KYB → choix plan SaaS (ou essai gratuit) → tableau de bord.
- **Publication produit B2B** : formulaire produit existant (`ProductForm.tsx`) étendu avec un onglet "Prix de gros" (paliers + MOQ) — pas un nouveau formulaire, une extension de l'existant pour ne pas fragmenter l'expérience vendeur.
- **Cycle de vie d'un RFQ** : brouillon → envoyé → offres reçues → négocié (messagerie) → accepté → converti en commande → traité comme une commande normale dès l'acceptation (réutilise 100% du flux `Checkout`/`orders` existant).
- **Cycle de vie d'une commande logistique Duumini** : commande créée → assignée à un entrepôt → réceptionnée (si pas déjà en stock) → préparée → expédiée → livrée. Chaque étape déclenche une notification temps réel (réutilise `RealtimeContext`).

Diagrammes de séquence détaillés pour ces workflows : [05-diagrammes.md §2](./05-diagrammes.md).
