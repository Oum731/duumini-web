// src/components/ordersAdmin/orderUtils.ts
import type { Product } from "../../services/products";
import type { OrderStatus, PayStatus as SvcPayStatus } from "../../services/orders";
import { moneyMAD } from "../../utils/money";
import { imgUrl } from "../../utils/media";
export { imgUrl };

export type AnyObj = Record<string, any>;

export const STATUSES: OrderStatus[] = ["OPEN", "PREPARATION", "DELIVERY", "DONE", "CANCELLED"];

export const BADGE: Record<OrderStatus, string> = {
  OPEN: "bg-secondary",
  PREPARATION: "bg-warning",
  DELIVERY: "bg-info",
  DONE: "bg-success",
  CANCELLED: "bg-danger",
};

/* ====== Money ====== */
export const mad = moneyMAD;

export function numSafe(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Image produit robuste (utilise product_cover renvoyé par GET /api/orders/:id) */
export function getItemImage(it: AnyObj): string {
  const raw =
    it.product_cover ||
    it.image_url ||
    it.cover ||
    it.product_image ||
    it.image ||
    it.thumb ||
    it.thumbnail ||
    (it.product &&
      (it.product.product_cover ||
        it.product.image_url ||
        it.product.cover ||
        it.product.image ||
        it.product.thumb)) ||
    null;

  return imgUrl(raw || "");
}

/** Vignette pour la ligne de tableau (liste des commandes) */
export function getOrderThumb(o: AnyObj): string {
  const raw = o.first_product_cover || o.product_cover || o.cover || "";
  return imgUrl(raw);
}

/* ===== Helpers téléphone / WhatsApp ===== */
export function normalizePhoneTel(phone?: string, defaultCountry = "+212") {
  const raw = (phone || "").replace(/\s+/g, "");
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return "+" + raw.slice(2);
  if (/^0\d{9,}$/.test(raw)) return defaultCountry + raw.slice(1);
  return raw;
}

export function telHref(phone?: string) {
  const normalized = normalizePhoneTel(phone);
  return normalized ? `tel:${normalized}` : undefined;
}

/** wa.me attend uniquement des chiffres */
export function waDigits(phone?: string, fallback = "212623677884") {
  const normalized = normalizePhoneTel(phone) || "";
  const digits = normalized.replace(/[^\d]/g, "");
  return digits || fallback;
}

export function productShareUrl(it: AnyObj) {
  const pid = it?.product_id ?? it?.productId ?? it?.id ?? null;
  if (!pid) return "";
  return `https://www.duumini.com/share/product/${pid}`;
}

/* ===== Helper: code alphanumérique pour affichage ===== */
export function getOrderDisplayCode(orderOrId: string | number | { id?: string | number; display_code?: string | null }) {
  const anyO = orderOrId as any;

  const display = anyO?.display_code ?? anyO?.displayCode ?? null;
  if (display) return String(display).toUpperCase();

  let rawId: string | number | undefined;
  if (typeof orderOrId === "number" || typeof orderOrId === "string") rawId = orderOrId;
  else rawId = anyO?.id;

  if (rawId == null) return "";

  const num = typeof rawId === "number" ? rawId : Number(rawId);
  if (Number.isFinite(num) && num > 0) return num.toString(36).toUpperCase();
  return String(rawId ?? "").toUpperCase();
}

/* =========================
 * ✅ Fulfillment
 * Align backend delivery.mode:
 * "EXPRESS" | "SIMPLE" | "PROMO_FREE" | "CASABLANCA" | "CITY" => DELIVERY
 * (pickup/expedition compatibles si ajout futur)
 * =======================*/
export type Fulfillment = "DELIVERY" | "PICKUP" | "EXPEDITION";

export function normFulfillment(o: AnyObj): Fulfillment {
  const delivery = o?.delivery && typeof o.delivery === "object" ? o.delivery : null;

  const modeRaw =
    String(
      delivery?.mode ??
        o?.delivery_mode ??
        o?.fulfillment ??
        o?.fulfillment_mode ??
        o?.shipping_mode ??
        "",
    )
      .trim()
      .toUpperCase() || "";

  if (modeRaw === "PICKUP") return "PICKUP";
  if (modeRaw === "EXPEDITION") return "EXPEDITION";

  if (modeRaw) return "DELIVERY";
  return "DELIVERY";
}

export function fulfillmentLabel(f: Fulfillment) {
  if (f === "PICKUP") return { text: "RÉCUPÉRATION", cls: "bg-dark" };
  if (f === "EXPEDITION") return { text: "EXPÉDITION", cls: "bg-warning text-dark" };
  return { text: "LIVRAISON", cls: "bg-info" };
}

/* ====== Totaux/Commission ======
  ✅ itemsAmount = sous-total articles
  ✅ deliveryFee/shippingFee = livraison
  ✅ duuShare = commission Duumini (DONE only)
  ✅ ca = CA produits (hors livraison)
*/
export function computeOrderAmounts(order: AnyObj) {
  const totals = order?.totals || null;
  const hasTotals = totals && typeof totals === "object";
  const status = String(order?.status || "").toUpperCase();

  const deliveryFee =
    hasTotals && typeof totals.delivery_fee === "number"
      ? Number(totals.delivery_fee)
      : order?.delivery && typeof order.delivery === "object" && order.delivery?.fee != null
        ? numSafe(order.delivery.fee)
        : numSafe(order?.delivery_fee ?? order?.deliveryFee ?? 0);

  let itemsAmount =
    hasTotals && typeof totals.items_amount === "number"
      ? Number(totals.items_amount)
      : typeof order?.items_amount === "number"
        ? Number(order.items_amount)
        : 0;

  if (!itemsAmount || itemsAmount <= 0) {
    const arr = Array.isArray(order?.items)
      ? order.items
      : Array.isArray(order?.order_items)
        ? order.order_items
        : [];
    if (arr.length) {
      itemsAmount = arr.reduce((s: number, it: AnyObj) => {
        const qty = Number(it?.qty ?? 1) || 1;
        const unit = Number(it?.unit_price ?? it?.price ?? it?.final_price ?? 0) || 0;
        return s + unit * qty;
      }, 0);
    } else {
      const totalFallback =
        typeof order?.total === "number"
          ? order.total
          : hasTotals && typeof totals.amount === "number"
            ? Number(totals.amount)
            : numSafe(order?.total);

      itemsAmount = Math.max(0, Number(totalFallback) - Number(deliveryFee));
    }
  }

  const ca = Math.max(0, itemsAmount);

  const totalFromApi =
    typeof order?.total === "number"
      ? order.total
      : hasTotals && typeof totals.amount === "number"
        ? Number(totals.amount)
        : null;

  const total =
    totalFromApi != null && Number.isFinite(totalFromApi)
      ? Number(totalFromApi)
      : ca + Math.max(0, deliveryFee);

  const totalsCommission =
    hasTotals && typeof totals.duumini_commission === "number" ? Number(totals.duumini_commission) : null;

  const directCommission =
    typeof order?.commission_duumini === "number"
      ? Number(order.commission_duumini)
      : order?.commission_duumini != null
        ? Number(order.commission_duumini)
        : null;

  const legacyTotalsShare =
    hasTotals && typeof totals.duumini_amount === "number"
      ? Number(totals.duumini_amount)
      : hasTotals && typeof totals.commission === "number"
        ? Number(totals.commission)
        : null;

  let duuShareRaw = Number(
    totalsCommission != null
      ? totalsCommission
      : directCommission != null
        ? directCommission
        : legacyTotalsShare != null
          ? legacyTotalsShare
          : 0,
  );
  if (!Number.isFinite(duuShareRaw) || duuShareRaw < 0) duuShareRaw = 0;

  const duuShare = status === "DONE" ? duuShareRaw : 0;
  const vendorNet = Math.max(0, ca - duuShare);
  const shippingFee = Math.max(0, deliveryFee);

  return {
    total,
    deliveryFee, // compat
    shippingFee,
    itemsAmount,
    ca,
    duuShare,
    vendorNet,
  };
}

/* ===== Payment helpers (align orders.ts) ===== */
export type PayStatus = SvcPayStatus | "PENDING";

export function normPayStatus(s: any): PayStatus | null {
  const v = String(s || "").trim().toUpperCase();
  if (v === "PAID") return "PAID";
  if (v === "UNPAID") return "UNPAID";
  if (v === "PARTIAL") return "PARTIAL";
  if (v === "PENDING") return "PENDING";
  return null;
}

export function toInputNumberValue(n: number) {
  return n === 0 ? "" : String(n);
}
export function fromInputNumberValue(v: string) {
  if (v.trim() === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isBankMethod(method?: string | null) {
  const m = String(method || "").trim().toUpperCase();
  return m === "BANK_TRANSFER" || m === "BANK" || m === "TRANSFER" || m === "VIREMENT";
}

export function getPaymentFromOrder(o: AnyObj) {
  const payment = o?.payment && typeof o.payment === "object" ? o.payment : null;

  const status: PayStatus | null =
    normPayStatus(o?.payment_status) || normPayStatus(payment?.status) || null;

  const paid_amount =
    numSafe(o?.paid_amount) || numSafe(payment?.paid_amount) || numSafe(payment?.paidAmount) || 0;

  const remaining_amount_raw =
    o?.remaining_amount ?? payment?.remaining_amount ?? payment?.remainingAmount ?? null;
  const remaining_amount =
    remaining_amount_raw == null ? null : Math.max(0, numSafe(remaining_amount_raw));

  const method = String(payment?.method || o?.payment_method || "").trim() || null;
  const note = payment?.note != null ? String(payment.note) : null;
  const currency = String(payment?.currency || o?.currency || "MAD").toUpperCase();

  return { payment, status, paid_amount, remaining_amount, method, note, currency };
}

export function computeRemaining(total: number, paid: number) {
  const t = Math.max(0, numSafe(total));
  const p = Math.max(0, Math.min(numSafe(paid), t));
  return Math.max(0, t - p);
}

export function computePayStatus(total: number, paid: number): PayStatus {
  const t = Math.max(0, numSafe(total));
  const p = Math.max(0, Math.min(numSafe(paid), t));
  if (t <= 0 || p <= 0) return "UNPAID";
  if (p >= t) return "PAID";
  return "PARTIAL";
}

export function getPaymentLabelForRow(o: AnyObj) {
  const oStatus = String(o?.status || "").toUpperCase();
  if (oStatus === "CANCELLED") return { text: "ANNULÉE", cls: "bg-danger" };

  const { total } = computeOrderAmounts(o);
  const pay = getPaymentFromOrder(o);

  const bank = isBankMethod(pay.method);

  const paid = numSafe(pay.paid_amount);
  const remain = computeRemaining(total, paid);
  const explicit = pay.status;

  if (explicit === "PAID") return { text: "PAYÉ", cls: "bg-success" };
  if (explicit === "PENDING") return { text: "VIREMENT: EN ATTENTE", cls: "bg-warning text-dark" };

  if (bank && (explicit === "UNPAID" || explicit === "PARTIAL" || explicit == null)) {
    if (paid <= 0) return { text: "VIREMENT: EN ATTENTE", cls: "bg-warning text-dark" };
  }

  if (paid > 0 && remain > 0) return { text: "PARTIEL", cls: "bg-warning text-dark" };
  if (paid >= total && total > 0) return { text: "PAYÉ", cls: "bg-success" };

  return { text: "NON PAYÉ", cls: "bg-secondary" };
}

export function getRemainingAmountForRow(o: AnyObj): number | null {
  const st = String(o?.status || "").toUpperCase();
  if (st === "CANCELLED") return null;

  const { total } = computeOrderAmounts(o);
  const pay = getPaymentFromOrder(o);

  if (pay?.remaining_amount != null) return Math.max(0, numSafe(pay.remaining_amount));

  const paid = numSafe(pay?.paid_amount);
  return computeRemaining(total, paid);
}

/* ===== WhatsApp message ===== */
export function buildAdminWhatsappMessage(order: AnyObj) {
  const items: AnyObj[] = Array.isArray(order.items) ? order.items : [];
  const created = order.created_at ? new Date(order.created_at).toLocaleString("fr-FR") : "";

  const address = order.address || {};
  const contact = order.contact || order.user || {};
  const fullName =
    `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
    contact.name ||
    "cher(e) client(e)";

  const phone = contact.phone || order.phone || "";
  const displayCode = getOrderDisplayCode(order);

  const { itemsAmount, total, deliveryFee } = computeOrderAmounts(order);

  const ville = address.city || address.ville || order.address_city || "";
  const commune = address.commune || order.address_commune || "";
  const quartier = address.district || address.quartier || order.address_district || "";

  const status: OrderStatus | string = order.status || "OPEN";
  const statusText =
    status === "OPEN"
      ? "Nous avons bien reçu votre commande. Elle vient d’être prise en charge par notre équipe."
      : status === "PREPARATION"
        ? "Votre commande est en cours de préparation."
        : status === "DELIVERY"
          ? "Votre commande est en cours de livraison vers votre adresse."
          : status === "DONE"
            ? "Votre commande a été livrée. Nous espérons qu’elle vous plaira !"
            : status === "CANCELLED"
              ? "Votre commande a été annulée. N’hésitez pas à nous contacter pour plus d’informations."
              : "Voici un récapitulatif de votre commande.";

  const lines =
    items.length > 0
      ? items
          .map((it) => {
            const name = it.product_name || it.name || `Produit #${it.product_id ?? ""}`;
            const qty = Number(it.qty ?? 1);
            const unit = Number(it.unit_price ?? it.price ?? 0);
            const lineTotal = unit * qty;

            const link = productShareUrl(it);
            const linkPart = link ? `\n  🔗 ${link}` : "";

            return `• ${name} ×${qty} = ${mad(lineTotal)}${linkPart}`;
          })
          .join("\n")
      : "• Détails des articles indisponibles";

  const f = normFulfillment(order);
  const fLine =
    f === "PICKUP"
      ? "Réception : *Récupération sur place*"
      : f === "EXPEDITION"
        ? "Réception : *Expédition* (dépôt Duumini, frais transporteur payés au retrait)"
        : "Réception : *Livraison*";

  const blocs: string[] = [];
  blocs.push(`Bonjour ${fullName},`);
  blocs.push("");
  blocs.push(`Merci pour votre commande chez *Duumini*`);
  blocs.push(statusText);
  blocs.push("");
  blocs.push(`*Détails de la commande #${displayCode}*`);
  if (created) blocs.push(`Date : ${created}`);
  blocs.push(fLine);
  blocs.push("");
  blocs.push("*Articles*");
  blocs.push(lines);
  blocs.push("");
  blocs.push(`Sous-total : ${mad(itemsAmount)}`);
  blocs.push(`Livraison : ${mad(deliveryFee)}`);
  blocs.push(`Total : ${mad(total)}`);
  blocs.push("");

  if (f === "DELIVERY") {
    blocs.push("*Adresse de livraison*");
    if (ville) blocs.push(`Ville : ${ville}`);
    if (commune) blocs.push(`Commune : ${commune}`);
    if (quartier) blocs.push(`Quartier : ${quartier}`);
    blocs.push("");
  }

  blocs.push(`Téléphone : ${phone || "—"}`);
  blocs.push("");
  // ✅ Nom du commercial rattaché (order.commercial_seller_name, résolu
  // côté serveur — voir GET /api/orders/:id), sinon DUUMINI (vente
  // directe) — même logique que la ligne "Vendu par" du reçu imprimé/
  // partagé (OrderReceipt.tsx), pour que les deux formats concordent.
  const soldBy =
    typeof order.commercial_seller_name === "string" &&
    order.commercial_seller_name.trim()
      ? order.commercial_seller_name.trim()
      : "DUUMINI";
  blocs.push(`Vendu par : ${soldBy}`);
  blocs.push("");
  blocs.push("Nous restons disponibles pour toute question.");
  blocs.push("Merci pour votre confiance.");

  return blocs.join("\n");
}

export function waHref(order: AnyObj) {
  const recipient = waDigits(order.contact?.phone || order.user?.phone);
  const text = encodeURIComponent(buildAdminWhatsappMessage(order));
  return `https://wa.me/${recipient}?text=${text}`;
}

/* ===== Vente sur place helpers ===== */
export function getProductUnitPrice(p: Product): number {
  const anyP = p as AnyObj;

  const promo =
    anyP.promo_price ??
    anyP.promoPrice ??
    anyP.price_promo ??
    anyP.sale_price ??
    anyP.salePrice ??
    anyP.final_price ??
    anyP.finalPrice ??
    anyP.discounted_price ??
    null;

  const base = anyP.price ?? 0;

  const promoNum = Number(promo);
  if (Number.isFinite(promoNum) && promoNum > 0 && promoNum < Number(base || Infinity)) return promoNum;

  const baseNum = Number(base);
  return Number.isFinite(baseNum) ? baseNum : 0;
}

export function hasPromo(p: Product): boolean {
  const anyP = p as AnyObj;

  const promo =
    anyP.promo_price ??
    anyP.promoPrice ??
    anyP.price_promo ??
    anyP.sale_price ??
    anyP.salePrice ??
    anyP.final_price ??
    anyP.finalPrice ??
    anyP.discounted_price ??
    null;

  const base = Number(anyP.price ?? 0);
  const promoNum = Number(promo);
  return Number.isFinite(promoNum) && promoNum > 0 && promoNum < base;
}

/* ===== Visibilité vendeur ===== */
export type CurrentUser = {
  id?: number;
  role?: string;
  shop_id?: number | null;
  vendor_id?: number | null;
} & AnyObj;

export function isVendorRole(role?: string) {
  const r = String(role || "").toUpperCase();
  return r === "VENDEUR" || r === "VENDOR" || r === "SELLER" || r === "SHOP" || r === "BOUTIQUE" || r === "RESTAURANT";
}

/* ===== Reçu (helper) ===== */
export function openReceiptPrintWindow(html: string) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}