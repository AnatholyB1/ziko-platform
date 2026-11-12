import React, { useRef, useState } from 'react';
import { Animated, PanResponder, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { clampFabPosition, snapFabX } from '@ziko/plugin-sdk';

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
// XCUT-04 : le bouton ne doit masquer aucune action. Il est compact, translucide,
// deplacable (glisser) et s'accroche au bord gauche/droit ; sa zone est bornee
// au-dessus de la barre d'onglets. Un simple tap ouvre le signalement.

const FAB_SIZE = 36;
const GUTTER = 8;
const TAB_BAR_H = 70;

export function BugFab() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const bounds = {
    screenW: width, screenH: height, size: FAB_SIZE,
    insetTop: insets.top, insetBottom: insets.bottom, tabBarH: TAB_BAR_H, gutter: GUTTER,
  };
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  // Position initiale : bord gauche, juste au-dessus de la barre d'onglets
  // (le coin droit est la ou se trouvent les boutons d'action).
  const initial = clampFabPosition(GUTTER, height, bounds);
  const pos = useRef(new Animated.ValueXY(initial)).current;
  const last = useRef(initial);
  const [dragging, setDragging] = useState(false);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
      onPanResponderGrant: () => setDragging(false),
      onPanResponderMove: (_e, g) => {
        if (Math.abs(g.dx) + Math.abs(g.dy) > 6) setDragging(true);
        const p = clampFabPosition(last.current.x + g.dx, last.current.y + g.dy, boundsRef.current);
        pos.setValue(p);
      },
      onPanResponderRelease: (_e, g) => {
        const moved = Math.abs(g.dx) + Math.abs(g.dy) > 6;
        if (!moved) {
          showBugReport();
          return;
        }
        const b = boundsRef.current;
        const p = clampFabPosition(last.current.x + g.dx, last.current.y + g.dy, b);
        const target = { x: snapFabX(p.x, b), y: p.y };
        last.current = target;
        setDragging(false);
        Animated.spring(pos, { toValue: target, useNativeDriver: false, friction: 8 }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel="Signaler un bug"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: pos.getTranslateTransform(),
        width: FAB_SIZE,
        height: FAB_SIZE,
        borderRadius: FAB_SIZE / 2,
        backgroundColor: '#1C1A17',
        opacity: dragging ? 0.95 : 0.55,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1C1A17',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
        zIndex: 999,
      }}
    >
      <Ionicons name="bug-outline" size={18} color="#FFFAF6" />
    </Animated.View>
  );
}
