import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, Pressable,
  ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { create } from 'zustand';
import { useThemeStore, showAlert, useTranslation } from '@ziko/plugin-sdk';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { usePathname } from 'expo-router';

// ── Bug Report Store ──────────────────────────────────────

interface BugReportState {
  visible: boolean;
  show: () => void;
  hide: () => void;
}

export const useBugReportStore = create<BugReportState>()((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));

export function showBugReport() {
  useBugReportStore.getState().show();
}

// ── Types ─────────────────────────────────────────────────

type Severity = 'low' | 'medium' | 'high' | 'critical';
type Category = 'ui' | 'crash' | 'performance' | 'feature' | 'data' | 'other';

const SEVERITIES: { id: Severity; icon: string; color: string }[] = [
  { id: 'low', icon: 'arrow-down-circle', color: '#22C55E' },
  { id: 'medium', icon: 'remove-circle', color: '#F59E0B' },
  { id: 'high', icon: 'arrow-up-circle', color: '#F97316' },
  { id: 'critical', icon: 'alert-circle', color: '#EF4444' },
];

const CATEGORIES: { id: Category; icon: string }[] = [
  { id: 'ui', icon: 'phone-portrait' },
  { id: 'crash', icon: 'flash' },
  { id: 'performance', icon: 'speedometer' },
  { id: 'feature', icon: 'bulb' },
  { id: 'data', icon: 'server' },
  { id: 'other', icon: 'ellipsis-horizontal' },
];

// ── Component ─────────────────────────────────────────────

