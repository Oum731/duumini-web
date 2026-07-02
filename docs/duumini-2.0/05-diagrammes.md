# 23–27. Diagrammes

Tous les diagrammes sont en syntaxe [Mermaid](https://mermaid.js.org/) — rendus nativement par GitHub, GitLab, Notion, et la plupart des éditeurs (VS Code avec l'extension Mermaid).

## 23. Diagramme UML (classes / domaines principaux)

```mermaid
classDiagram
    class User {
        +int id
        +string phone
        +Role role
        +string first_name
        +string last_name
    }
    class Company {
        +int id
        +string legal_name
        +string country_code
        +SupplierType supplier_type
        +KybStatus kyb_status
    }
    class CompanyMember {
        +int user_id
        +int company_id
        +InternalRole internal_role
        +MemberStatus status
    }
    class Shop {
        +int id
        +int owner_id
        +ShopType shop_type
        +string country
    }
    class Product {
        +int id
        +int shop_id
        +decimal price
        +int stock
    }
    class ProductPriceTier {
        +int product_id
        +int min_qty
        +decimal unit_price
    }
    class Order {
        +int id
        +OrderStatus status
        +PayStatus payment_status
    }
    class RfqRequest {
        +int id
        +int buyer_company_id
        +RfqStatus status
    }
    class RfqOffer {
        +int rfq_id
        +int supplier_company_id
        +decimal unit_price
    }
    class Warehouse {
        +int id
        +string country_code
    }
    class Subscription {
        +int company_id
        +int plan_id
        +SubStatus status
    }
    class Wallet {
        +int company_id
        +decimal balance
        +string currency_code
    }

    User "1" --> "0..*" CompanyMember
    Company "1" --> "0..*" CompanyMember
    Company "1" --> "0..*" Shop : possède
    Shop "1" --> "0..*" Product
    Product "1" --> "0..*" ProductPriceTier
    Company "1" --> "0..*" Order : acheteur
    Shop "1" --> "0..*" Order : vendeur
    Company "1" --> "0..*" RfqRequest : émet
    RfqRequest "1" --> "0..*" RfqOffer
    Company "1" --> "0..*" RfqOffer : répond
    Order "0..1" --> "0..1" Warehouse : préparée par
    Company "1" --> "0..1" Subscription
    Company "1" --> "1" Wallet
```

## 24. Diagrammes de séquence

### Séquence — Demande de devis (RFQ) jusqu'à la commande

```mermaid
sequenceDiagram
    actor Buyer as Entreprise acheteuse
    participant FE as Frontend
    participant API as API Marketplace
    participant RT as Realtime Gateway
    actor Supplier as Fournisseur

    Buyer->>FE: Sélectionne produits + quantités
    FE->>API: POST /api/v2/rfq
    API->>API: Crée rfq_requests (status=SENT)
    API->>RT: emit("rfq:new", supplierIds)
    RT-->>Supplier: Notification temps réel
    Supplier->>FE: Consulte le RFQ
    Supplier->>API: POST /api/v2/rfq/:id/offers
    API->>RT: emit("rfq:offer", buyerId)
    RT-->>Buyer: Notification "nouvelle offre"
    Buyer->>API: POST /api/v2/rfq/:id/offers/:offerId/accept
    API->>API: Crée Order (order_type=RFQ) via orders.createOrder()
    API-->>Buyer: Commande confirmée
    API->>RT: emit("order:created", supplierId)
```

### Séquence — Commande avec logistique confiée à Duumini

```mermaid
sequenceDiagram
    actor Client
    participant Checkout as Checkout (existant)
    participant OrderAPI as API Orders
    participant WMS as API Logistique (Warehouse)
    actor Op as Opérateur entrepôt
    actor Livreur

    Client->>Checkout: Confirme la commande
    Checkout->>OrderAPI: createOrder(payload)
    OrderAPI->>OrderAPI: Vérifie fulfillment_by du produit
    alt fulfillment_by = DUUMINI
        OrderAPI->>WMS: Assigne à l'entrepôt compétent
        WMS-->>Op: Tâche de préparation
        Op->>WMS: Marque "préparé"
        WMS->>OrderAPI: PATCH order.status=DELIVERY
    else fulfillment_by = SELLER
        OrderAPI-->>Client: Commande transmise au vendeur (flux actuel inchangé)
    end
    OrderAPI->>Livreur: Notification livraison à effectuer
    Livreur->>OrderAPI: PATCH order.status=DONE
```

### Séquence — Authentification (existant, à conserver tel quel)

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant FE as Frontend
    participant Auth as API Auth

    U->>FE: Saisit téléphone + mot de passe
    FE->>Auth: POST /api/auth/login
    Auth-->>FE: { access_token, refresh_token, user }
    FE->>FE: Stocke tokens (mémoire/localStorage)
    Note over FE,Auth: Sur 401, refresh automatique via /api/auth/refresh (déjà implémenté dans services/auth.ts)
```

## 25. Diagramme de base de données (ER simplifié)

```mermaid
erDiagram
    USERS ||--o{ COMPANY_MEMBERS : "est membre de"
    COMPANIES ||--o{ COMPANY_MEMBERS : "a des employés"
    COMPANIES ||--o{ SHOPS : "possède"
    SHOPS ||--o{ PRODUCTS : "catalogue"
    PRODUCTS ||--o{ PRODUCT_PRICE_TIERS : "paliers de prix"
    PRODUCTS ||--o{ PRODUCT_VARIANTS : "variantes"
    COMPANIES ||--o{ ORDERS : "achète (buyer)"
    SHOPS ||--o{ ORDERS : "vend (seller)"
    ORDERS ||--o{ ORDER_ITEMS : "contient"
    COMPANIES ||--o{ RFQ_REQUESTS : "demande"
    RFQ_REQUESTS ||--o{ RFQ_OFFERS : "reçoit"
    COMPANIES ||--o{ RFQ_OFFERS : "répond (supplier)"
    ORDERS ||--o| SHIPMENTS : "suivi"
    WAREHOUSES ||--o{ WAREHOUSE_STOCK : "stocke"
    PRODUCTS ||--o{ WAREHOUSE_STOCK : "présent dans"
    COMPANIES ||--o| SUBSCRIPTIONS : "abonnée à"
    SUBSCRIPTION_PLANS ||--o{ SUBSCRIPTIONS : "défini par"
    COMPANIES ||--|| WALLETS : "possède"
    WALLETS ||--o{ WALLET_TRANSACTIONS : "historique"
    COMPANIES ||--o{ INVOICES : "émet"
    ORDERS ||--o| INVOICES : "facturée par"
```

## 26. Diagrammes d'architecture

### Vue déploiement (cible, sans microservices day-1)

```mermaid
flowchart TB
    subgraph Client["Client"]
        Web["Web App (React/Vite)"]
    end
    subgraph Edge["Edge / CDN"]
        CDN["Static assets"]
    end
    subgraph Backend["Backend (monolithe modulaire)"]
        API["API REST"]
        WS["Realtime Gateway (Socket.IO)"]
    end
    subgraph Data["Données"]
        PG[("PostgreSQL")]
        Redis[("Redis")]
        S3[("Object Storage")]
    end
    subgraph External["Services externes"]
        Pay["Fournisseurs de paiement (par pays)"]
        SMS["OTP / SMS"]
        AI["Fournisseur IA"]
    end

    Web -->|HTTPS| CDN
    Web -->|REST JSON| API
    Web -->|WebSocket| WS
    API --> PG
    API --> Redis
    API --> S3
    API --> Pay
    API --> SMS
    API --> AI
    WS --> Redis
```

### Vue modules internes du backend

```mermaid
flowchart LR
    Auth[Auth] --> Users
    Users --> Companies
    Companies --> Marketplace
    Companies --> SaaS
    Marketplace --> Finance
    SaaS --> Finance
    Logistics --> Finance
    Marketplace --> Logistics
    Admin --> Auth & Users & Companies & Marketplace & SaaS & Logistics & Finance
```

## 27. Diagrammes de flux utilisateurs

### Flux global multi-acteurs

```mermaid
flowchart LR
    Fabricant((Fabricant/\nImportateur)) -->|publie catalogue B2B| MP[Marketplace]
    Grossiste((Grossiste)) -->|publie catalogue B2B| MP
    MP -->|annuaire + RFQ| Distrib((Distributeur/\nRevendeur))
    MP -->|achat direct| Client((Client final))
    Distrib -->|revend via boutique| Client
    MP -->|commande| Log{Choix logistique}
    Log -->|option 1| SelfShip[Fournisseur livre lui-même]
    Log -->|option 2| Duumini3PL[Entrepôt Duumini]
    Duumini3PL --> Livreur((Livreur))
    SelfShip --> Client
    Livreur --> Client
    MP -->|commission| Fin[Module Financier]
    Fabricant -->|abonnement SaaS| Fin
    Distrib -->|abonnement SaaS| Fin
```

### Parcours détaillé — voir aussi [02-modules-fonctionnels.md §7](./02-modules-fonctionnels.md)

```mermaid
flowchart TD
    Start([Visiteur arrive]) --> Choice{Type de profil}
    Choice -->|Particulier| Signup1[Inscription MEMBER]
    Choice -->|Professionnel| Signup2[Inscription + création entreprise]
    Signup1 --> Browse[Parcourt le catalogue]
    Browse --> Buy[Achète — flux existant]
    Signup2 --> Role{Rôle}
    Role -->|Fournisseur| Catalog[Publie catalogue B2B]
    Role -->|Vendeur/Distributeur| Directory[Recherche fournisseurs]
    Catalog --> Wait[Attend RFQ/commandes]
    Directory --> RFQ[Demande de devis]
    RFQ --> Nego[Négociation messagerie]
    Nego --> Order[Commande confirmée]
    Order --> SaaSMgmt[Gestion via SaaS: stock/CRM/facture]
```
