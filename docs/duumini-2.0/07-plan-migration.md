# 34. Plan de migration — Duumini 1.0 → 2.0 sans interruption de service

Principe directeur : **on n'arrête jamais le site actuel**. Chaque étape est un ajout ou une extension additive, jamais un remplacement en place tant que le nouveau chemin n'est pas validé en production.

## Étape 0 — Audit (préalable obligatoire, avant toute ligne de code)

1. **Auditer le repo backend réel** (langage, framework, ORM, structure de dossiers, tests existants). Ce document (§9 de [03-architecture-technique.md](./03-architecture-technique.md)) a déduit le contrat API depuis le frontend — c'est une hypothèse de travail, pas un audit. Sans cet audit, toute estimation de charge sur le backend est non fiable.
2. **Auditer le schéma de base de données réel** (tables, colonnes, contraintes, volumétrie actuelle) pour confirmer/ajuster le modèle proposé en [03-architecture-technique.md §11](./03-architecture-technique.md).
3. **Geler la liste des endpoints actuellement appelés par le frontend** — déjà largement disponible en lisant `src/services/*.ts` (33 fichiers) — pour définir précisément le contrat "v1" à ne jamais casser.

## Étape 1 — Frontend : préparer le terrain sans rien casser

Ce repo (`duumini-web`) a déjà commencé cette étape sans le savoir, via les refactors récents :
- Le pattern de dossier par domaine (`types/helpers/hooks/components`) est validé sur 3 modules (Profil, Checkout, Affiliation admin) — **c'est le pattern à répliquer**, pas à réinventer, pour `companies/`, `saas/`, `marketplace-b2b/`, `logistics/`, `finance/`.
- Le design system est unifié (tokens `--duu-radius-*`/`--duu-shadow-*`) — les nouveaux modules l'utilisent dès leur création, pas de dette de style à rattraper plus tard.
- Les helpers argent/image (`utils/money.ts`, `utils/media.ts`) sont centralisés — tout nouveau module les importe, ne les redéfinit jamais.

Actions concrètes de cette étape :
1. Créer les dossiers `src/pages/companies/`, `src/pages/saas/`, etc. vides avec juste un `types.ts` posant les types prévus en [03-architecture-technique.md §11](./03-architecture-technique.md), pour que plusieurs développeurs puissent commencer en parallèle sans se marcher dessus.
2. Étendre `src/context/` avec un `CompanyContext` (sur le modèle de `LocationContext`/`AuthContext` existants) qui portera le `company_id` actif — sans backend derrière au début (mock), pour que le frontend des nouveaux modules puisse être développé avant que le backend soit prêt.
3. Étendre `src/utils/capabilities.ts`/`roles.ts` pour le rôle interne entreprise (voir [01-vision-produit.md §4](./01-vision-produit.md)) — additif, ne modifie pas la logique de rôle plateforme existante.

## Étape 2 — Backend : coexistence v1/v2

1. **Versionner l'API** : tout nouvel endpoint (companies, RFQ, inventory, etc.) sous `/api/v2/*`. Les endpoints existants (`/api/products`, `/api/orders`, etc.) **restent inchangés et fonctionnels** — le frontend actuel continue de les appeler sans modification.
2. **Ne jamais modifier une table existante de façon destructive.** Toute évolution de schéma (ex. ajouter `country_code` à `shops`) se fait par migration additive (`ALTER TABLE ... ADD COLUMN ... DEFAULT ...`), jamais par renommage/suppression tant que l'ancien code y accède.
3. **Nouvelles tables pour les nouveaux concepts** (`companies`, `rfq_requests`, etc.) — aucun risque sur l'existant puisqu'aucune table actuelle n'est touchée.
4. **Lier progressivement l'existant au nouveau modèle** : une fois `companies` en place, migrer les `shops` existantes vers une entreprise "auto-générée" (1 shop = 1 entreprise par défaut, `company.legal_name = shop.name`) via un script de backfill, **exécuté sans verrou bloquant** (par lots, avec reprise sur erreur). Le code applicatif doit fonctionner que `shop.company_id` soit rempli ou `NULL` pendant toute la durée du backfill (feature-flaggé).

## Étape 3 — Bascule progressive par fonctionnalité (feature flags)

Chaque nouvelle fonctionnalité est livrée derrière un flag (variable d'environnement ou table `feature_flags`), activée :
1. D'abord en interne (équipe Duumini) uniquement.
2. Puis pour un petit groupe de fournisseurs pilotes volontaires (recruter 3–5 fournisseurs réels en Côte d'Ivoire et au Maroc).
3. Puis à 100% des utilisateurs `FOURNISSEUR`/`VENDEUR`, une fois les retours pilotes traités.

Le grand public (`MEMBER`, achat simple) ne voit **aucun changement** tant que le module Marketplace B2B n'est pas jugé stable — c'est la garantie de "zéro interruption de service" pour l'essentiel du trafic actuel.

## Étape 4 — Migration des données sensibles (paiement, comptes)

- **Comptes utilisateurs** : aucune migration nécessaire, le modèle `User`/`Role` est conservé tel quel et étendu (pas remplacé).
- **Historique de commandes** : conservé tel quel, les nouvelles commandes (RFQ, logistique Duumini) utilisent les mêmes tables `orders`/`order_items` avec des champs additionnels (`order_type`, `fulfillment_by`), pas un nouveau système de commande parallèle.
- **Paiements en cours** : aucune donnée financière n'est déplacée ; le module Financier (wallet, abonnements) est un système additif qui ne touche pas aux paiements de commande existants (RIB/GAZHALA/cash).

## Étape 5 — Dépréciation (seulement quand tout est validé)

Une fois `/api/v2/*` stable et le frontend 100% migré dessus pour les nouveaux modules :
- `/api/v1` (implicite, endpoints actuels) reste en service **au minimum 6 mois** après bascule complète, avec monitoring des appels résiduels.
- Aucune suppression de code v1 tant que le trafic dessus n'est pas nul pendant 30 jours consécutifs.

## Checklist de non-régression avant chaque mise en production

- [ ] Les pages grand public actuelles (Accueil, listing, fiche produit, panier, checkout, profil) passent tous les scénarios manuels déjà utilisés lors des vérifications précédentes (connexion/inscription, ajout panier, calcul frais de livraison, changement mode de paiement).
- [ ] `npx tsc -b` et `npx eslint` propres (déjà la norme établie sur ce repo).
- [ ] Aucune table existante modifiée de façon destructive dans la migration SQL du jour.
- [ ] Le endpoint `/api/v1/...` concerné répond toujours identique à avant (test de contrat).
- [ ] Rollback documenté pour chaque déploiement (flag désactivable en un clic, migration réversible).
