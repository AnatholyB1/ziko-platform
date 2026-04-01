import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';

const tabs = [
  { path: '/(app)/(plugins)/pantry/dashboard', segment: 'dashboard', label: 'pantry.tab_dashboard', icon: 'storefront-outline' },
  { path: '/(app)/(plugins)/pantry/recipes',   segment: 'recipes',   label: 'pantry.tab_recipes',   icon: 'restaurant-outline' },
  { path: '/(app)/(plugins)/pantry/shopping',  segment: 'shopping',  label: 'pantry.tab_shopping',  icon: 'cart-outline' },
] as const;

export default function PantryTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.surface,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        paddingBottom: insets.bottom,
        paddingTop: 8,
        height: 56 + insets.bottom,
      }}
    >
      {tabs.map((tab) => {
        const isActive = pathname.includes(tab.segment);
        return (
          <TouchableOpacity
            key={tab.path}
            onPress={() => router.replace(tab.path as any)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}
          >
            <Ionicons name={tab.icon as any} size={22} color={isActive ? theme.primary : theme.muted} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: isActive ? '600' : '400',
                color: isActive ? theme.primary : theme.muted,
              }}
            >
              {t(tab.label)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
