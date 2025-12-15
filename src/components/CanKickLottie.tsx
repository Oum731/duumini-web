import { useEffect, useMemo, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import canKick from "../assets/lotties/can-kick.json";

const CAN_TEAMS = [
  { name: "Maroc", emoji: "🇲🇦" },
  { name: "Burkina Faso", emoji: "🇧🇫" },
  { name: "Cameroun", emoji: "🇨🇲" },
  { name: "Algérie", emoji: "🇩🇿" },
  { name: "RD Congo", emoji: "🇨🇩" },
  { name: "Sénégal", emoji: "🇸🇳" },
  { name: "Égypte", emoji: "🇪🇬" },
  { name: "Angola", emoji: "🇦🇴" },
  { name: "Guinée équatoriale", emoji: "🇬🇶" },
  { name: "Côte d’Ivoire", emoji: "🇨🇮" },
  { name: "Gabon", emoji: "🇬🇦" },
  { name: "Ouganda", emoji: "🇺🇬" },
  { name: "Afrique du Sud", emoji: "🇿🇦" },
  { name: "Tunisie", emoji: "🇹🇳" },
  { name: "Nigeria", emoji: "🇳🇬" },
  { name: "Zimbabwe", emoji: "🇿🇼" },
  { name: "Zambie", emoji: "🇿🇲" },
  { name: "Mali", emoji: "🇲🇱" },
  { name: "Comores", emoji: "🇰🇲" },
  { name: "Soudan", emoji: "🇸🇩" },
  { name: "Bénin", emoji: "🇧🇯" },
  { name: "Tanzanie", emoji: "🇹🇿" },
  { name: "Botswana", emoji: "🇧🇼" },
  { name: "Mozambique", emoji: "🇲🇿" },
];

export default function CanKickLottie({
  size = 34,
  showTeam = true,
  className = "",
}: {
  size?: number;
  showTeam?: boolean;
  className?: string;
}) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [teamIndex, setTeamIndex] = useState(0);

  const hueList = useMemo(() => [0, 28, 55, 85, 120, 160, 200, 240, 280, 320], []);
  const hue = hueList[teamIndex % hueList.length];
  const team = CAN_TEAMS[teamIndex % CAN_TEAMS.length];

  useEffect(() => {
    const anim = lottieRef.current?.animationItem;
    if (!anim) return;

    const onLoop = () => setTeamIndex((v) => v + 1);
    anim.addEventListener("loopComplete", onLoop);

    return () => {
      anim.removeEventListener("loopComplete", onLoop);
    };
  }, []);

  return (
    <div className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          overflow: "hidden",
          filter: `hue-rotate(${hue}deg) saturate(1.25) contrast(1.05)`,
          background: "rgba(255,255,255,.65)",
          border: "1px solid rgba(0,0,0,.10)",
        }}
        aria-hidden="true"
      >
        <Lottie
          lottieRef={lottieRef}
          animationData={canKick as any}
          loop
          autoplay
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {showTeam && (
        <span
          style={{
            fontWeight: 900,
            fontSize: ".86rem",
            color: "rgba(0,0,0,.82)",
            whiteSpace: "nowrap",
          }}
        >
          {team.emoji} {team.name}
        </span>
      )}
    </div>
  );
}
