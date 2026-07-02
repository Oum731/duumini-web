# Duumini 2.0 — Documentation de conception

Ce dossier est la base documentaire officielle pour transformer Duumini (site e-commerce actuel) en plateforme B2B/B2C panafricaine modulaire (marketplace + SaaS + logistique), **sans réécriture complète**.

## Principe directeur

L'existant (repo `duumini-web` + API backend séparée) n'est pas jeté. Il est **audité, cartographié, puis étendu par modules**. Chaque document ci-dessous s'appuie, quand c'est pertinent, sur l'état réel du code actuel (rôles déjà présents, services déjà en place, système de design déjà unifié) plutôt que de repartir d'une feuille blanche théorique — c'est la seule façon de tenir la contrainte "pas de réécriture, migration progressive".

## Sommaire

| Doc | Contenu | Points du brief couverts |
|---|---|---|
| [01-vision-produit.md](./01-vision-produit.md) | Vision, objectifs fonctionnels, types d'utilisateurs, rôles & permissions | 1–4 |
| [02-modules-fonctionnels.md](./02-modules-fonctionnels.md) | Les 6 modules, leurs fonctionnalités, parcours utilisateurs | 5–7 |
| [03-architecture-technique.md](./03-architecture-technique.md) | Archi technique, backend, frontend, base de données, APIs, services internes, microservices, technos, structure de dossiers | 8–16 |
| [04-design-system.md](./04-design-system.md) | Design system, couleurs, composants UI, pages publiques, dashboards, workflows | 17–22 |
| [05-diagrammes.md](./05-diagrammes.md) | UML, séquence, base de données, architecture, flux utilisateurs (Mermaid) | 23–27 |
| [06-roadmap-risques.md](./06-roadmap-risques.md) | Roadmap, priorités MVP, fonctionnalités futures, améliorations, risques & solutions | 28–33 |
| [07-plan-migration.md](./07-plan-migration.md) | Plan de migration détaillé depuis le code actuel, sans interruption de service | 34 |
| [08-bonnes-pratiques.md](./08-bonnes-pratiques.md) | Sécurité, performance, SEO, accessibilité | 35–38 |
| [09-expansion-panafricaine.md](./09-expansion-panafricaine.md) | Recommandations pour l'expansion à toute l'Afrique | 39 |

## Ce que j'ai vérifié dans le code actuel avant d'écrire ces documents

- **Rôles déjà existants** (`src/services/auth.ts`) : `MEMBER | VENDEUR | FOURNISSEUR | RESTAURANT | LIVREUR | ADMIN`. Le modèle B2B (fournisseur ≠ vendeur ≠ livreur) est **déjà dans la base de données actuelle**, pas à inventer.
- **Boutiques typées** (`src/services/shops.ts`) : `Shop.shop_type: "VENDOR" | "SUPPLIER" | "RESTAURANT"`, avec `country` déjà en champ — la distinction fournisseur/vendeur et le multi-pays sont partiellement amorcés.
- **Domaines déjà couverts côté frontend** : produits (avec variantes, options), commandes, paiement (RIB/GAZHALA/cash), livraison (zones, frais par ville), affiliation (tracking, commissions, historique de revenus), dépenses (`expenses.ts`, `expenseCategories.ts`), rapports (`reports.ts`), IA (`aiAgent.ts`, `aiAds.ts`, `contentAi.ts`), notifications push, temps réel (websocket).
- **Ce qui manque et doit être construit** : multi-entreprise (comptes d'entreprise avec employés/rôles internes), devis/RFQ, messagerie B2B, comparateur de produits, CRM, facturation formelle, abonnements SaaS, gestion d'entrepôts/3PL, portefeuille/wallet.
- **Frontend** : React 19 + TypeScript + Vite + Bootstrap 5, découpé récemment en modules par domaine (`src/pages/admin/affiliates/`, `src/pages/profile/`, `src/pages/checkout/`, `src/utils/`) — le pattern d'organisation "page + types + helpers + hooks + components/sections" déjà en place sur ces 3 domaines est le pattern à répliquer pour les nouveaux modules.
- **Backend** : hébergé séparément (`duumini-api.onrender.com`), non présent dans ce repo — son organisation interne (langage, ORM, structure) n'a pas pu être auditée depuis ce workspace. Le doc [03](./03-architecture-technique.md) et [07](./07-plan-migration.md) le signalent explicitement et proposent une méthode d'audit avant toute décision définitive sur son évolution.

## Comment lire ces documents

Ils sont écrits pour trois lectorats différents à la fois :
- **Toi (décideur produit)** : sections Vision, Modules, Roadmap, Risques.
- **L'équipe technique** : sections Architecture, Base de données, APIs, Structure de dossiers, Diagrammes.
- **Toute nouvelle recrue** : Design system + Bonnes pratiques, pour onboarder vite sans casser les conventions déjà posées.
