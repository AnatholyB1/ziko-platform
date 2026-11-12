// SUPP-07 : rappels par creneau (Matin / Midi / Soir), notifications locales.
// Un seul rappel par creneau, qui liste les produits ; creneau sans produit = aucune notification ;
// desactive = "Rappel désactivé". 3 notifications locales maximum par jour.
import {
  DEFAULT_REMINDER_TIME,
  MOMENTS,
  MOMENT_LABEL,
  type Moment,
  type StackEntry,
} from './moments';

export interface ReminderPref {
  moment: Moment;
  enabled: boolean;
  remindTime: string; // "HH:MM"
}

export interface ReminderSlot {
  moment: Moment;
  label: string;
  enabled: boolean;
  time: string;
  productCount: number;
  productNames: string[];
}

export interface PlannedNotification {
  identifier: string;
  moment: Moment;
  hour: number;
  minute: number;
  title: string;
  body: string;
}

export const REMINDER_ID_PREFIX = 'ziko-supplements-';
export const REMINDER_DATA_KIND = 'supplement-reminder';

export function parseTime(value: string | null | undefined): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((value ?? '').trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Decale une heure "HH:MM" de `deltaMinutes` (modulo 24 h). Entree invalide : inchangee. */
export function shiftTime(value: string, deltaMinutes: number): string {
  const t = parseTime(value);
  if (!t) return value;
  const total = (((t.hour * 60 + t.minute + deltaMinutes) % 1440) + 1440) % 1440;
  return formatTime(Math.floor(total / 60), total % 60);
}

/** Preferences completes (3 creneaux) : valeurs par defaut pour les creneaux sans ligne. */
export function withDefaultPrefs(rows: ReadonlyArray<Partial<ReminderPref> & { moment: Moment }>): ReminderPref[] {
  return MOMENTS.map((moment) => {
    const row = rows.find((r) => r.moment === moment);
    const time = row?.remindTime && parseTime(row.remindTime) ? row.remindTime : DEFAULT_REMINDER_TIME[moment];
    return { moment, enabled: row?.enabled ?? false, remindTime: time };
  });
}

export function buildReminderSlots(stack: readonly StackEntry[], prefs: readonly ReminderPref[]): ReminderSlot[] {
  const full = withDefaultPrefs(prefs);
  return full.map((pref) => {
    const items = stack.filter((s) => s.moments.includes(pref.moment));
    return {
      moment: pref.moment,
      label: MOMENT_LABEL[pref.moment],
      enabled: pref.enabled,
      time: pref.remindTime,
      productCount: items.length,
      productNames: items.map((i) => i.name),
    };
  });
}

/** "2 produits" / "1 produit" / "Aucun produit". */
export function formatProductCount(n: number): string {
  if (n <= 0) return 'Aucun produit';
  return `${n} produit${n > 1 ? 's' : ''}`;
}

/** Notifications a programmer : creneaux actifs ET non vides, au plus 3. */
export function planNotifications(slots: readonly ReminderSlot[]): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  for (const slot of slots) {
    if (!slot.enabled || slot.productCount === 0) continue;
    const t = parseTime(slot.time);
    if (!t) continue;
    out.push({
      identifier: `${REMINDER_ID_PREFIX}${slot.moment}`,
      moment: slot.moment,
      hour: t.hour,
      minute: t.minute,
      title: `Compléments, ${slot.label.toLowerCase()}`,
      body: slot.productNames.join(', '),
    });
  }
  return out;
}
