import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useBugStore } from './BugFab';

// ── Types ─────────────────────────────────────────────────────

interface BugSheetProps {
  supabase: any;
  apiUrl: string;
  userId?: string;
}

const BUG_TYPES = ['Interface', 'Crash', 'Performance', 'Fonctionnalité', 'Données'];

// ── BugSheet Component ────────────────────────────────────────

export function BugSheet({ supabase, apiUrl, userId }: BugSheetProps) {
  const visible = useBugStore((s) => s.visible);
  const hide = useBugStore((s) => s.hide);
  const theme = useThemeStore((s) => s.theme);

  const [selectedType, setSelectedType] = useState('Interface');
  const [text, setText] = useState('');
  const [screenshotToggle, setScreenshotToggle] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const reset = useCallback(() => {
    setSelectedType('Interface');
    setText('');
    setScreenshotToggle(false);
    setIsSending(false);
  }, []);

  const handleClose = useCallback(() => {
    hide();
    reset();
  }, [hide, reset]);

  const collectDeviceInfo = () => ({
    platform: Platform.OS,
    osVersion: Platform.Version,
    deviceName: Device.deviceName ?? 'unknown',
    appVersion: Constants.expoConfig?.version ?? '1.0.0',
  });

  const handleSend = async () => {
    if (text.trim().length === 0) return;
    setIsSending(true);

    const report = {
      user_id: userId ?? null,
      title: selectedType + ' — ' + text.trim().slice(0, 60),
      description: text.trim(),
      severity: 'medium',
      category: selectedType.toLowerCase(),
      device_info: collectDeviceInfo(),
      status: 'open',
    };

    const { error } = await supabase.from('bug_reports').insert(report);

    if (error) {
      setIsSending(false);
      showAlert('Erreur', 'Impossible d\'envoyer le rapport. Réessaie plus tard.');
      return;
    }

    setIsSending(false);
    handleClose();
    showAlert('Merci !', 'Ton rapport a été envoyé. Nous allons l\'examiner.');
  };

  const canSend = text.trim().length > 0 && !isSending;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={handleClose}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable onPress={() => {}}>
            <MotiView
              from={{ translateY: 500 }}
              animate={{ translateY: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              style={{
                backgroundColor: theme.background,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 20,
                paddingBottom: 32,
              }}
            >
              {/* Handle bar */}
              <View style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(28,26,23,0.18)',
                alignSelf: 'center',
                marginTop: 10,
                marginBottom: 16,
              }} />

              {/* Header */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                  Signaler un problème
                </Text>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close" size={22} color={theme.muted} />
                </TouchableOpacity>
              </View>

              {/* Type chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {BUG_TYPES.map((type) => {
                  const active = selectedType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setSelectedType(type)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1,
                        backgroundColor: active ? theme.primary + '1A' : theme.surface,
                        borderColor: active ? theme.primary : theme.border,
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: active ? theme.primary : theme.muted,
                      }}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Description input */}
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                placeholder="Décris le problème..."
                placeholderTextColor={theme.muted}
                style={{
                  minHeight: 100,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 12,
                  color: theme.text,
                  fontSize: 14,
                  backgroundColor: theme.surface,
                  textAlignVertical: 'top',
                  marginBottom: 16,
                }}
              />

              {/* Screenshot toggle */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
                paddingVertical: 8,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="camera-outline" size={20} color={theme.muted} />
                  <Text style={{ fontSize: 14, color: theme.muted }}>
                    Joindre une capture d'écran
                  </Text>
                </View>
                <Switch
                  value={screenshotToggle}
                  onValueChange={setScreenshotToggle}
                  trackColor={{ false: theme.border, true: theme.primary + '80' }}
                  thumbColor={screenshotToggle ? theme.primary : theme.surface}
                />
              </View>

              {/* Send button */}
              <TouchableOpacity
                onPress={handleSend}
                disabled={!canSend}
                style={{
                  width: '100%',
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: canSend ? theme.primary : 'rgba(255,92,26,0.3)',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                {isSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                      Envoyer
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </MotiView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
