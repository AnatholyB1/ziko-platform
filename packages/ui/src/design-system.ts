export const shadow = {
  card: { shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  float: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
} as const;

export const colors = {
  bg: '#F7F6F3', surface: '#FFFFFF', border: '#E2E0DA', primary: '#FF5C1A',
  text: '#1C1A17', muted: '#6B6963', cardDark: '#1C1A17', cardDarkText: '#FFFAF6',
  success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A', danger: '#EF4444',
} as const;
