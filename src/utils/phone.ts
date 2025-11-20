// src/utils/phone.ts

/**
 * Regex E.164 simplifiée :
 *  - commence par "+"
 *  - 1 à 3 chiffres de code pays (1–3)
 *  - total entre ~8 et 15 chiffres
 *
 * Ex valides : +212612345678, +2250701020304, +22360123456, +14155552671
 */
export const rePhoneIntl = /^\+[1-9]\d{7,14}$/;

/**
 * Normalise un numéro saisi par l'utilisateur :
 *  - supprime les espaces
 *  - remplace un préfixe "00" par "+"
 *
 * Exemple :
 *  " 00 212 612 34 56 78 " → "+212612345678"
 */
export function normalizePhoneInput(raw: string): string {
  let v = (raw || "").trim();

  // supprimer tous les espaces
  v = v.replace(/\s+/g, "");

  // 00 → +
  if (v.startsWith("00")) {
    v = "+" + v.slice(2);
  }

  return v;
}

/** Validation simple : numéro au format international */
export function isValidPhoneIntl(raw: string): boolean {
  const v = normalizePhoneInput(raw);
  return rePhoneIntl.test(v);
}
