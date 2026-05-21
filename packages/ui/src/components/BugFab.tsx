import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

// ── Bug Store ─────────────────────────────────────────────────

interface BugFabState {
  visible: boolean;
  show: () => void;
  hide: () => void;
}

export const useBugStore = create<BugFabState>()((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));

export function showBugReport() {
  useBugStore.getState().show();
}

// ── BugFab Component ──────────────────────────────────────────

export function BugFab() {
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      onPress={showBugReport}
      activeOpacity={0.8}
      style={{
        position: 'absolute',
        bottom: 80 + insets.bottom,
        right: 20,
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#1C1A17',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
        zIndex: 999,
      }}
    >
      <Ionicons name="bug-outline" size={20} color="#FFFAF6" />
    </TouchableOpacity>
  );
}
