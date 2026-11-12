import React, { useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore, topInsetShortfall } from '@ziko/plugin-sdk';

export interface WSHeaderProps {
  title: string;
  sub?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  dark?: boolean;
}

export default function WSHeader({ title, sub, onBack, right, dark = false }: WSHeaderProps) {
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const ref = useRef<View>(null);
  const [extraTop, setExtraTop] = useState(0);

  // XCUT-03 : si l'en-tete se retrouve sous la barre de statut (ecran hors SafeAreaView),
  // on ajoute exactement le manque. Deja degage -> 0 (pas de double padding).
  const handleLayout = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => {
      const next = topInsetShortfall(y, insets.top);
      setExtraTop((prev) => (prev === next ? prev : next));
    });
  }, [insets.top]);

  const containerBg = dark ? 'rgba(28,26,23,0.94)' : theme.background + 'F0';
  const containerBorderColor = dark ? 'rgba(255,250,246,0.06)' : theme.border;
  const titleColor = dark ? '#FFFAF6' : theme.text;
  const subColor = dark ? 'rgba(255,250,246,0.7)' : theme.muted;
  const backBg = dark ? 'rgba(255,250,246,0.08)' : 'rgba(28,26,23,0.06)';
  const backIconColor = dark ? '#FFFAF6' : theme.text;

  return (
    <View
      ref={ref}
      onLayout={handleLayout}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 12 + extraTop,
        paddingBottom: 12,
        backgroundColor: containerBg,
        borderBottomWidth: 1,
        borderBottomColor: containerBorderColor,
        zIndex: 10,
      }}
    >
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            backgroundColor: backBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={16} color={backIconColor} />
        </TouchableOpacity>
      )}

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', lineHeight: 16, color: titleColor }}>
          {title}
        </Text>
        {sub ? (
          <Text style={{ fontSize: 12, color: subColor, marginTop: 1 }}>
            {sub}
          </Text>
        ) : null}
      </View>

      {right ? (
        <View style={{ marginLeft: 'auto' }}>
          {right}
        </View>
      ) : null}
    </View>
  );
}