export default function BugReportModal() {
  const { visible, hide } = useBugReportStore();
  const theme = useThemeStore((s) => s.theme);
  const session = useAuthStore((s) => s.session);
  const pathname = usePathname();
  const { t } = useTranslation();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [category, setCategory] = useState<Category>('other');
  const [isSending, setIsSending] = useState(false);

  const reset = useCallback(() => {
    setStep(0);
    setTitle('');
    setDescription('');
    setSteps('');
    setSeverity('medium');
    setCategory('other');
    setIsSending(false);
  }, []);

  const handleClose = () => {
    hide();
    reset();
  };

  const collectDeviceInfo = () => ({
    platform: Platform.OS,
    osVersion: Platform.Version,
    deviceName: Device.deviceName ?? 'unknown',
    modelName: Device.modelName ?? 'unknown',
    brand: Device.brand ?? 'unknown',
    appVersion: Constants.expoConfig?.version ?? '1.0.0',
    buildVersion: Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? 'N/A',
    expoSdk: Constants.expoConfig?.sdkVersion ?? 'unknown',
  });

  const handleSubmit = async () => {
    if (!session?.user?.id) return;
    setIsSending(true);

    const deviceInfo = collectDeviceInfo();

    const report = {
      user_id: session.user.id,
      title: title.trim(),
      description: description.trim(),
      steps_to_reproduce: steps.trim() || null,
      severity,
      category,
      screen_name: pathname,
      device_info: deviceInfo,
    };

    // Save to Supabase
    const { error } = await supabase.from('bug_reports').insert(report);

    if (error) {
      setIsSending(false);
      showAlert(t('general.error'), t('bugReport.submitError'));
      return;
    }

    // Try to create GitHub issue via backend
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (token) {
        await fetch(`${process.env.EXPO_PUBLIC_API_URL}/bugs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(report),
        });
      }
    } catch {
      // Non-blocking — report is already saved in Supabase
    }

    setIsSending(false);
    handleClose();
    showAlert(t('bugReport.thankYou'), t('bugReport.submitted'));
  };

  if (!visible) return null;

  const canGoNext = step === 0 ? title.trim().length > 0 : step === 1 ? description.trim().length > 0 : true;

  const inputStyle = {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.text,
    fontSize: 15,
  } as const;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={handleClose}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
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
                maxHeight: '85%',
              }}
            >
              {/* Header */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: '#EF444415', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="bug" size={18} color="#EF4444" />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>
                    {t('bugReport.title')}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close" size={24} color={theme.muted} />
                </TouchableOpacity>
              </View>

              {/* Progress */}
              <View style={{ flexDirection: 'row', padding: 20, paddingBottom: 0, gap: 6 }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    backgroundColor: i <= step ? theme.primary : theme.border,
                  }} />
                ))}
              </View>

              <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Step 0: Title + Category */}
                {step === 0 && (
                  <View>
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16, marginBottom: 6 }}>
                      {t('bugReport.whatHappened')}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 14 }}>
                      {t('bugReport.titleHint')}
                    </Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder={t('bugReport.titlePlaceholder')}
                      placeholderTextColor={theme.muted}
                      style={inputStyle}
                      maxLength={120}
                      autoFocus
                    />

                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16, marginTop: 24, marginBottom: 10 }}>
                      {t('bugReport.category')}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => setCategory(cat.id)}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 6,
                            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                            backgroundColor: category === cat.id ? theme.primary : theme.surface,
                            borderWidth: 1,
                            borderColor: category === cat.id ? theme.primary : theme.border,
                          }}
                        >
                          <Ionicons name={cat.icon as any} size={16} color={category === cat.id ? '#fff' : theme.muted} />
                          <Text style={{ color: category === cat.id ? '#fff' : theme.muted, fontWeight: '500', fontSize: 13 }}>
                            {t(`bugReport.cat_${cat.id}`)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Step 1: Description + Steps */}
                {step === 1 && (
                  <View>
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16, marginBottom: 6 }}>
                      {t('bugReport.describeIssue')}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 14 }}>
                      {t('bugReport.descriptionHint')}
                    </Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder={t('bugReport.descriptionPlaceholder')}
                      placeholderTextColor={theme.muted}
                      style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}
                      multiline
                      autoFocus
                    />

                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16, marginTop: 24, marginBottom: 6 }}>
                      {t('bugReport.stepsToReproduce')}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 14 }}>
                      {t('bugReport.stepsHint')}
                    </Text>
                    <TextInput
                      value={steps}
                      onChangeText={setSteps}
                      placeholder={t('bugReport.stepsPlaceholder')}
                      placeholderTextColor={theme.muted}
                      style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
                      multiline
                    />
                  </View>
                )}

                {/* Step 2: Severity + Summary */}
                {step === 2 && (
                  <View>
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16, marginBottom: 10 }}>
                      {t('bugReport.severity')}
                    </Text>
                    <View style={{ gap: 8, marginBottom: 24 }}>
                      {SEVERITIES.map((sev) => (
                        <TouchableOpacity
                          key={sev.id}
                          onPress={() => setSeverity(sev.id)}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 12,
                            padding: 14, borderRadius: 12,
                            backgroundColor: severity === sev.id ? sev.color + '15' : theme.surface,
                            borderWidth: 1.5,
                            borderColor: severity === sev.id ? sev.color : theme.border,
                          }}
                        >
                          <Ionicons name={sev.icon as any} size={22} color={sev.color} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                              {t(`bugReport.sev_${sev.id}`)}
                            </Text>
                            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
                              {t(`bugReport.sev_${sev.id}_desc`)}
                            </Text>
                          </View>
                          {severity === sev.id && (
                            <Ionicons name="checkmark-circle" size={22} color={sev.color} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Summary */}
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16, marginBottom: 10 }}>
                      {t('bugReport.summary')}
                    </Text>
                    <View style={{
                      backgroundColor: theme.surface, borderRadius: 12,
                      borderWidth: 1, borderColor: theme.border, padding: 16, gap: 8,
                    }}>
                      <SummaryRow icon="text" label={t('bugReport.titleLabel')} value={title} theme={theme} />
                      <SummaryRow icon="list" label={t('bugReport.category')} value={t(`bugReport.cat_${category}`)} theme={theme} />
                      <SummaryRow icon="document-text" label={t('bugReport.descriptionLabel')} value={description} theme={theme} />
                      {steps ? <SummaryRow icon="git-branch" label={t('bugReport.stepsLabel')} value={steps} theme={theme} /> : null}
                      <SummaryRow icon="navigate" label={t('bugReport.screenLabel')} value={pathname} theme={theme} />
                      <SummaryRow icon="phone-portrait" label={t('bugReport.deviceLabel')} value={`${Platform.OS} ${Platform.Version} · ${Device.modelName ?? 'unknown'}`} theme={theme} />
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Footer buttons */}
              <View style={{
                flexDirection: 'row', gap: 10, padding: 20, paddingTop: 12,
                borderTopWidth: 1, borderTopColor: theme.border,
              }}>
                {step > 0 && (
                  <TouchableOpacity
                    onPress={() => setStep(step - 1)}
                    style={{
                      flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                      backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
                    }}
                  >
                    <Text style={{ color: theme.muted, fontWeight: '600', fontSize: 15 }}>
                      {t('general.back')}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={step < 2 ? () => setStep(step + 1) : handleSubmit}
                  disabled={!canGoNext || isSending}
                  style={{
                    flex: step > 0 ? 1 : undefined, width: step === 0 ? '100%' : undefined,
                    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                    backgroundColor: canGoNext ? (step === 2 ? '#EF4444' : theme.primary) : theme.border,
                    flexDirection: 'row', justifyContent: 'center', gap: 8,
                  }}
                >
                  {isSending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                        {step < 2 ? t('general.continue') : t('bugReport.submit')}
                      </Text>
                      {step < 2 && <Ionicons name="arrow-forward" size={18} color="#fff" />}
                      {step === 2 && <Ionicons name="send" size={16} color="#fff" />}
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </MotiView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Summary Row Helper ────────────────────────────────────

function SummaryRow({ icon, label, value, theme }: { icon: string; label: string; value: string; theme: any }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Ionicons name={icon as any} size={16} color={theme.muted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '500' }}>{label}</Text>
        <Text style={{ color: theme.text, fontSize: 14, marginTop: 1 }} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}
