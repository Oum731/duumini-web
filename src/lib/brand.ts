export const DUUMINI_SLOGAN = "Vendeurs, fournisseurs et producteurs connectés à travers l'Afrique";
export const DUUMINI_OPEN_ISO = "2025-12-21T20:00:00+01:00";
export const CAN_PROMO_END_ISO = "2026-01-18T19:59:59+01:00";

// Numéro WhatsApp officiel Duumini — source unique. Ne jamais coder ce
// numéro en dur ailleurs : importer WHATSAPP_NUMBER/WHATSAPP_DISPLAY/
// WHATSAPP_LINK depuis ce fichier pour pouvoir le changer en un seul endroit.
export const WHATSAPP_NUMBER = "212656568827";
export const WHATSAPP_DISPLAY = "+212 656 56 88 27";
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}`;

export function whatsappLinkWithText(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
