export const ANDREA_PHONE = "+212665255698";

function normalizePhone(value?: string | null) {
  return String(value || "")
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+")
    .trim();
}

export function isAndreaFinanceController(user: any) {
  if (!user) return false;

  const role = String(user?.role || "").toUpperCase();

  if (role === "ADMIN") return true;

  const candidates = [
    user?.phone,
    user?.telephone,
    user?.tel,
    user?.contact_phone,
    user?.whatsapp,
  ];

  return candidates.some((p) => normalizePhone(p) === normalizePhone(ANDREA_PHONE));
}

export function canManagePaymentsFront(user: any) {
  return isAndreaFinanceController(user);
}

export function canManageExpensesFront(user: any) {
  return isAndreaFinanceController(user);
}