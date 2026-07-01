import type { User } from "../../../services/auth";

export function initials(u: User | null): string {
  const fn = (u?.first_name || "").trim();
  const ln = (u?.last_name || "").trim();
  const phone = u?.phone || "";
  if (fn || ln)
    return `${fn?.[0] || ""}${ln?.[0] || ""}`.toUpperCase() ||
      phone.slice(-2);
  return phone ? phone.slice(-2) : "U";
}

export function Avatar({ user, size = 64 }: { user: User | null; size?: number }) {
  const src = user?.avatar?.trim() || "";
  const text = initials(user);
  if (src) {
    return (
      <img
        src={src}
        alt="Avatar"
        width={size}
        height={size}
        className="rounded-circle object-fit-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-circle d-flex align-items-center justify-content-center"
      style={{
        width: size,
        height: size,
        background: "var(--duu-black, #111)",
        color: "#fff",
        fontWeight: 700,
      }}
      aria-label="Avatar"
    >
      {text}
    </div>
  );
}
