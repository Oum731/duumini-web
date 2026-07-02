# 1–4. Vision, objectifs, utilisateurs, rôles & permissions

## 1. Vision globale

Duumini 2.0 n'est pas un site e-commerce de plus : c'est une **infrastructure d'échanges commerciaux B2B2C africaine**, qui connecte en un seul écosystème :

```
Fabricants / Importateurs / Grossistes  →  Distributeurs / Revendeurs  →  Entreprises / Clients finaux
                                     ↘  Duumini Logistique (optionnel)  ↗
```

L'ambition affichée ("l'Alibaba africain") impose trois contraintes de conception non négociables dès le premier jour, même si le lancement ne couvre que la Côte d'Ivoire et le Maroc :

1. **Multi-pays par construction, pas par extension.** Chaque entité qui a une dimension géographique (utilisateur, entreprise, boutique, zone de livraison, devise, taxe) porte un `country_code` (ISO 3166-1 alpha-2) et une `currency_code` (ISO 4217) dès le schéma initial. Ajouter un pays = ajouter une ligne de configuration (devise, zones, taux de commission, méthodes de paiement locales), jamais une migration de schéma. C'est le seul moyen de tenir le point 39 sans dette technique.
2. **Multi-tenant par construction.** Une "entreprise" (module Entreprises) est un tenant logique : ses données (catalogue, commandes, employés, factures) sont scopées par `company_id` partout, même si au lancement une seule entreprise = un seul utilisateur dans 90% des cas. Le SaaS (module 3) ne peut pas être ajouté après coup sans cette base.
3. **Modularité par domaine, pas par couche.** Chaque module (Marketplace, Entreprises, SaaS, Logistique, Financier, Administration) est un ensemble cohérent {données + API + UI}, déployable et testable isolément. C'est la condition pour que "plusieurs développeurs travaillent simultanément" sans se marcher dessus — voir [03-architecture-technique.md](./03-architecture-technique.md) pour la traduction en dossiers/services concrets.

## 2. Objectifs fonctionnels

### Objectifs business (pourquoi)
- Réduire la friction entre offre (fabricants/grossistes africains) et demande (revendeurs, entreprises, particuliers) aujourd'hui fragmentée entre WhatsApp, marchés physiques et import informel.
- Capturer de la valeur à trois niveaux : commission marketplace (par transaction), abonnement SaaS (par entreprise/mois), frais logistiques (si Duumini gère la livraison).
- Devenir la source de vérité commerciale pour les PME africaines qui n'ont aujourd'hui aucun outil de gestion digital (d'où le module SaaS — sans lui, la marketplace seule ne crée pas de rétention).

### Objectifs produit (quoi)
- Un fournisseur peut publier un catalogue B2B (prix par palier de quantité, MOQ — minimum order quantity) en < 10 minutes.
- Un acheteur professionnel peut comparer 3 fournisseurs et demander un devis groupé en < 5 minutes.
- Une entreprise peut gérer stock + commandes + clients + facturation depuis un seul tableau de bord, sans outil tiers.
- Un fournisseur qui ne veut pas gérer la logistique peut confier sa marchandise à Duumini et suivre son stock entreposé en temps réel.
- L'admin Duumini a une vue unique sur tout l'écosystème (utilisateurs, transactions, litiges, paiements) sans accéder à 6 outils différents.

### Objectifs techniques (comment, contrainte du brief)
- Aucune interruption de service pendant la migration (voir [07-plan-migration.md](./07-plan-migration.md)).
- Conserver les comptes, données et URLs existants — un client Duumini 1.0 ne doit rien re-créer.
- API rétrocompatible le temps de la bascule (versionnement, pas de breaking change sec).

## 3. Types d'utilisateurs

| Type (nom métier) | Rôle système actuel | Nouveau ? | Description |
|---|---|---|---|
| **Client final** | `MEMBER` | Existant | Particulier qui achète pour sa consommation. Peut aussi devenir acheteur pour une entreprise (voir "employé d'entreprise" ci-dessous). |
| **Revendeur / Distributeur** | `VENDEUR` | Existant | Achète en gros/demi-gros pour revendre. Aujourd'hui déjà un rôle dans le code, mais sans distinction claire "achète en marketplace" vs "vend sur sa boutique". |
| **Fournisseur (fabricant / importateur / grossiste)** | `FOURNISSEUR` | Existant, sous-utilisé | Rôle déjà présent en base mais peu exploité côté fonctionnalités (pas de catalogue B2B, pas de MOQ, pas de devis). C'est le rôle central à enrichir en priorité pour le module Marketplace B2B. |
| **Restaurant** | `RESTAURANT` | Existant | Cas historique du Duumini Food actuel — traité comme un sous-type de vendeur/fournisseur alimentaire. Conservé tel quel, pas de changement de modèle nécessaire. |
| **Transporteur / Livreur** | `LIVREUR` | Existant | Aujourd'hui livraison locale simple. À étendre pour le module Logistique (statuts d'entrepôt, tournées). |
| **Entreprise (personne morale)** | *Nouveau concept* | **À créer** | Pas un rôle utilisateur mais une entité `companies` à part entière, avec des utilisateurs rattachés ayant chacun un rôle **interne** à l'entreprise (voir permissions ci-dessous). Un `VENDEUR` ou `FOURNISSEUR` peut être rattaché à une entreprise, ou agir en solo (auto-entrepreneur) — les deux cas doivent être supportés. |
| **Administrateur plateforme** | `ADMIN` | Existant | Vue globale, déjà largement implémentée côté frontend (`src/pages/admin/*`). |
| **Administrateur d'entrepôt Duumini** | *Nouveau concept* | **À créer** | Sous-rôle d'ADMIN scopé à un entrepôt (module Logistique), pour ne pas donner un accès admin complet aux opérateurs logistiques. |

