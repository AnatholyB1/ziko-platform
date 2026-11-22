import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getActionPrimary } from '@ziko/plugin-sdk';

type Theme = { surface: string; background: string; border: string; text: string; muted: string; primary: string; actionPrimary?: string };

const HOLD_DELAY_MS = 400;
const REPEAT_MS = 110;

/** Bouton 44x44 : un appui = 1 pas ; appui long = repetition acceleree (x1, puis x5 apres 8 pas, x10 apres 20). */
function StepButton({ icon, label, onStep, theme, disabled }: {
  icon: 'add' | 'remove'; label: string; onStep: (multiplier: number) => void; theme: Theme; disabled?: boolean;
}) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = useRef(0);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;

  const stop = () => {
    if (timeout.current) clearTimeout(timeout.current);
    if (interval.current) clearInterval(interval.current);
    timeout.current = null;
    interval.current = null;
    count.current = 0;
  };
  useEffect(() => stop, []);

  const start = () => {
    stop();
    stepRef.current(1);
    timeout.current = setTimeout(() => {
      interval.current = setInterval(() => {
        count.current += 1;
        const mult = count.current > 20 ? 10 : count.current > 8 ? 5 : 1;
        stepRef.current(mult);
      }, REPEAT_MS);
    }, HOLD_DELAY_MS);
  };

  return (
    <Pressable
      onPressIn={disabled ? undefined : start}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon} size={20} color={theme.text} />
    </Pressable>
  );
}

export function Stepper({ label, hint, valueText, onStep, onEditValue, theme, atMin, atMax }: {
  label: string;
  hint?: string;
  valueText: string;
  /** direction +1 / -1, multiplicateur d'acceleration. */
  onStep: (direction: 1 | -1, multiplier: number) => void;
  /** Tap sur la valeur : ouvre la saisie numerique (G-04). */
  onEditValue: () => void;
  theme: Theme;
  atMin?: boolean;
  atMax?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onStep(e.nativeEvent.actionName === 'increment' ? 1 : -1, 1)}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingVertical: 6 }}
    >
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 13, color: theme.muted, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <StepButton icon="remove" label={`Moins, ${label}`} onStep={(m) => onStep(-1, m)} theme={theme} disabled={atMin} />
        <TouchableOpacity
          onPress={onEditValue}
          accessibilityRole="button"
          accessibilityLabel={`${label} : ${valueText}. Modifier la valeur`}
          style={{ minWidth: 76, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] }}>{valueText}</Text>
        </TouchableOpacity>
        <StepButton icon="add" label={`Plus, ${label}`} onStep={(m) => onStep(1, m)} theme={theme} disabled={atMax} />
      </View>
    </View>
  );
}

/** Feuille de saisie numerique (tap sur la valeur). `unit` = 'secondes' ou '' ; borne min/max appliquee par le parent. */
export function NumberSheet({ visible, title, unit, initial, min, max, theme, onClose, onConfirm }: {
  visible: boolean; title: string; unit: string; initial: number; min: number; max: number; theme: Theme;
  onClose: () => void; onConfirm: (value: number) => void;
}) {
  const [text, setText] = useState(String(initial));
  useEffect(() => {
    if (visible) setText(String(initial));
  }, [visible, initial]);
  const action = getActionPrimary(theme);
  const parsed = parseInt(text, 10);
  const valid = /^\d+$/.test(text.trim()) && parsed >= min && parsed <= max;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(28,26,23,0.4)' }} activeOpacity={1} onPress={onClose} accessibilityLabel="Fermer" />
        <View accessibilityViewIsModal style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 }}>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{title}</Text>
          <Text style={{ fontSize: 13, color: theme.muted, marginTop: 4 }}>
            {unit ? `Valeur en ${unit}` : 'Valeur'}, entre {min} et {max}.
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            accessibilityLabel={title}
            style={{
              marginTop: 12, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: valid ? theme.border : '#B3261E',
              paddingHorizontal: 14, fontSize: 18, fontWeight: '700', color: theme.text, backgroundColor: theme.background,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontWeight: '700', color: theme.text }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!valid}
              onPress={() => onConfirm(parsed)}
              accessibilityRole="button"
              accessibilityState={{ disabled: !valid }}
              style={{ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: action, alignItems: 'center', justifyContent: 'center', opacity: valid ? 1 : 0.4 }}
            >
              <Text style={{ fontWeight: '700', color: '#fff' }}>Valider</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
