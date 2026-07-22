// src/utils/phone.ts
import { isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Regex E.164 simplifiée, gardée en secours quand libphonenumber-js
 * n'arrive pas à parser (ex: numéro déjà propre mais pays inconnu).
 */
export const rePhoneIntl = /^\+[1-9]\d{7,14}$/;

// Marques Unicode invisibles (RTL/LTR) vues dans des numéros copiés-collés
// depuis WhatsApp/Excel — elles cassent silencieusement les comparaisons.
const BIDI_MARKS = /[‎‏‪-‮]/g;

/**
 * Normalisation légère, sûre à exécuter à chaque frappe (onChange) :
 * retire espaces/tirets/points/marques invisibles, transforme un "00"
 * de tête en "+". Ne reformate rien d'autre — ne gêne jamais la saisie.
 *
 * Exemple : " 00 212 707-88 84 87 " → "+212707888487"
 */
export function normalizePhoneInput(raw: string): string {
  let v = (raw || "").trim();

  v = v.replace(BIDI_MARKS, "");
  v = v.replace(/[\s\-.]+/g, "");

  if (v.startsWith("00")) {
    v = "+" + v.slice(2);
  }

  return v;
}

/**
 * Forme canonique définitive (E.164 compact, ex: "+212707888487"),
 * utilisée pour le stockage, la recherche et la comparaison. Retourne
 * null si le numéro ne peut pas être validé — l'appelant décide alors
 * quoi faire (garder la saisie brute, rejeter, etc.).
 *
 * `defaultCountry` sert uniquement pour un numéro local sans indicatif
 * (ex: "0707888487") — à fournir quand le pays réel est connu par le
 * contexte (boutique, commande...) pour éviter de forcer le Maroc par
 * défaut sur un numéro ivoirien.
 */
export function normalizePhone(raw: string, defaultCountry: CountryCode = "MA"): string | null {
  const cleaned = normalizePhoneInput(raw);
  if (!cleaned) return null;

  // Déjà au format "+..." : on parse tel quel, aucune supposition de pays.
  if (cleaned.startsWith("+")) {
    try {
      const parsed = parsePhoneNumberFromString(cleaned);
      if (parsed && parsed.isValid()) return parsed.number;
    } catch {
      // ignore
    }
    return rePhoneIntl.test(cleaned) ? cleaned : null;
  }

  // Numéro local visiblement national (commence par 0) : on suppose
  // `defaultCountry`.
  if (/^0\d{6,}$/.test(cleaned)) {
    try {
      const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
      if (parsed && parsed.isValid()) return parsed.number;
    } catch {
      // ignore
    }
  }

  // Sinon, probablement un numéro international tapé sans le "+"
  // (ex: "2250504321970") — on essaie cette interprétation en premier.
  try {
    const parsed = parsePhoneNumberFromString("+" + cleaned);
    if (parsed && parsed.isValid()) return parsed.number;
  } catch {
    // ignore
  }

  // Dernier recours : `defaultCountry` quand même.
  try {
    const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
    if (parsed && parsed.isValid()) return parsed.number;
  } catch {
    // ignore
  }

  return null;
}

/**
 * Format international "groupé" pour l'affichage (ex: "+212 707 88 84 87").
 * Ne masque jamais la donnée : si le parsing échoue, retourne le numéro
 * normalisé tel quel plutôt qu'une chaîne vide.
 */
export function formatPhoneDisplay(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = normalizePhoneInput(String(raw));
  if (!cleaned) return "";

  try {
    const parsed = parsePhoneNumberFromString(cleaned);
    if (parsed && parsed.isValid()) return parsed.formatInternational();
  } catch {
    // ignore, fallback ci-dessous
  }

  return cleaned;
}

/** Validation : numéro au format international valide. */
export function isValidPhoneIntl(raw: string): boolean {
  const v = normalizePhoneInput(raw);
  if (!v) return false;

  try {
    if (isValidPhoneNumber(v)) return true;
  } catch {
    // ignore, fallback ci-dessous
  }

  return rePhoneIntl.test(v);
}
