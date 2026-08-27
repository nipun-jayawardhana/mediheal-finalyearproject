import { TranslationKeys } from '../i18n';

/**
 * Maps a canonical specialization string (e.g. "Cardiologist") to a translation key.
 * Retains original canonical string internally for API requests.
 */
export const getSpecializationTranslationKey = (spec?: string): TranslationKeys => {
  if (!spec) return 'generalPhysician';
  const clean = spec.toLowerCase().trim();
  if (clean.includes('cardio')) return 'cardiologist';
  if (clean.includes('derma')) return 'dermatologist';
  if (clean.includes('pediatr') || clean.includes('child')) return 'pediatrician';
  if (clean.includes('neurolog')) return 'neurologist';
  if (clean.includes('orthoped')) return 'orthopedist';
  if (clean.includes('psychiatr')) return 'psychiatrist';
  if (clean.includes('gynecolog') || clean.includes('obstetr')) return 'gynecologist';
  if (clean.includes('ent') || clean.includes('ear')) return 'entSpecialist';
  if (clean.includes('ophthalm') || clean.includes('eye')) return 'eyeSpecialist';
  return 'generalPhysician';
};

/**
 * Maps an appointment status enum (e.g. "pending", "confirmed", "completed", "cancelled")
 * to a translation key for localized display.
 */
export const getAppointmentStatusTranslationKey = (status?: string): TranslationKeys => {
  if (!status) return 'pending';
  const clean = status.toLowerCase().trim();
  if (clean === 'confirmed') return 'confirmed';
  if (clean === 'completed') return 'completed';
  if (clean === 'cancelled') return 'cancelled';
  return 'pending';
};
