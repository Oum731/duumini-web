// src/pages/home/NetworkIllustration.tsx
// Illustration originale (pas de photo) : un réseau de pays africains
// connectés dans les deux sens — le commerce circule du Maroc vers la
// Côte d'Ivoire ET de la Côte d'Ivoire vers le Maroc, et ainsi de suite
// entre tous les pays du réseau, pas un simple corridor à sens unique.

type Node = { code: string; flag: string; x: number; y: number; tint: "orange" | "green" };

// Mêmes emoji drapeaux que la source de vérité backend
// (country_config.flag_emoji, cf. createCountryConfigTable.js).
const NODES: Node[] = [
  { code: "MA", flag: "🇲🇦", x: 90, y: 70, tint: "orange" },
  { code: "SN", flag: "🇸🇳", x: 55, y: 165, tint: "green" },
  { code: "CI", flag: "🇨🇮", x: 150, y: 230, tint: "orange" },
  { code: "CM", flag: "🇨🇲", x: 260, y: 190, tint: "green" },
];

// Nœuds estompés = le réseau continue de s'étendre à d'autres pays.
const GHOST_NODES: Node[] = [
  { code: "", flag: "", x: 320, y: 90, tint: "orange" },
  { code: "", flag: "", x: 340, y: 240, tint: "green" },
];

const EDGES: [string, string][] = [
  ["MA", "SN"],
  ["SN", "CI"],
  ["CI", "CM"],
  ["MA", "CI"],
];

function nodeByCode(code: string) {
  return NODES.find((n) => n.code === code)!;
}

export default function NetworkIllustration() {
  return (
    <svg
      viewBox="0 0 400 300"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Un réseau de pays africains connectés dans les deux sens : le commerce circule du Maroc vers la Côte d'Ivoire, de la Côte d'Ivoire vers le Maroc, et entre tous les pays du réseau DUUMINI"
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* fond doux */}
      <rect x="0" y="0" width="400" height="300" rx="26" fill="#FFF3E2" />

      {/* liaisons bidirectionnelles entre pays du réseau */}
      {EDGES.map(([a, b]) => {
        const na = nodeByCode(a);
        const nb = nodeByCode(b);
        return (
          <line
            key={`${a}-${b}`}
            x1={na.x}
            y1={na.y}
            x2={nb.x}
            y2={nb.y}
            stroke="rgba(17,17,17,.25)"
            strokeWidth="2"
            strokeDasharray="1 7"
            strokeLinecap="round"
          />
        );
      })}

      {/* le réseau continue de s'étendre */}
      <line
        x1={nodeByCode("CM").x}
        y1={nodeByCode("CM").y}
        x2={GHOST_NODES[0].x}
        y2={GHOST_NODES[0].y}
        stroke="rgba(17,17,17,.15)"
        strokeWidth="2"
        strokeDasharray="1 7"
        strokeLinecap="round"
      />
      <line
        x1={nodeByCode("CI").x}
        y1={nodeByCode("CI").y}
        x2={GHOST_NODES[1].x}
        y2={GHOST_NODES[1].y}
        stroke="rgba(17,17,17,.15)"
        strokeWidth="2"
        strokeDasharray="1 7"
        strokeLinecap="round"
      />
      {GHOST_NODES.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r="6"
          fill={n.tint === "orange" ? "var(--duu-orange)" : "var(--duu-green)"}
          fillOpacity="0.3"
        />
      ))}
      <text x="345" y="270" fontSize="14" fontWeight="700" fill="var(--duu-green)">
        +
      </text>

      {/* colis en transit (les deux sens) */}
      <g transform="translate(72, 118)">
        <rect x="-8" y="-8" width="16" height="16" rx="4" fill="var(--duu-orange)" />
        <path d="M -8 0 H 8 M 0 -8 V 8" stroke="#fff" strokeWidth="1.4" />
      </g>
      <g transform="translate(205, 210)">
        <rect x="-8" y="-8" width="16" height="16" rx="4" fill="var(--duu-green)" />
        <path d="M -8 0 H 8 M 0 -8 V 8" stroke="#fff" strokeWidth="1.4" />
      </g>

      {/* nœuds pays */}
      {NODES.map((n) => (
        <g key={n.code}>
          <circle
            cx={n.x}
            cy={n.y}
            r="26"
            fill={n.tint === "orange" ? "rgba(var(--duu-orange-rgb), .18)" : "rgba(var(--duu-green-rgb), .18)"}
            stroke={n.tint === "orange" ? "var(--duu-orange)" : "var(--duu-green)"}
            strokeWidth="2"
          />
          <text x={n.x} y={n.y + 9} fontSize="24" textAnchor="middle">
            {n.flag}
          </text>
        </g>
      ))}
    </svg>
  );
}
