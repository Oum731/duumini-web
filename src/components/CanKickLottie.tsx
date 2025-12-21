import { useMemo } from "react";

export type CanOffer = {
  label?: string;
  title?: string;
  subtitle?: string;
};

export default function CanKickLottie({
  className = "",
  variant = "badge",
  size = 44,
  title = "CAN 2025",
  offer,
  blink = false,
  imageSrc = "/can.png",
}: {
  className?: string;
  variant?: "hero" | "badge";
  size?: number;
  title?: string;
  offer?: CanOffer;
  blink?: boolean;
  imageSrc?: string;
}) {
  const isHero = variant === "hero";

  const box = useMemo(() => {
    if (isHero) return { h: 220, radius: 18, pad: 10 };
    return { h: size, radius: 14, pad: 6 };
  }, [isHero, size]);

  const label = offer?.label ?? "OFFRE CAN 2025";

  return (
    <div
      className={className}
      title={title}
      aria-label="Visuel promotion CAN"
      style={{
        width: "100%",
        height: isHero ? box.h : size,
        position: "relative",
        borderRadius: box.radius,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,.10)",
        background:
          "radial-gradient(900px 260px at 12% 10%, rgba(255,213,79,.30), transparent 60%), radial-gradient(900px 260px at 92% 10%, rgba(229,57,53,.18), transparent 55%), linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.58))",
        boxShadow: isHero
          ? "0 .8rem 2.2rem rgba(0,0,0,.10)"
          : "0 .35rem .9rem rgba(0,0,0,.08)",
      }}
    >
      <style>{`
        .can-bg{
          position:absolute; inset:0;
          background-image: url(${JSON.stringify(imageSrc)});
          background-size: cover;
          background-position: center;
          filter: blur(14px) saturate(1.05);
          transform: scale(1.15);
          opacity: .35;
        }

        .can-img{
          position:absolute; inset:0;
          width:100%; height:100%;
          object-fit: contain;
          object-position: center;
          padding: ${box.pad}px;
          filter: saturate(1.02) contrast(1.02);
        }

        .can-vignette{
          position:absolute; inset:0;
          background:
            radial-gradient(600px 220px at 20% 10%, rgba(255,213,79,.16), transparent 60%),
            radial-gradient(500px 240px at 80% 20%, rgba(229,57,53,.10), transparent 60%),
            linear-gradient(180deg, rgba(0,0,0,.00), rgba(0,0,0,.26));
          pointer-events:none;
        }

        .can-chip{
          position:absolute;
          left: 2px; top: 10px;
          display:inline-flex;
          align-items:center;
          gap:8px;
          max-width: calc(100% - 20px);
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.88);
          border: 1px solid rgba(0,0,0,.12);
          box-shadow: 0 .5rem 1.15rem rgba(0,0,0,.10);
          font-weight: 950;
          letter-spacing: .2px;
          user-select:none;
        }

        .can-dot{
          width:10px;height:10px;border-radius:50%;
          background: rgba(229,57,53,1);
          box-shadow: 0 0 0 3px rgba(229,57,53,.18);
        }
        .can-dot.blink{ animation: canBlink .7s infinite; }
        @keyframes canBlink{
          0%{ opacity: 1; transform: scale(1); }
          50%{ opacity: .20; transform: scale(.75); }
          100%{ opacity: 1; transform: scale(1); }
        }

        .can-chip .pill{
          background: var(--duu-red, #E53935);
          color:#fff;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: .78rem;
          font-weight: 980;
          white-space: nowrap;
        }

        .can-copy{
          position:absolute;
          left: 10px; right: 10px;
          bottom: 10px;
          display:flex;
          flex-direction:column;
          gap:4px;
          color:#fff;
          text-shadow: 0 .35rem 1.1rem rgba(0,0,0,.35);
        }
        .can-copy .t1{
          font-weight: 990;
          line-height: 1.05;
          letter-spacing: .2px;
          font-size: ${isHero ? "1.12rem" : ".78rem"};
        }
        .can-copy .t2{
          font-weight: 850;
          opacity: .92;
          font-size: ${isHero ? ".92rem" : ".70rem"};
          line-height: 1.1;
        }

        .can-glow{
          position:absolute;
          inset:-40px;
          background: radial-gradient(circle at 50% 40%, rgba(255,213,79,.22), transparent 58%);
          animation: canGlow 2.2s ease-in-out infinite;
          pointer-events:none;
        }
        @keyframes canGlow{
          0%{ transform: scale(.98); opacity: .55; }
          50%{ transform: scale(1.04); opacity: .85; }
          100%{ transform: scale(.98); opacity: .55; }
        }

        @media (prefers-reduced-motion: reduce){
          .can-dot.blink{ animation:none; }
          .can-glow{ animation:none; }
        }
      `}</style>

      <div className="can-bg" />
      <img className="can-img" src={imageSrc} alt="CAN 2025" loading="lazy" />
      <div className="can-vignette" />
      <div className="can-glow" />

      <div className="can-chip">
        <span className={`can-dot ${blink ? "blink" : ""}`} />
        <span className="pill">{label}</span>
      </div>
    </div>
  );
}
