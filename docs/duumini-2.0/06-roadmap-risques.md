# 28–33. Roadmap, MVP, futur, risques

## 28. Roadmap de développement

Découpée en 5 phases, chacune livrable et utile seule (pas de "big bang" — cohérent avec la contrainte de migration progressive).

| Phase | Durée indicative | Contenu |
|---|---|---|
| **Phase 0 — Fondations** | 3–4 semaines | Audit backend réel, mise en place `country_code`/`currency_code` transverses, entité `companies` + `company_members`, extension du système de permissions frontend existant (`capabilities.ts`, `RequireCaps`), design tokens SaaS (§18/04). Aucune fonctionnalité visible côté utilisateur — c'est le socle qui évite de tout refaire ensuite. |
| **Phase 1 — MVP Marketplace B2B** | 6–8 semaines | Profil entreprise, catalogue B2B (paliers de prix + MOQ sur `ProductForm` existant), annuaire fournisseurs, RFQ simple (sans messagerie temps réel — email/notif suffit au MVP), conversion RFQ→commande (réutilise `orders` existant). |
| **Phase 2 — MVP SaaS** | 6–8 semaines | Dashboard entreprise (sidebar layout), gestion employés/rôles internes, mouvements de stock, CRM basique (liste clients + historique commandes), facturation simple (génération PDF depuis une commande). |
| **Phase 3 — Logistique & Financier** | 8–10 semaines | Choix mode de livraison par fournisseur, entrepôts (réception/stock/préparation), abonnements SaaS (plans + facturation récurrente), wallet, généralisation du pattern commission (déjà prouvé par l'affiliation) au marketplace B2B. |
| **Phase 4 — Consolidation & Maroc↔Côte d'Ivoire** | 4–6 semaines | Messagerie temps réel complète, comparateur produits, modération/signalements admin, tests de charge multi-pays, bascule progressive du trafic (voir [07-plan-migration.md](./07-plan-migration.md)). |

## 29. Priorités du MVP

Ce qui DOIT être dans le MVP (Phase 1+2 ci-dessus) pour valider l'hypothèse business, rien de plus :
1. Un fournisseur peut créer une entreprise et publier un catalogue avec prix de gros.
2. Un acheteur professionnel peut trouver ce fournisseur et demander un devis.
3. Le devis accepté devient une vraie commande (flux existant).
4. L'entreprise peut voir ses commandes et son stock dans un tableau de bord dédié.
5. Duumini peut facturer un abonnement SaaS basique (même un seul plan au départ).

Ce qui n'est **PAS** dans le MVP (reporté à Phase 3+) : entrepôts Duumini, wallet, messagerie temps réel riche, comparateur, CRM avancé, facturation multi-taxes complexe. Le risque produit n°1 d'un projet comme celui-ci est de vouloir livrer les 6 modules en même temps — la vision "Alibaba africain" est une **direction à 3 ans**, pas un cahier des charges v1.

## 30. Fonctionnalités futures (post-MVP, hors roadmap ci-dessus)

- Application mobile (React Native, réutilisation des types `services/*.ts` déjà partagés).
- Marketplace de services (transport, assurance marchandise, financement de commande/factoring) via des partenaires tiers intégrés en marque blanche.
- Programme de fidélité/affiliation étendu au B2B (le système d'affiliation existant est déjà un bon socle).
- Financement d'achat (BNPL — buy now pay later) pour les commandes B2B, via partenaire financier.
- Traçabilité produit (utile pour l'agroalimentaire — lots, dates, certification bio/export).
- Marketplace multi-devises avec conversion automatique.

## 31. Améliorations possibles (sur l'existant, indépendamment de la refonte)

- Généraliser `TanStack Query` (déjà en dépendance, sous-exploité) à toutes les pages pour réduire la duplication de logique de fetch/cache actuellement gérée à la main dans chaque page.
- Étendre le système de tests : **aucun test automatisé n'existe actuellement dans le repo frontend** (confirmé lors des refactors précédents) — un projet de cette ampleur, avec plusieurs développeurs simultanés, ne peut pas rester sans tests. Prioriser les tests sur les modules Financier et Commandes (impact direct sur l'argent).
- Poursuivre le découpage des pages volumineuses restantes (`Profile.tsx` a une Phase 2 de découpage JSX identifiée mais non faite ; `Checkout.tsx` a un découpage volontairement limité aux helpers purs pour préserver la logique de paiement).
- Centraliser la couche de permissions (aujourd'hui `capabilities.ts`/`roles.ts`/`frontPermissions.ts` — 3 fichiers avec des responsabilités qui se recoupent probablement, à auditer et fusionner avant d'ajouter la dimension "rôle interne entreprise").

## 32–33. Risques techniques et solutions

| Risque | Impact | Probabilité | Solution proposée |
|---|---|---|---|
| Le backend réel diverge fortement de ce que le frontend laisse supposer (framework, ORM, conventions) | Élevé — fausse toute l'estimation | Moyenne | Auditer le repo backend en tout premier (action n°1 du plan de migration) avant de figer l'architecture cible §9. Ce document pose des hypothèses vérifiables, pas des certitudes. |
| Absence de tests → régressions lors de l'ajout des nouveaux modules | Élevé | Élevée sans action | Introduire des tests (au moins d'intégration API) dès la Phase 0, avant d'ajouter de la complexité métier. |
| Migration multi-pays mal anticipée (devise/taxe codées en dur quelque part) | Élevé — bloque l'expansion | Moyenne | Revue systématique de tout champ montant/devise lors de la Phase 0 (voir §1 [01-vision-produit.md](./01-vision-produit.md)) ; interdiction de merger un nouveau module sans `country_code`/`currency_code` si l'entité en a besoin. |
| Un seul rôle système par utilisateur ne suffit plus une fois le multi-entreprise en place (ex. un `VENDEUR` employé de 2 entreprises avec des droits différents) | Moyen | Élevée (déjà anticipé) | Modèle à deux niveaux déjà posé en [01-vision-produit.md §4](./01-vision-produit.md) — rôle plateforme + rôle interne scopé par entreprise. |
| Charge de développement sous-estimée (39 points du brief = plusieurs mois-hommes) | Élevé — retard, découragement | Élevée si non cadrée | Roadmap en phases livrables indépendamment (§28) — chaque phase doit produire de la valeur mesurable, pas seulement "avancer vers la vision". |
| Duplication de code entre modules (répétition du pattern déjà vu : helpers argent/image dupliqués 13 fois, hero dupliqué sur 3 pages) si plusieurs devs travaillent en parallèle sans convention | Moyen | Élevée sans discipline | Convention de dossier imposée dès Phase 0 (§10/§16), revue de code systématique sur les nouveaux modules avec check "est-ce que ce helper existe déjà ailleurs ?". |
| Paiement multi-pays (méthodes différentes CI/Maroc) codé en dur dans le flux de checkout actuel | Élevé pour l'expansion | Confirmée (le code actuel a RIB/GAZHALA/cash codés en dur, spécifiques au Maroc) | Introduire une abstraction `PaymentProvider` par pays dès la Phase 3, avant d'ajouter un 3e pays — voir [09-expansion-panafricaine.md](./09-expansion-panafricaine.md). |
| Sécurité : accès aux données d'une entreprise par un utilisateur qui n'en fait pas partie (faille multi-tenant) | Critique | Moyenne si non testée | Middleware d'autorisation systématique vérifiant `company_id` sur chaque requête touchant une ressource scopée entreprise — voir [08-bonnes-pratiques.md](./08-bonnes-pratiques.md). |
