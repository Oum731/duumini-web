# 35–38. Bonnes pratiques : sécurité, performance, SEO, accessibilité

## 35. Sécurité

**Multi-tenant (priorité n°1 pour cette refonte)** :
- Toute requête touchant une ressource scopée `company_id` doit passer par un middleware d'autorisation qui vérifie que l'utilisateur authentifié est bien `company_member` de cette entreprise, avec le rôle interne suffisant. Ne jamais faire confiance à un `company_id` envoyé par le client sans le croiser avec la session.
- Tester explicitement (tests automatisés, pas seulement manuels) : "l'employé de l'entreprise A ne peut pas lire/modifier les données de l'entreprise B" — c'est le bug de sécurité le plus probable et le plus grave d'un SaaS multi-tenant.

**Général (à conserver/renforcer)** :
- Ne jamais committer de secrets — déjà mis en place sur ce repo (`.env` retiré du suivi git, `.env.example` ajouté lors d'un nettoyage précédent). Étendre cette discipline au repo backend si l'audit y révèle des secrets commités.
- Validation des entrées côté serveur systématique (ne jamais faire confiance à la validation frontend seule) — en particulier pour tout ce qui touche au module Financier (montants, devises).
- Authentification : conserver le système token/refresh existant, ajouter une révocation de session possible (utile pour "déconnecter tous les employés" en cas de compromission de compte entreprise).
- Permissions : voir modèle à deux niveaux [01-vision-produit.md §4](./01-vision-produit.md) — chaque nouvelle route backend documente explicitement quel(s) rôle(s)/niveau elle exige.
- Upload de fichiers (documents KYB, factures) : valider le type MIME réel (pas juste l'extension), limiter la taille, scanner si possible — surface d'attaque nouvelle par rapport à l'existant (qui n'uploade que des images produit).
- Paiement : ne jamais stocker de données de carte bancaire en clair côté Duumini — passer systématiquement par les agrégateurs de paiement locaux (tokenisation côté fournisseur).
- Rate limiting sur les endpoints sensibles (OTP, login, création de RFQ en masse) pour éviter l'abus.

## 36. Performance

- **Généraliser TanStack Query** (déjà en dépendance) pour éviter les appels API redondants entre les vues d'un même module SaaS (ex. la liste de commandes et le dashboard qui affichent tous deux un total de commandes ne doivent pas refaire deux requêtes).
- **Pagination systématique** côté backend pour toute liste (déjà le cas pour produits/commandes — à répliquer pour stock, CRM, factures dès leur conception, jamais de `SELECT *` sans limite).
- **Index base de données** sur toutes les colonnes de filtre fréquent : `company_id`, `country_code`, `status`, `created_at` — à définir dès la migration initiale, pas ajoutés a posteriori en urgence.
- **Cache Redis** pour les données peu volatiles à forte lecture : plans d'abonnement, catégories, zones de livraison, taux de commission par pays.
- **Images** : le pipeline existant (`scripts/gen-icons.mjs`, `sharp` en dépendance) suggère déjà une gestion d'images — étendre le redimensionnement automatique aux nouveaux uploads (documents entreprise, catalogues fournisseurs à fort volume).
- **Lazy loading** des nouveaux modules côté frontend (`React.lazy` par route) pour ne pas alourdir le bundle initial du grand public avec le code du SaaS que 90% des visiteurs ne chargeront jamais.
- **Temps réel** : pour la messagerie et le suivi logistique, prévoir une stratégie de "room" Socket.IO par entreprise/conversation pour ne pas diffuser les événements à tous les clients connectés.

## 37. SEO

- Le grand public (marketplace B2C) doit rester **entièrement indexable** — ne rien changer côté rendu des pages produit/catégorie existantes qui fonctionnent déjà (URLs, meta tags).
- Nouvelles pages publiques (annuaire fournisseurs, profils entreprise, pages plans SaaS) : URLs propres et stables (`/fournisseurs/:slug`, jamais d'ID technique exposé si un slug existe), balises meta title/description dynamiques par page, données structurées (schema.org `Organization`/`Product`/`Offer`) pour améliorer l'apparence dans les résultats de recherche B2B.
- Pages multi-pays : `hreflang` dès l'ajout d'un second pays avec contenu localisé, pour éviter le contenu dupliqué aux yeux des moteurs de recherche.
- Sitemap dynamique incluant les nouvelles entités publiques (profils entreprise, annuaire) généré automatiquement, pas maintenu à la main.
- Temps de chargement (Core Web Vitals) impacte le SEO — rejoint directement les recommandations de performance ci-dessus.

## 38. Accessibilité

- Base actuelle : Bootstrap 5 donne une bonne accessibilité de base (focus visible déjà géré via les tokens de focus ring `--duu-yellow-rgb` sur boutons/inputs, cohérent sur tout le site suite à l'unification récente).
- **Contraste** : vérifier systématiquement les nouvelles combinaisons de couleurs du module SaaS (§18/04) contre le fond — en particulier `--duu-status-warning` (jaune) sur fond clair, souvent limite en contraste, à tester avec un outil (ex. axe DevTools) avant de généraliser.
- **Formulaires complexes** (RFQ, facturation, gestion employés) : labels explicites systématiques, messages d'erreur associés au champ (`aria-describedby`), navigation clavier complète — les nouveaux formulaires SaaS sont plus denses que les formulaires grand public actuels, donc plus à risque si l'accessibilité n'est pas pensée dès la conception du composant `DataTable`/formulaires génériques.
- **Tableaux de données** (`DataTable`, listes de stock/commandes/factures) : en-têtes de colonnes correctement associés (`<th scope="col">`), tri annoncé aux lecteurs d'écran (`aria-sort`).
- **Messagerie temps réel** : nouveaux messages annoncés via une région `aria-live="polite"`, pas seulement visuels.
- **Composants déjà accessibles à réutiliser tels quels** : `Modal` (gère déjà la touche Échap), `PasswordField` (labels ARIA sur le bouton afficher/masquer) — ne pas réinventer, étendre.
