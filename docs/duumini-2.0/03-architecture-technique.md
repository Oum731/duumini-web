# 8–16. Architecture technique

## 8. Architecture technique globale

Architecture cible : **frontend modulaire unique + backend API modulaire (monolithe modulaire, pas microservices dès le lancement)**, avec extraction en services séparés uniquement pour les modules qui le justifient (voir §14).

Justification du choix "monolithe modulaire" plutôt que microservices dès le départ : l'équipe est petite, le backend actuel est déjà un monolithe fonctionnel, et une bascule en microservices day-1 multiplierait la complexité opérationnelle (déploiement, observabilité, cohérence des données) sans bénéfice avant d'avoir une charge qui le justifie. C'est l'erreur la plus fréquente des refontes "façon Alibaba" prématurées. Le découpage en **domaines internes clairs** (décrit ci-dessous) permet d'extraire un module en microservice plus tard sans réécrire — c'est la stratégie "modular monolith first".

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                                │
│   Web (React/Vite)   │   Mobile (futur, React Native)         │
└───────────────┬───────────────────────┬──────────────────────┘
                │ HTTPS (REST + JSON)    │ WebSocket (Socket.IO)
┌───────────────▼───────────────────────▼──────────────────────┐
│                    API GATEWAY / BACKEND                       │
│  Auth · Marketplace · Companies · SaaS · Logistics · Finance   │
│  · Admin — domaines internes, base de code unique              │
├─────────────────────────────────────────────────────────────┤
│  Base de données relationnelle (PostgreSQL recommandé)         │
│  + Cache (Redis) + File storage (S3-compatible)                │
├─────────────────────────────────────────────────────────────┤
│  Services externes : paiement, SMS/OTP, email, IA (déjà         │
│  intégré : aiAgent/aiAds/contentAi), notifications push         │
└─────────────────────────────────────────────────────────────┘
```

## 9. Architecture backend

**État actuel** : le backend vit dans un repo séparé (`duumini-api.onrender.com`), non présent dans ce workspace. Cette documentation ne peut donc pas auditer son code réel — elle déduit son contour des endpoints et formes de données consommés par le frontend (`src/services/*.ts`), et pose des recommandations sous réserve de confirmation après audit du repo backend (voir action n°1 du [plan de migration](./07-plan-migration.md)).

**Ce qu'on sait avec certitude du contrat actuel** (déduit du frontend) :
- API REST, réponses JSON, pagination `{ items, pageInfo: { page, pageSize, total } }`.
- Auth par token (probable JWT), refresh géré côté client (`auth.ts` a un `refresh`).
- Upload de fichiers en `multipart/form-data` (`uploads.ts`, formulaires produit avec `images[]`).
- Temps réel via Socket.IO, authentifié par le même token que le REST.
- Découpage déjà proche d'un modèle par domaine côté endpoints : `/api/products`, `/api/orders`, `/api/shops`, `/api/locations/*`, `/api/affiliates` (probable), etc.

**Organisation cible du backend** (à adapter à la stack réelle une fois auditée — voir §15 pour le choix de langage) :

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/              # inscription, connexion, OTP, tokens
│   │   ├── users/              # profils, adresses
│   │   ├── companies/          # NOUVEAU — entreprises, employés, rôles internes
│   │   ├── marketplace/
│   │   │   ├── products/       # existant, à étendre (paliers de prix, MOQ)
│   │   │   ├── categories/
│   │   │   ├── orders/
│   │   │   ├── rfq/            # NOUVEAU — demandes de devis
│   │   │   └── messaging/      # NOUVEAU
│   │   ├── saas/
│   │   │   ├── inventory/      # NOUVEAU — mouvements de stock
│   │   │   ├── crm/            # NOUVEAU
│   │   │   ├── invoicing/      # NOUVEAU — factures formelles
│   │   │   └── reports/        # existant (reports.ts côté front)
│   │   ├── logistics/
│   │   │   ├── delivery-zones/ # existant
│   │   │   ├── warehouses/     # NOUVEAU
│   │   │   └── shipments/      # NOUVEAU — suivi transporteur détaillé
│   │   ├── finance/
│   │   │   ├── payments/       # existant
│   │   │   ├── commissions/    # existant (pattern affiliation à généraliser)
│   │   │   ├── subscriptions/  # NOUVEAU
│   │   │   └── wallet/         # NOUVEAU
│   │   └── admin/              # existant, transverse
│   ├── shared/                 # utils, middlewares, validation, erreurs
│   ├── infra/                  # DB, cache, file storage, queue
│   └── realtime/               # gateway Socket.IO
├── migrations/
└── tests/
```

Chaque module expose ses propres routes, contrôleurs, services et accès données — **aucun module n'accède directement à la table d'un autre module**, il passe par le service public de ce module. C'est la règle qui permet l'extraction future en microservice sans réécriture (voir §14).

## 10. Architecture frontend

Le frontend actuel (React 19 + TypeScript + Vite) applique déjà, sur 3 domaines refaits récemment (`admin/affiliates`, `profile`, `checkout`), le pattern à généraliser à tous les nouveaux modules :

```
src/pages/<domaine>/
├── <Domaine>Page.tsx        # composant page, orchestration (state, effets, data-fetching)
├── types.ts                  # types locaux au domaine
├── shared.ts | helpers.ts    # fonctions pures, constantes
├── hooks/                     # hooks réutilisables au domaine
├── components/ | sections/    # sous-composants présentation (props uniquement, pas d'état métier)
```

Ce pattern (déjà validé sur ~6000 lignes réparties en composants de moins de 400 lignes chacun) est la référence pour les nouveaux modules Entreprises, SaaS, Logistique. Il permet à plusieurs développeurs de travailler sur des sous-dossiers différents du même module sans conflits de merge constants.

**Nouveaux domaines frontend à créer**, suivant ce pattern :
```
src/pages/companies/        # profil entreprise, employés, rôles
src/pages/saas/
  ├── inventory/
  ├── crm/
  ├── invoicing/
  └── quotes/
src/pages/marketplace-b2b/
  ├── supplier-directory/     # annuaire fournisseurs
  ├── rfq/                    # devis
  ├── compare/                # comparateur
  └── messaging/
src/pages/logistics/
  ├── warehouse/
  └── shipments/
src/pages/finance/
  ├── subscriptions/
  └── wallet/
```

**Composants transverses** (design system) restent dans `src/components/` — voir [04-design-system.md](./04-design-system.md).

## 11. Organisation de la base de données

Moteur recommandé : **PostgreSQL** (voir justification §15). Schéma organisé par domaine, avec `country_code` et `company_id` comme colonnes transverses dès que pertinent (voir principe du §1 dans [01-vision-produit.md](./01-vision-produit.md)).

Entités existantes (déduites du frontend, à confirmer côté backend) : `users`, `shops` (avec `shop_type`, `country`), `products`, `product_variants`, `product_options`, `orders`, `order_items`, `categories`, `sub_categories`, `delivery_zones`, `affiliates`, `affiliate_commissions`, `expenses`, `expense_categories`.

Nouvelles entités par module :

| Module | Nouvelles tables (schéma simplifié) |
|---|---|
| Entreprises | `companies(id, legal_name, country_code, supplier_type, kyb_status, ...)`, `company_members(user_id, company_id, internal_role, status)` |
| Marketplace B2B | `product_price_tiers(product_id, min_qty, unit_price)`, `rfq_requests(id, buyer_company_id, product_id_or_desc, quantity, status)`, `rfq_offers(rfq_id, supplier_company_id, unit_price, lead_time_days)`, `conversations(id, participant_ids[])`, `messages(conversation_id, sender_id, body, created_at)` |
| SaaS | `stock_movements(product_id, warehouse_id, type, quantity, reason, created_by)`, `crm_customers(company_id, name, contact, notes)`, `invoices(id, company_id, order_id, number, tax_amount, status)` |
| Logistique | `warehouses(id, country_code, address, capacity)`, `warehouse_stock(warehouse_id, product_id, quantity)`, `shipments(order_id, carrier, tracking_number, status_history)` |
| Financier | `subscription_plans(id, name, price, billing_cycle, features_json)`, `company_subscriptions(company_id, plan_id, status, current_period_end)`, `wallets(company_id, balance, currency_code)`, `wallet_transactions(wallet_id, type, amount, reference)` |
| Administration | `reports(id, type, target_id, reporter_id, status)`, `content_pages(slug, country_code, body)` |

Voir le diagramme entité-relation complet en [05-diagrammes.md §3](./05-diagrammes.md).

## 12. APIs nécessaires

Convention : REST, ressources pluriel, versionnée dès la refonte (`/api/v2/...`) pour ne jamais casser les clients existants sur `/api/...` (voir [07-plan-migration.md](./07-plan-migration.md) pour la stratégie de coexistence v1/v2).

Nouveaux groupes d'endpoints (au-delà de l'existant conservé tel quel) :

```
/api/v2/companies                      GET/POST
/api/v2/companies/:id                  GET/PATCH/DELETE
/api/v2/companies/:id/members          GET/POST
/api/v2/companies/:id/members/:userId  PATCH/DELETE

/api/v2/rfq                            GET/POST
/api/v2/rfq/:id/offers                 GET/POST
/api/v2/rfq/:id/offers/:offerId/accept POST

/api/v2/conversations                  GET/POST
/api/v2/conversations/:id/messages     GET/POST

/api/v2/inventory/movements            GET/POST
/api/v2/crm/customers                  GET/POST/PATCH

/api/v2/invoices                       GET/POST
/api/v2/invoices/:id/pdf               GET

/api/v2/warehouses                     GET/POST (admin)
/api/v2/warehouses/:id/stock           GET
/api/v2/shipments/:orderId             GET/PATCH

/api/v2/subscriptions/plans            GET
/api/v2/subscriptions                  GET/POST (par entreprise)
/api/v2/wallet                         GET (solde + historique)

/api/v2/admin/reports                  GET/PATCH (modération)
```

## 13. Services internes

Services transverses partagés par tous les modules (backend) :
- **Auth service** : émission/validation de tokens, OTP (existant, `otp.ts`).
- **Notification service** : push (existant, `push.ts`, `devices.ts`), email, SMS — orchestrateur unique appelé par tous les modules plutôt que chaque module qui envoie ses propres notifications.
- **File storage service** : upload/redimensionnement images (existant, `uploads.ts`).
- **Search/Geo service** : localisation, zones (existant, `geo.ts`, `locations.ts`) — à étendre pour la recherche fournisseurs multi-pays.
- **IA service** : déjà présent (`aiAgent.ts`, `aiAds.ts`, `contentAi.ts`) — candidat naturel à une extraction en service séparé vu sa charge de calcul différente (voir §14).
- **Realtime gateway** : Socket.IO existant (`ws.ts`), à généraliser pour la messagerie B2B et le suivi logistique temps réel.

## 14. Microservices éventuels

Ne pas microservicer dès le lancement (voir §8). Candidats à l'extraction **plus tard**, par ordre de priorité, uniquement si la charge ou l'équipe le justifie :

1. **Service IA** (`aiAgent`, `aiAds`, `contentAi`) — charge de calcul et dépendances (modèles, quotas) très différentes du reste ; déjà quasi isolé côté frontend.
2. **Service Notifications** — volumétrie élevée, latence tolérante, bénéficie d'une file d'attente dédiée (queue) indépendamment du reste.
3. **Service Recherche/Catalogue** — si le catalogue grossit fortement (multi-pays, multi-fournisseurs), un moteur de recherche dédié (ex. Meilisearch/Elasticsearch) devient pertinent, alimenté en événements par le monolithe.
4. **Service Paiement/Wallet** — isolation par exigence de sécurité/conformité (PCI-like), pas forcément par charge.

Le module Logistique (entrepôts) reste dans le monolithe tant que Duumini n'opère pas ses propres entrepôts dans plusieurs pays simultanément avec des contraintes d'intégration transporteur tierces lourdes.

## 15. Technologies recommandées

| Couche | Choix recommandé | Justification |
|---|---|---|
| Frontend web | **React 19 + TypeScript + Vite** (conservé) | Déjà en place, équipe déjà formée, aucune raison de changer — la contrainte "pas de réécriture" s'applique en premier lieu ici. |
| UI | **Bootstrap 5 + design tokens CSS custom** (conservé) | Système de tokens (rayons/ombres) unifié récemment sur toute la vitrine — base saine à étendre, pas à jeter pour un design system JS (type MUI) qui imposerait une réécriture massive des pages existantes. |
| State/data fetching | **TanStack Query** (déjà en dépendance, sous-utilisé) | À généraliser pour tous les nouveaux modules — remplace le pattern actuel de state local + fetch manuel par un cache normalisé, essentiel pour un SaaS avec beaucoup de vues de données. |
| Backend | À confirmer après audit — si Node.js déjà en place (probable, cohérent avec Socket.IO/JWT), **rester sur Node.js + TypeScript** (NestJS recommandé pour la structure modulaire par domaine si migration de framework jugée utile) | Cohérence de langage avec le frontend = mutualisation des types (voir `services/types.ts` déjà partagé en esprit), équipe unique full-stack TS possible. |
| Base de données | **PostgreSQL** | Support natif JSON (utile pour `features_json` des plans SaaS), contraintes fortes (indispensable pour la cohérence financière multi-tenant), écosystème mature pour le multi-tenant par `company_id`. |
| Cache | **Redis** | Sessions, rate-limiting, cache de recherche, files d'attente légères (notifications). |
| Stockage fichiers | **S3-compatible** (AWS S3, ou alternative africaine/moins chère type Backblaze B2, Wasabi) | Images produits, factures PDF, documents KYB. |
| Temps réel | **Socket.IO** (conservé) | Déjà en place et fonctionnel. |
| Paiement | **Agrégateurs locaux par pays** (ex. mobile money CI, paiement bancaire Maroc) via une couche d'abstraction interne `PaymentProvider` | Nécessaire dès le multi-pays — jamais coupler le code métier à un fournisseur de paiement précis. |
| CI/CD | **GitHub Actions** | Gratuit pour la taille actuelle, intégration naturelle avec le repo GitHub existant. |
| Hébergement | Conserver le fournisseur actuel (Render) tant que la charge le permet ; prévoir une bascule vers un cloud avec régions africaines/proches (ex. AWS `eu-west` ou `af-south-1`) quand la latence Afrique devient un enjeu mesuré. |

## 16. Structure complète des dossiers (frontend, cible)

```
duumini-web/
├── docs/
│   └── duumini-2.0/            # ce dossier
├── src/
│   ├── components/              # composants transverses (design system + widgets partagés)
│   ├── context/                 # Auth, Location, Realtime (existant), + Company (nouveau)
│   ├── hooks/                    # hooks transverses
│   ├── lib/                      # intégrations tierces (analytics, meta pixel, brand)
│   ├── services/                  # clients API par domaine (existant, étendu)
│   ├── store/                     # état global léger (cart existant)
│   ├── utils/                     # utilitaires purs transverses (money, media, roles, capabilities)
│   ├── pages/
│   │   ├── admin/                 # existant
│   │   ├── profile/                # existant (pattern de référence)
│   │   ├── checkout/                # existant (pattern de référence)
│   │   ├── products/                 # existant
│   │   ├── companies/                # NOUVEAU
│   │   ├── saas/                      # NOUVEAU
│   │   ├── marketplace-b2b/            # NOUVEAU
│   │   ├── logistics/                   # NOUVEAU
│   │   └── finance/                      # NOUVEAU
│   └── App.tsx / main.tsx
└── ...config (vite, eslint, tsconfig)
```

Règle de gouvernance : tout nouveau module dépassant ~400 lignes dans un seul fichier de page doit être découpé selon le pattern `types/helpers/hooks/components` dès sa création — pas après, pour éviter de reproduire la dette qui a nécessité le refactoring d'AffiliatesPage/Profile/Checkout.
