/**
 * Serie d'activite (gamification) : logique pure, dates LOCALES (jamais UTC : entre 00:00 et 02:00 en
 * France, `toISOString()` renvoie la veille et decale la serie, revue A #6).
 */
export interface StreakProfileLike {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
}

/** YYYY-MM-DD en date locale de l'appareil. */
export function localDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * SERIE AFFICHEE : une seule regle pour l'accueil, Recompenses et le Profil (UAT run 9, defaut 4 : `1 jour` / `5 jours` /
 * `0` selon l'ecran, trois sources differentes). Source = `ziko_user_gamification` ; une serie dont la derniere activite
 * est plus ancienne qu'hier est rompue (0), sinon `current_streak`.
 */
export function displayStreak(
  profile: { current_streak?: number | null; last_activity_date?: string | null } | null | undefined,
  now: Date = new Date(),
): number {
  const cur = Number(profile?.current_streak ?? 0);
  if (!(cur > 0) || !profile?.last_activity_date) return 0;
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  y.setDate(y.getDate() - 1);
  const last = String(profile.last_activity_date).slice(0, 10);
  return last === localDay(now) || last === localDay(y) ? Math.floor(cur) : 0;
}

export interface NextStreak {
  /** false : deja compte aujourd'hui, rien a ecrire. */
  changed: boolean;
  today: string;
  current_streak: number;
  longest_streak: number;
}

export function computeNextStreak(profile: StreakProfileLike, now: Date = new Date()): NextStreak {
  const today = localDay(now);
  if (profile.last_activity_date === today) {
    return { changed: false, today, current_streak: profile.current_streak, longest_streak: profile.longest_streak };
  }
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  y.setDate(y.getDate() - 1);
  const continued = profile.last_activity_date === localDay(y);
  const current = continued ? profile.current_streak + 1 : 1;
  return { changed: true, today, current_streak: current, longest_streak: Math.max(profile.longest_streak, current) };
}
