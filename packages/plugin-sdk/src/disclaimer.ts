// ============================================================
// Health / medical disclaimer
// ============================================================
// Google Play's Health Content and Services policy requires apps that handle
// health data to remind users to consult a healthcare professional for medical
// advice, diagnosis or treatment. Single source of truth for every screen that
// shows health, nutrition, sleep or recovery information.

export const MEDICAL_DISCLAIMER = {
  fr: "Ziko ne fournit pas de conseil médical, de diagnostic ni de traitement. Consulte un professionnel de santé avant de modifier ton entraînement, ton alimentation ou ton sommeil, surtout en cas de problème de santé.",
  en: 'Ziko does not provide medical advice, diagnosis or treatment. Consult a healthcare professional before changing your training, diet or sleep, especially if you have a health condition.',
} as const;

export type MedicalDisclaimerLocale = keyof typeof MEDICAL_DISCLAIMER;

export function getMedicalDisclaimer(locale?: string | null): string {
  return locale && locale.toLowerCase().startsWith('en')
    ? MEDICAL_DISCLAIMER.en
    : MEDICAL_DISCLAIMER.fr;
}