**Décision de conception** : ne pas créer un rôle système par "métier" (ex. pas de rôle `FABRICANT` distinct de `FOURNISSEUR`). La distinction fabricant/importateur/grossiste est une **catégorie métier du profil fournisseur** (champ `supplier_type` sur l'entité `companies` ou `shops`), pas un rôle d'accès. Ça évite une explosion combinatoire de rôles et garde le système de permissions simple.

## 4. Rôles et permissions

Le modèle actuel (`Role` global sur l'utilisateur) reste la **permission de premier niveau** (que peux-tu faire sur la plateforme en général). Le module Entreprises ajoute un **second niveau, scopé** (que peux-tu faire dans CETTE entreprise précise). Un même utilisateur peut avoir un rôle plateforme `VENDEUR` et être `ADMIN` interne d'une entreprise, ou `EMPLOYÉ` de deux entreprises différentes avec des droits différents dans chacune.

### Niveau 1 — Rôles plateforme (existant, à conserver)

| Rôle | Accès marketplace | Accès SaaS | Accès admin |
|---|---|---|---|
| `MEMBER` | Achat, favoris, comparaison, messagerie acheteur | — | — |
| `VENDEUR` | Vend + achète, catalogue, commandes reçues | Si rattaché à une entreprise avec abonnement actif | — |
| `FOURNISSEUR` | Catalogue B2B, devis, MOQ, réception commandes | Si rattaché à une entreprise avec abonnement actif | — |
| `RESTAURANT` | Catalogue food, commandes | Optionnel | — |
| `LIVREUR` | Vue commandes à livrer, statuts | — | Vue entrepôt si affecté |
| `ADMIN` | Tout | Tout (support) | Tout |

### Niveau 2 — Rôles internes à une entreprise (nouveau, module Entreprises)

| Rôle interne | Peut | Ne peut pas |
|---|---|---|
| `OWNER` (propriétaire) | Tout dans l'entreprise, y compris facturation SaaS, suppression du compte entreprise, gestion des rôles des autres employés | — |
| `MANAGER` (gestionnaire) | Gérer catalogue, commandes, stock, CRM, employés (sauf OWNER) | Résilier l'abonnement, supprimer l'entreprise |
| `SALES` (commercial) | Créer devis, gérer clients CRM, voir commandes | Modifier catalogue, voir factures fournisseurs, gérer employés |
| `WAREHOUSE` (magasinier) | Gérer stock, réceptions, préparations | Voir CRM, finances |
| `ACCOUNTANT` (comptable) | Facturation, historique paiements, exports comptables | Modifier catalogue, commandes |
| `VIEWER` (lecture seule) | Consulter tableaux de bord et statistiques | Toute modification |

**Règle d'implémentation** : table `company_members(user_id, company_id, internal_role, invited_by, status)` + une matrice de permissions (`permissions.ts` côté frontend, table `role_permissions` ou permissions codées côté backend) consultée à chaque action sensible. Le frontend a déjà un embryon de ce pattern (`src/utils/capabilities.ts`, `src/utils/roles.ts`, `src/utils/frontPermissions.ts`, `src/components/RequireCaps.tsx`) — **à étendre, pas à remplacer**, pour supporter la permission scopée par entreprise en plus de la permission globale par rôle.

### Matrice de permissions — vue synthétique par module

| Module | MEMBER | VENDEUR/FOURNISSEUR (solo) | Employé d'entreprise | ADMIN |
|---|---|---|---|---|
| Marketplace (achat) | ✅ | ✅ | ✅ (selon rôle interne) | ✅ |
| Marketplace (vente/catalogue) | ❌ | ✅ | ✅ (MANAGER+) | ✅ |
| SaaS (stock, CRM, facturation) | ❌ | ✅ (si abonné) | ✅ (selon rôle interne) | ✅ (support) |
| Logistique (choix mode livraison) | ❌ | ✅ | ✅ (MANAGER+) | ✅ |
| Logistique (opérations entrepôt) | ❌ | ❌ | ❌ | ✅ (admin entrepôt) |
| Financier (paiements/abonnement) | ❌ (paie ses achats) | ✅ | ✅ (OWNER/ACCOUNTANT) | ✅ |
| Administration | ❌ | ❌ | ❌ | ✅ |
