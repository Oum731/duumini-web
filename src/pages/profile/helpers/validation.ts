import { normalizePhoneInput, isValidPhoneIntl } from "../../../utils/phone";

export const rePassword = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function validateRegisterForm(params: {
  phone: string;
  password: string;
  villeText: string;
  communeText: string;
  quartierText: string;
}) {
  const errors: Record<string, string> = {};
  const phoneVal = normalizePhoneInput(params.phone.trim());

  if (!phoneVal) errors.phone = "Téléphone requis.";
  else if (!isValidPhoneIntl(phoneVal))
    errors.phone =
      "Numéro invalide. Utilisez le format international ex : +2126…";

  if (!params.password) errors.password = "Mot de passe requis.";
  else if (!rePassword.test(params.password))
    errors.password = "Au moins 8 caractères, avec 1 lettre et 1 chiffre.";

  if (!params.villeText.trim()) errors.ville = "Veuillez saisir votre ville.";
  if (!params.communeText.trim())
    errors.commune = "Veuillez saisir votre commune.";
  if (!params.quartierText.trim())
    errors.quartier = "Veuillez préciser votre quartier.";

  return errors;
}

export function validateEditForm(params: {
  phone: string;
  villeText: string;
  communeText: string;
  quartierText: string;
}) {
  const errors: Record<string, string> = {};
  const phoneVal = normalizePhoneInput(params.phone.trim());

  if (!phoneVal) errors.phone = "Téléphone requis.";
  else if (!isValidPhoneIntl(phoneVal))
    errors.phone =
      "Numéro invalide. Utilisez le format international ex : +2126…";

  if (!params.villeText.trim()) errors.ville = "Veuillez saisir votre ville.";
  if (!params.communeText.trim())
    errors.commune = "Veuillez saisir votre commune.";
  if (!params.quartierText.trim())
    errors.quartier = "Veuillez préciser votre quartier.";

  return errors;
}

export function validatePasswordForm(params: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const errors: Record<string, string> = {};

  if (!params.currentPassword) {
    errors.currentPassword = "Mot de passe actuel requis.";
  }

  if (!params.newPassword) {
    errors.newPassword = "Nouveau mot de passe requis.";
  } else if (!rePassword.test(params.newPassword)) {
    errors.newPassword =
      "Au moins 8 caractères, avec 1 lettre et 1 chiffre.";
  }

  if (!params.confirmPassword) {
    errors.confirmPassword = "Confirmation du mot de passe requise.";
  } else if (params.newPassword !== params.confirmPassword) {
    errors.confirmPassword = "Les mots de passe ne correspondent pas.";
  }

  if (
    params.currentPassword &&
    params.newPassword &&
    params.currentPassword === params.newPassword
  ) {
    errors.newPassword =
      "Le nouveau mot de passe doit être différent de l'ancien.";
  }

  return errors;
}
