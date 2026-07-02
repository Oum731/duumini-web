# 39. Recommandations pour l'expansion panafricaine

## Ce qui doit être vrai dès le lancement CI/Maroc pour que l'expansion soit "juste de la configuration"

1. **Aucune valeur géographique/monétaire codée en dur dans le code métier.** Aujourd'hui, `Checkout.tsx` a des constantes `DELIVERY_RULES` (25 MAD pour Casablanca) et des moyens de paiement (RIB, GAZHALA) spécifiques au Maroc, en dur dans le composant. C'est acceptable pour 2 pays traités comme deux configurations distinctes, mais **dès le 3ᵉ pays**, ces règles doivent devenir des données (table `country_config` : devise, méthodes de paiement disponibles, règles de frais de livraison par défaut) plutôt que du code dupliqué par pays.
2. **`country_code` (ISO 3166-1 alpha-2) sur toute entité qui en a besoin**, posé dès la Phase 0 (voir [06-roadmap-risques.md](./06-roadmap-risques.md)) — jamais ajouté en urgence au moment d'ouvrir un 3ᵉ pays.
3. **Abstraction `PaymentProvider`** (voir [03-architecture-technique.md §15](./03-architecture-technique.md)) : un fournisseur de paiement par pays (mobile money en Côte d'Ivoire, ex. Orange Money/MTN Money ; virement bancaire/cash au Maroc), le code métier ne connaît que l'interface commune (`initiate()`, `confirm()`, `refund()`).
4. **Traduction/i18n** : le contenu actuel est en français uniquement, adapté à CI/Maroc. Une extension vers l'Afrique anglophone (Nigeria, Ghana, Kenya) ou lusophone nécessitera un système d'i18n structuré (clés de traduction, pas de texte en dur dans le JSX) — à anticiper dans la structure des nouveaux composants même si une seule langue est active au lancement.

## Séquence d'ouverture d'un nouveau pays (une fois l'architecture prête)

1. Ajouter la ligne `country_config` (devise, langue par défaut, méthodes de paiement, taux de commission par défaut).
2. Configurer les zones de livraison de base (réutilise `deliveryZones.ts` existant, déjà pensé par ville).
3. Recruter les premiers fournisseurs/vendeurs pilotes localement (processus produit, pas technique).
4. Activer le pays derrière un feature flag, ouvert progressivement (même logique que la bascule de fonctionnalité en [07-plan-migration.md](./07-plan-migration.md)).

## Ordre d'expansion recommandé (au-delà de CI/Maroc)

Prioriser les marchés par proximité logistique/culturelle et taille de marché B2B informel existant, plutôt que par simple taille de population :
1. **Sénégal** — proximité culturelle/linguistique avec la Côte d'Ivoire, écosystème de paiement mobile mature.
2. **Cameroun** — hub logistique Afrique centrale.
3. **Maroc → Tunisie/Algérie** — extension naturelle Maghreb, langue/devises proches à adapter.
4. **Nigeria/Ghana** (anglophones) — plus grand marché potentiel mais nécessite l'i18n anglais posée en amont (voir point 4 ci-dessus) et une refonte du module Financier pour les moyens de paiement locaux dominants.

## Ce qu'il ne faut surtout pas faire

- Ne pas dupliquer le code frontend par pays (ex. `CheckoutCI.tsx` / `CheckoutMA.tsx`) — c'est exactement le pattern de duplication déjà identifié et corrigé plusieurs fois dans ce repo (helpers argent/image, styles hero) ; l'expansion pays doit passer par de la configuration/données, jamais par de la duplication de composants.
- Ne pas attendre l'ouverture d'un 3ᵉ pays pour découvrir qu'une règle métier est codée en dur — le test de non-régression de la Phase 0 doit inclure un scénario "pays fictif de test" pour vérifier que rien ne suppose implicitement CI ou Maroc.
