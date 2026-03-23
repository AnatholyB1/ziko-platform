import React from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useAlertStore, useThemeStore } from '@ziko/plugin-sdk';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

export default function CustomAlert() {
  const { visible, title, message, buttons, hide } = useAlertStore();
  const theme = useThemeStore((s) => s.theme);

  if (!visible) return null;

  const hasDestructive = buttons.some((b) => b.style === 'destructive');
  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const actionButtons = buttons.filter((b) => b.style !== 'cancel');

  const handlePress = (onPress?: () => void) => {
    hide();
    onPress?.();
  };

  const iconName = hasDestructive ? 'warning' : 'information-circle';
  const iconColor = hasDestructive ? '#EF4444' : theme.primary;
  const iconBg = hasDestructive ? '#EF444415' : theme.primary + '15';

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <Pressable
        onPress={() => { if (cancelBtn) handlePress(cancelBtn.onPress); else hide(); }}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 30 }}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 340 }}>
          <MotiView
            from={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 24,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            {/* Icon */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: iconBg,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={iconName as any} size={28} color={iconColor} />
              </View>
            </View>

            {/* Title */}
            <Text style={{
              color: theme.text, fontWeight: '700', fontSize: 18,
              textAlign: 'center', marginBottom: message ? 8 : 20,
            }}>
              {title}
            </Text>

            {/* Message */}
            {message ? (
              <Text style={{
                color: theme.muted, fontSize: 14, lineHeight: 20,
                textAlign: 'center', marginBottom: 24,
              }}>
                {message}
              </Text>
            ) : null}

            {/* Action buttons */}
            <View style={{ gap: 10 }}>
              {actionButtons.map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                const bgColor = isDestructive ? '#EF4444' : theme.primary;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => handlePress(btn.onPress)}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: bgColor,
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Cancel button */}
              {cancelBtn ? (
                <TouchableOpacity
                  onPress={() => handlePress(cancelBtn.onPress)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: theme.background,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text style={{ color: theme.muted, fontWeight: '600', fontSize: 15 }}>
                    {cancelBtn.text}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </MotiView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
