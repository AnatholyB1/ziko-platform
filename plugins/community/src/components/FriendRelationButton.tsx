import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useThemeStore, getActionPrimary, relationView,
  type FriendRelation, type RelationContext,
} from '@ziko/plugin-sdk';

/**
 * Bouton d'etat d'amitie UNIQUE (SOC-04, D-02) : meme rendu sur la ligne de resultat, la recherche
 * globale et le profil. Le mot ET l'icone portent l'etat (pas la couleur seule).
 *   none -> Ajouter (plein, getActionPrimary) | sent -> Envoyee / Demande envoyee (neutre, annulable)
 *   received -> Accepter (+ Refuser) | friend -> Ami (vert, coche)
 */
export interface FriendRelationButtonProps {
  relation: FriendRelation;
  name: string | null | undefined;
  context?: RelationContext;
  busy?: boolean;
  onAdd?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  /** accessibilityLiveRegion : annonce le changement d'etat (ex. "Demande envoyee a Marco Delmas") */
  testID?: string;
}

const SUCCESS_FG = '#1F7A3D';
const SUCCESS_BG = '#E8F5EC';

export default function FriendRelationButton({
  relation, name, context = 'list', busy, onAdd, onAccept, onDecline, onCancel, testID,
}: FriendRelationButtonProps) {
  const theme = useThemeStore((s) => s.theme);
  const view = relationView(relation, name ?? '', context);
  const fade = useRef(new Animated.Value(1)).current;
  const prev = useRef(relation);
  const reduce = useRef(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) reduce.current = !!v; }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Fondu 150 ms au changement d'etat (immediat si "reduire les animations")
  useEffect(() => {
    if (prev.current === relation) return;
    prev.current = relation;
    if (reduce.current) { fade.setValue(1); return; }
    fade.setValue(0.2);
    Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [relation, fade]);

  const base = {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 10,
  };

  const filled = (onPress?: () => void) => (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={view.a11yLabel}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={{ ...base, backgroundColor: getActionPrimary(theme), opacity: busy ? 0.6 : 1 }}
    >
      <Ionicons name={view.icon as any} size={15} color="#FFFFFF" />
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>{view.label}</Text>
    </TouchableOpacity>
  );

  let content: React.ReactNode;
  if (relation === 'friend') {
    content = (
      <View
        testID={testID}
        accessible
        accessibilityLabel={view.a11yLabel}
        style={{ ...base, backgroundColor: SUCCESS_BG }}
      >
        <Ionicons name={view.icon as any} size={15} color={SUCCESS_FG} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: SUCCESS_FG }}>{view.label}</Text>
      </View>
    );
  } else if (relation === 'sent') {
    content = (
      <TouchableOpacity
        testID={testID}
        onPress={onCancel}
        disabled={busy || !onCancel}
        accessibilityRole="button"
        accessibilityLabel={view.a11yLabel}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={{ ...base, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}
      >
        <Ionicons name={view.icon as any} size={15} color={theme.text} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{view.label}</Text>
      </TouchableOpacity>
    );
  } else if (relation === 'received') {
    content = (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {filled(onAccept)}
        {view.showDecline && onDecline ? (
          <TouchableOpacity
            onPress={onDecline}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Refuser la demande de ${name || 'cet utilisateur'}`}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={{ ...base, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Refuser</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  } else {
    content = filled(onAdd);
  }

  return (
    <Animated.View style={{ opacity: fade }} accessibilityLiveRegion="polite">
      {content}
    </Animated.View>
  );
}
