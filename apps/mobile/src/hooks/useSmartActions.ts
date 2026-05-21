import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SmartAction {
  key: string;
  tintColor: string;
  icon: string;
  tag: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

export interface HomeDataForSmartActions {
  hour: number;
  nutritionPct: number;
  hydrationPct: number;
  sleepPct: number;
}

// ---------------------------------------------------------------------------
// Hook — time-of-day + deficit derivation, memoised on data inputs
// ---------------------------------------------------------------------------

export function useSmartActions(
  data: HomeDataForSmartActions,
  navigate: (path: string) => void,
): SmartAction[] {
  return useMemo(() => {
    const actions: SmartAction[] = [];

    // 1. Morning mobility (before 11h)
    if (data.hour < 11) {
      actions.push({
        key: 'mobility',
        tintColor: '#8B5CF6',
        icon: 'body-outline',
        tag: 'Récup',
        title: '5 min de mobilité épaules',
        subtitle: 'Avant ta séance push — débloque les rotateurs',
        onPress: () => navigate('/(app)/(plugins)/stretching/dashboard'),
      });
    }

    // 2. Nutrition gap (< 60% of daily target)
    if (data.nutritionPct < 60) {
      const kcalMissing = Math.round((1 - data.nutritionPct / 100) * 2000);
      actions.push({
        key: 'nutrition',
        tintColor: '#FF5C1A',
        icon: 'restaurant-outline',
        tag: 'Nutrition',
        title: `Manque ~${kcalMissing} kcal aujourd'hui`,
        subtitle: 'Loggue ton dîner pour atteindre ta cible',
        onPress: () => navigate('/(app)/(plugins)/nutrition/log'),
      });
    }

    // 3. Evening sleep prep (after 19h, sleep coverage < 50%)
    if (data.hour >= 19 && data.sleepPct < 50) {
      actions.push({
        key: 'sleep',
        tintColor: '#8B5CF6',
        icon: 'moon-outline',
        tag: 'Sommeil',
        title: 'Prépare-toi à dormir',
        subtitle: 'Routine de coucher + log demain matin',
        onPress: () => navigate('/(app)/(plugins)/sleep/dashboard'),
      });
    }

    // 4. Hydration catch-up (if not yet 2 cards)
    if (data.hydrationPct < 50 && actions.length < 2) {
      actions.push({
        key: 'hydration',
        tintColor: '#3B82F6',
        icon: 'water-outline',
        tag: 'Hydratation',
        title: 'Complète ton hydratation',
        subtitle: "Il te manque de l'eau pour la journée",
        onPress: () => navigate('/(app)/(plugins)/hydration/dashboard'),
      });
    }

    return actions.slice(0, 2);
  }, [data.hour, data.nutritionPct, data.hydrationPct, data.sleepPct]);
}
