const ANDREA_PHONE = "+212665255698";

function normalizePhone(phone?: string | null) {
  return String(phone || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/[()]/g, "")
    .replace(/^00/, "+")
    .trim();
}

export function isFinanceUser(user: any) {
  if (!user) return false;

  const role = String(user?.role || "").toUpperCase();
  if (role === "ADMIN") return true;

  const phones = [
    user?.phone,
    user?.telephone,
    user?.tel,
    user?.mobile,
    user?.contact?.phone,
    user?.user?.phone,
  ];

  return phones.some((p) => normalizePhone(p) === normalizePhone(ANDREA_PHONE));
}