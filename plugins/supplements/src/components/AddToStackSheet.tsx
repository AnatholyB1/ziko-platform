import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { BottomSheet, Chip, PrimaryButton, Stepper, ACCENT_TEXT } from './ui';
import { MOMENTS, MOMENT_LABEL, defaultDose, formatDose, stepDose, toggleMoment, type Moment } from '../lib/moments';
import { upsertStackItem, validateStackInput } from '../lib/data';

export interface AddToStackTarget {
  supplementId: string;
  name: string;
  servingSize?: string | null;
  // Presents en modification d'une ligne existante.
  dose?: number;
  doseUnit?: string | null;
  moments?: Moment[];
}

/** C16 : dose (stepper) + un ou plusieurs moments (puces multi-choix), enregistrement en un tap. */
export default function AddToStackSheet({
  supabase,
  userId,
  target,
  onClose,
  onSaved,
}: {
  supabase: any;
  userId: string | null;
  target: AddToStackTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const [dose, setDose] = useState(1);
  const [unit, setUnit] = useState<string>('dose');
  const [moments, setMoments] = useState<Moment[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    if (target.dose !== undefined) {
      setDose(target.dose);
      setUnit(target.doseUnit ?? 'dose');
      setMoments(target.moments ?? []);
    } else {
      const d = defaultDose(target.servingSize);
      setDose(d.dose);
      setUnit(d.unit);
      setMoments([]);
    }
    setSaving(false);
  }, [target]);

  const editing = target?.dose !== undefined;
  const problem = target ? validateStackInput({ supplementId: target.supplementId, dose, doseUnit: unit, moments }) : null;

  const save = async () => {
    if (!target || !userId) return;
    setSaving(true);
    try {
      await upsertStackItem(supabase, userId, { supplementId: target.supplementId, dose, doseUnit: unit, moments });
      onSaved();
      onClose();
    } catch (e: any) {
      setSaving(false);
      showAlert('Enregistrement impossible', e?.message ?? 'Réessaie dans un instant.');
    }
  };

  return (
    <BottomSheet
      visible={!!target}
      onClose={onClose}
      title={editing ? 'Modifier dans mon stack' : 'Ajouter à mon stack'}
    >
      {target ? (
        <View>
          <Text style={{ color: theme.muted, fontSize: 13.5, marginBottom: 18 }} numberOfLines={2}>
            {target.name}
          </Text>

          <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '700', marginBottom: 8 }}>Dose par prise</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <Stepper
              testID="supp-dose-stepper"
              valueLabel={formatDose(dose, unit)}
              onMinus={() => setDose((d) => stepDose(d, unit, -1))}
              onPlus={() => setDose((d) => stepDose(d, unit, 1))}
              minusLabel="Diminuer la dose"
              plusLabel="Augmenter la dose"
            />
          </View>

          <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '700', marginBottom: 8 }}>Moment de la prise</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {MOMENTS.map((m) => (
              <Chip
                key={m}
                testID={`supp-moment-${m}`}
                label={MOMENT_LABEL[m]}
                selected={moments.includes(m)}
                onPress={() => setMoments((cur) => toggleMoment(cur, m))}
              />
            ))}
          </View>
          <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 20 }}>
            Plusieurs moments possibles : touche pour en ajouter ou en retirer.
          </Text>

          {moments.length === 0 ? (
            <Text style={{ color: ACCENT_TEXT, fontSize: 12.5, fontWeight: '600', marginBottom: 10 }}>
              Choisis au moins un moment pour enregistrer.
            </Text>
          ) : null}
          <PrimaryButton
            testID="supp-stack-save"
            label={editing ? 'Enregistrer' : 'Ajouter au stack'}
            onPress={save}
            disabled={!!problem || !userId}
            loading={saving}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}
