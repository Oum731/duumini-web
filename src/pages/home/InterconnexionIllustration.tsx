// src/pages/home/InterconnexionIllustration.tsx
// Illustration explicite de l'objectif du site : un produit qui circule
// d'un pays africain à l'autre grâce au réseau de vendeurs/fournisseurs
// DUUMINI (corridor Maroc → Côte d'Ivoire, puis vers d'autres pays).
// Utilisée dans la sell-intent gate (SellIntentGate.tsx).

export default function InterconnexionIllustration() {
  return (
    <svg
      viewBox="0 0 400 140"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Un produit voyage du Maroc vers la Côte d'Ivoire, puis vers d'autres pays africains grâce au réseau DUUMINI"
      style={{ width: "100%", height: "auto", maxHeight: 140 }}
    >
      {/* Route pointillée Maroc -> Côte d'Ivoire -> au-delà */}
      <path
        d="M 78 70 Q 200 20 322 70"
        fill="none"
        stroke="var(--duu-green)"
        strokeOpacity="0.35"
        strokeWidth="3"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      <path
        d="M 322 70 Q 360 85 388 78"
        fill="none"
        stroke="var(--duu-orange)"
        strokeOpacity="0.35"
        strokeWidth="3"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />

      {/* Pays "à venir" (points fantômes, réseau qui s'étend) */}
      <circle cx="388" cy="78" r="4" fill="var(--duu-orange)" fillOpacity="0.35" />
      <circle cx="370" cy="30" r="3" fill="var(--duu-green)" fillOpacity="0.25" />

      {/* Colis en transit sur la route */}
      <g transform="translate(150, 42)">
        <rect x="-9" y="-9" width="18" height="18" rx="4" fill="var(--duu-orange)" />
        <path d="M -9 -1 H 9 M 0 -9 V 9" stroke="#fff" strokeWidth="1.5" />
      </g>
      <g transform="translate(250, 42)">
        <rect x="-9" y="-9" width="18" height="18" rx="4" fill="var(--duu-green)" />
        <path d="M -9 -1 H 9 M 0 -9 V 9" stroke="#fff" strokeWidth="1.5" />
      </g>

      {/* Nœud Maroc */}
      <circle cx="70" cy="70" r="30" fill="rgba(var(--duu-orange-rgb), .14)" />
      <text x="70" y="78" fontSize="26" textAnchor="middle">
        🇲🇦
      </text>
      <text
        x="70"
        y="122"
        fontSize="12"
        fontWeight="700"
        textAnchor="middle"
        fill="var(--duu-black)"
      >
        Maroc
      </text>

      {/* Nœud Côte d'Ivoire */}
      <circle cx="322" cy="70" r="30" fill="rgba(var(--duu-green-rgb), .14)" />
      <text x="322" y="78" fontSize="26" textAnchor="middle">
        🇨🇮
      </text>
      <text
        x="322"
        y="122"
        fontSize="12"
        fontWeight="700"
        textAnchor="middle"
        fill="var(--duu-black)"
      >
        Côte d'Ivoire
      </text>

      {/* Suggestion "et plus" */}
      <text
        x="388"
        y="100"
        fontSize="11"
        fontWeight="600"
        textAnchor="middle"
        fill="var(--duu-green)"
      >
        +
      </text>
    </svg>
  );
}
