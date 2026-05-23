import { useUserPrefsStore } from '../stores/userPrefsStore';

export function useUnits() {
  const units = useUserPrefsStore((s) => s.units);
  return {
    units,
    weightLabel: units === 'metric' ? 'kg' : 'lb',
    distanceLabel: units === 'metric' ? 'km' : 'mi',
    heightLabel: units === 'metric' ? 'cm' : 'in',
    convertWeight: (kg: number) => units === 'metric' ? kg : +(kg * 2.205).toFixed(1),
    convertDistance: (km: number) => units === 'metric' ? km : +(km * 0.621).toFixed(2),
  };
}
