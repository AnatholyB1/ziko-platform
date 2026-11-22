import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal, ScrollView, Switch, Platform,
  KeyboardAvoidingView, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getActionPrimary } from '@ziko/plugin-sdk';
import {
  type HydrationSettings, INTERVAL_OPTIONS, GLASS_OPTIONS, COFFEE_PCT_OPTIONS, RANGE_STEP_MIN,
  BONUS_STEP_ML, BONUS_MAX_ML, GOAL_MIN_ML, GOAL_MAX_ML, computeReminderTimes, reminderSummary,
  formatHM, formatMl, formatLitres, coffeeCountedMl, validateGoalMl, validateAmountMl,
} from '../settings';
import type { PermissionState } from '../reminders';

export const WATER = '#2563C9';
export const WATER_TINT = '#E8F0FD';
const TEXT_ORANGE = '#B53D05';

type Theme = { surface: string; background: string; border: string; text: string; muted: string; primary: string; actionPrimary?: string };

// ─── Feuille basse commune : au-dessus du clavier (HY-9) ─────────────────────

export function Sheet({
  theme, visible, title, onClose, onSave, saveLabel = 'Enregistrer', saveDisabled, saving, children,
}: {
  theme: Theme; visible: boolean; title: string; onClose: () => void; onSave: () => void;
  saveLabel?: string; saveDisabled?: boolean; saving?: boolean; children: React.ReactNode;
}) {
  const action = getActionPrimary(theme);
  const disabled = !!saveDisabled || !!saving;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(28,26,23,0.4)' }}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Fermer"
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '88%',
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 8 }}>
            <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
          >
            {children}
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
            <TouchableOpacity
              onPress={onSave}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              style={{
                minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                backgroundColor: disabled ? '#F0EFE9' : action,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: disabled ? '#8A877F' : '#FFFFFF' }}>
                {saving ? 'Enregistrement...' : saveLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Briques ─────────────────────────────────────────────────────────────────

function Segment<T extends number>({
  theme, options, value, onChange, label,
}: { theme: Theme; options: readonly T[]; value: T; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
      {options.map((o) => {
        const sel = o === value;
        return (
          <TouchableOpacity
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            style={{
              flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              borderWidth: sel ? 2 : 1, borderColor: sel ? getActionPrimary(theme) : theme.border,
              backgroundColor: sel ? '#FFF0E8' : theme.surface,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: sel ? '800' : '600', color: sel ? TEXT_ORANGE : theme.text }}>{label(o)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Stepper({
  theme, label, value, onMinus, onPlus, minusDisabled, plusDisabled, display,
}: {
  theme: Theme; label: string; value: string; display?: string; onMinus: () => void; onPlus: () => void;
  minusDisabled?: boolean; plusDisabled?: boolean;
}) {
  const btn = (name: 'remove' | 'add', onPress: () => void, disabled?: boolean, a11y?: string) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
        alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={name} size={20} color={theme.text} />
    </TouchableOpacity>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {btn('remove', onMinus, minusDisabled, `${label}, diminuer`)}
        <Text accessibilityLiveRegion="polite" style={{ minWidth: 64, textAlign: 'center', fontSize: 17, fontWeight: '800', color: theme.text }}>
          {display ?? value}
        </Text>
        {btn('add', onPlus, plusDisabled, `${label}, augmenter`)}
      </View>
    </View>
  );
}

function SwitchRow({ theme, label, sub, value, onChange, disabled }: { theme: Theme; label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{label}</Text>
        {sub ? <Text style={{ fontSize: 14, color: theme.muted }}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: theme.border, true: getActionPrimary(theme) }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const Hint = ({ theme, children }: { theme: Theme; children: React.ReactNode }) => (
  <Text style={{ fontSize: 14, lineHeight: 20, color: theme.muted, marginTop: 12 }}>{children}</Text>
);

// ─── Rappels (E04, E09) ──────────────────────────────────────────────────────

export function RemindersSheet({
  theme, visible, settings, permission, saving, onClose, onSave, onRequestPermission,
}: {
  theme: Theme; visible: boolean; settings: HydrationSettings; permission: PermissionState; saving?: boolean;
  onClose: () => void; onSave: (s: HydrationSettings) => void; onRequestPermission: () => Promise<PermissionState>;
}) {
  const [draft, setDraft] = useState(settings);
  const [perm, setPerm] = useState(permission);
  useEffect(() => { if (visible) { setDraft(settings); setPerm(permission); } }, [visible, settings, permission]);
  const toggle = async (v: boolean) => {
    if (!v) { setDraft({ ...draft, remindersEnabled: false }); return; }
    const p = perm === 'granted' ? perm : await onRequestPermission();
    setPerm(p);
    setDraft({ ...draft, remindersEnabled: p === 'granted' });
  };
  const moveStart = (d: number) => setDraft((s) => {
    const start = Math.min(Math.max(s.reminderStartMin + d, 0), 23 * 60 + 30);
    return { ...s, reminderStartMin: start, reminderEndMin: Math.max(s.reminderEndMin, start) };
  });
  const moveEnd = (d: number) => setDraft((s) => ({ ...s, reminderEndMin: Math.min(Math.max(s.reminderEndMin + d, s.reminderStartMin), 24 * 60 - RANGE_STEP_MIN) }));
  return (
    <Sheet theme={theme} visible={visible} title="Rappels" onClose={onClose} saving={saving}
      saveDisabled={perm === 'denied' && !(settings.remindersEnabled && !draft.remindersEnabled)}
      onSave={() => onSave(draft)}>
      {perm === 'denied' && (
        <View accessibilityRole="alert" style={{ backgroundColor: '#FDECEA', borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#B3261E' }}>Notifications désactivées</Text>
          <Text style={{ fontSize: 14, color: theme.text, marginTop: 2 }}>
            {Platform.OS === 'ios' ? 'iOS' : 'Android'} bloque les rappels de Ziko. Active-les pour être prévenu.
          </Text>
          <TouchableOpacity
            onPress={() => { Linking.openSettings().catch(() => undefined); }}
            accessibilityRole="button"
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: TEXT_ORANGE }}>
              {`Ouvrir les réglages ${Platform.OS === 'ios' ? 'iOS' : 'Android'}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <SwitchRow theme={theme} label="Rappels intelligents" sub={perm === 'denied' ? 'En attente d\'autorisation' : undefined}
        value={draft.remindersEnabled} onChange={toggle} />
      {draft.remindersEnabled && perm !== 'denied' && (
        <>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginTop: 12, marginBottom: 8 }}>Intervalle</Text>
          <Segment theme={theme} options={INTERVAL_OPTIONS} value={draft.reminderIntervalMin as (typeof INTERVAL_OPTIONS)[number]}
            onChange={(v) => setDraft({ ...draft, reminderIntervalMin: v })} label={(v) => `${v} min`} />
          <Stepper theme={theme} label="Début" value={formatHM(draft.reminderStartMin)} onMinus={() => moveStart(-RANGE_STEP_MIN)} onPlus={() => moveStart(RANGE_STEP_MIN)}
            minusDisabled={draft.reminderStartMin <= 0} plusDisabled={draft.reminderStartMin >= 23 * 60 + 30} />
          <Stepper theme={theme} label="Fin" value={formatHM(draft.reminderEndMin)} onMinus={() => moveEnd(-RANGE_STEP_MIN)} onPlus={() => moveEnd(RANGE_STEP_MIN)}
            minusDisabled={draft.reminderEndMin <= draft.reminderStartMin} plusDisabled={draft.reminderEndMin >= 24 * 60 - RANGE_STEP_MIN} />
          <Hint theme={theme}>{reminderSummary(draft)}</Hint>
        </>
      )}
    </Sheet>
  );
}

// ─── Taille de verre (E05) ───────────────────────────────────────────────────

export function GlassSheet({
  theme, visible, settings, saving, onClose, onSave,
}: { theme: Theme; visible: boolean; settings: HydrationSettings; saving?: boolean; onClose: () => void; onSave: (s: HydrationSettings) => void }) {
  const [glass, setGlass] = useState(settings.glassMl);
  useEffect(() => { if (visible) setGlass(settings.glassMl); }, [visible, settings.glassMl]);
  return (
    <Sheet theme={theme} visible={visible} title="Taille de verre par défaut" onClose={onClose} saving={saving}
      onSave={() => onSave({ ...settings, glassMl: glass })}>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {GLASS_OPTIONS.map((g) => {
          const sel = g === glass;
          return (
            <TouchableOpacity
              key={g}
              onPress={() => setGlass(g)}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`${g} ml${sel ? ', choisi' : ''}`}
              style={{
                width: '31%', minHeight: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                borderWidth: sel ? 2 : 1, borderColor: sel ? getActionPrimary(theme) : theme.border,
                backgroundColor: sel ? '#FFF0E8' : theme.surface,
              }}
            >
              <Ionicons name={sel ? 'checkmark-circle' : 'water'} size={20} color={sel ? TEXT_ORANGE : WATER} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: sel ? TEXT_ORANGE : theme.text }}>{g} ml</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Hint theme={theme}>
        Quantité ajoutée par « J'ai bu » dans un rappel et par l'assistant quand tu ne précises pas de quantité.
      </Hint>
    </Sheet>
  );
}

// ─── Café et thé (E06) ───────────────────────────────────────────────────────

export function CoffeeSheet({
  theme, visible, settings, saving, onClose, onSave,
}: { theme: Theme; visible: boolean; settings: HydrationSettings; saving?: boolean; onClose: () => void; onSave: (s: HydrationSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => { if (visible) setDraft(settings); }, [visible, settings]);
  return (
    <Sheet theme={theme} visible={visible} title="Compter le café et le thé" onClose={onClose} saving={saving} onSave={() => onSave(draft)}>
      <SwitchRow theme={theme} label="Compter le café et le thé" value={draft.countCoffeeTea} onChange={(v) => setDraft({ ...draft, countCoffeeTea: v })} />
      {draft.countCoffeeTea && (
        <>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginTop: 12, marginBottom: 8 }}>Part comptée</Text>
          <Segment theme={theme} options={COFFEE_PCT_OPTIONS} value={draft.coffeeTeaPct as (typeof COFFEE_PCT_OPTIONS)[number]}
            onChange={(v) => setDraft({ ...draft, coffeeTeaPct: v })} label={(v) => `${v} %`} />
          <Hint theme={theme}>{`250 ml ajoute ${coffeeCountedMl(250, draft)} ml.`}</Hint>
        </>
      )}
    </Sheet>
  );
}

// ─── Bonus jour de séance (E07) ──────────────────────────────────────────────

export function BonusSheet({
  theme, visible, settings, baseGoalMl, saving, onClose, onSave,
}: { theme: Theme; visible: boolean; settings: HydrationSettings; baseGoalMl: number; saving?: boolean; onClose: () => void; onSave: (s: HydrationSettings) => void }) {
  const [bonus, setBonus] = useState(settings.workoutBonusMl);
  useEffect(() => { if (visible) setBonus(settings.workoutBonusMl); }, [visible, settings.workoutBonusMl]);
  return (
    <Sheet theme={theme} visible={visible} title="Bonus jour de séance" onClose={onClose} saving={saving}
      onSave={() => onSave({ ...settings, workoutBonusMl: bonus })}>
      <Stepper theme={theme} label="Bonus" value={formatMl(bonus)} display={`+${bonus} ml`}
        onMinus={() => setBonus((b) => Math.max(0, b - BONUS_STEP_ML))} onPlus={() => setBonus((b) => Math.min(BONUS_MAX_ML, b + BONUS_STEP_ML))}
        minusDisabled={bonus <= 0} plusDisabled={bonus >= BONUS_MAX_ML} />
      <Hint theme={theme}>
        {`${formatLitres(baseGoalMl)} + ${formatLitres(bonus)} = ${formatLitres(baseGoalMl + bonus)} les jours où tu enregistres une séance.`}
      </Hint>
    </Sheet>
  );
}

// ─── Objectif quotidien (E08, HYDR-06) ───────────────────────────────────────

export function GoalSheet({
  theme, visible, goalMl, saving, onClose, onSave,
}: { theme: Theme; visible: boolean; goalMl: number; saving?: boolean; onClose: () => void; onSave: (goal: number) => void }) {
  const [raw, setRaw] = useState(String(goalMl));
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (visible) { setRaw(String(goalMl)); setTouched(false); } }, [visible, goalMl]);
  const v = validateGoalMl(raw);
  const showError = !v.ok && (touched || raw.length > 0);
  return (
    <Sheet theme={theme} visible={visible} title="Objectif quotidien" onClose={onClose} saving={saving}
      saveDisabled={!v.ok} onSave={() => { if (v.ok && v.value != null) onSave(v.value); }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 6 }}>Objectif en ml</Text>
      <TextInput
        value={raw}
        onChangeText={(t) => { setRaw(t.replace(/[^0-9]/g, '')); setTouched(true); }}
        keyboardType="number-pad"
        accessibilityLabel="Objectif quotidien en millilitres"
        placeholder={`${GOAL_MIN_ML}-${GOAL_MAX_ML}`}
        placeholderTextColor={theme.muted}
        autoFocus
        style={{
          minHeight: 52, backgroundColor: theme.background, borderRadius: 12,
          borderWidth: showError ? 2 : 1, borderColor: showError ? '#B3261E' : theme.border,
          paddingHorizontal: 16, fontSize: 17, color: theme.text,
        }}
      />
      {showError ? (
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 14, color: '#B3261E', marginTop: 6 }}>{v.error}</Text>
      ) : (
        <Text style={{ fontSize: 14, color: theme.muted, marginTop: 6 }}>{`Soit ${formatLitres(v.value ?? 0)}`}</Text>
      )}
      <Hint theme={theme}>{`Plage conseillée ${GOAL_MIN_ML} à ${GOAL_MAX_ML} ml.`}</Hint>
    </Sheet>
  );
}

// ─── Quantité personnalisée / café ou thé ────────────────────────────────────

export function AmountSheet({
  theme, visible, title, hint, saveLabel, onClose, onSave,
}: { theme: Theme; visible: boolean; title: string; hint?: (ml: number | null) => string; saveLabel: string; onClose: () => void; onSave: (ml: number) => void }) {
  const [raw, setRaw] = useState('');
  useEffect(() => { if (visible) setRaw(''); }, [visible]);
  const ml = validateAmountMl(raw);
  return (
    <Sheet theme={theme} visible={visible} title={title} onClose={onClose} saveLabel={saveLabel} saveDisabled={ml == null}
      onSave={() => { if (ml != null) onSave(ml); }}>
      <TextInput
        value={raw}
        onChangeText={(t) => setRaw(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        accessibilityLabel="Quantité en millilitres"
        placeholder="Quantité en ml (ex : 250)"
        placeholderTextColor={theme.muted}
        autoFocus
        style={{
          minHeight: 52, backgroundColor: theme.background, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
          paddingHorizontal: 16, fontSize: 17, color: theme.text,
        }}
      />
      {hint ? <Hint theme={theme}>{hint(ml)}</Hint> : null}
    </Sheet>
  );
}
