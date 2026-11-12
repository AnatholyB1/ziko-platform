import React from 'react';
import { View, Text, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { Card, Stepper } from '../../components/ui';
import { MOMENT_ICON, type StackEntry } from '../../lib/moments';
import { buildReminderSlots, formatProductCount, shiftTime, type ReminderPref } from '../../lib/reminders';
import type { SyncStatus } from '../../lib/notifications';
import { saveReminderPref } from '../../lib/data';

export const PREFS_KEY = 'supplement_reminder_prefs';

/** C17 : un rappel par creneau (interrupteur + heure), un creneau vide n'envoie rien. */
export default function RemindersTab({
  supabase,
  userId,
  stack,
  prefs,
  syncStatus,
}: {
  supabase: any;
  userId: string | null;
  stack: StackEntry[];
  prefs: ReminderPref[];
  syncStatus: SyncStatus | null;
}) {
  const theme = useThemeStore((s) => s.theme);
  const qc = useQueryClient();
  const slots = buildReminderSlots(stack, prefs);
  const denied = syncStatus === 'denied';

  const update = async (pref: ReminderPref) => {
    if (!userId) return;
    // Mise a jour optimiste : la reprogrammation des notifications suit le cache (voir SupplementsPlugin).
    const previous = prefs;
    qc.setQueryData([PREFS_KEY, userId], prefs.map((p) => (p.moment === pref.moment ? pref : p)));
    try {
      await saveReminderPref(supabase, userId, pref);
    } catch {
      qc.setQueryData([PREFS_KEY, userId], previous);
      showAlert('Rappel non enregistré', 'Vérifie ta connexion et réessaie.');
    }
  };

  return (
    <View>
      {denied ? (
        <Card style={{ marginBottom: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Ionicons name="notifications-off-outline" size={20} color={theme.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '700' }}>Notifications désactivées</Text>
            <Text style={{ color: theme.muted, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>
              Autorise les notifications de Ziko dans les réglages de ton téléphone pour recevoir les rappels.
            </Text>
          </View>
        </Card>
      ) : null}

      {slots.map((slot) => (
        <Card key={slot.moment} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name={MOMENT_ICON[slot.moment]} size={20} color={theme.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 15.5, fontWeight: '800' }}>{slot.label}</Text>
              <Text style={{ color: theme.muted, fontSize: 12.5, marginTop: 1 }}>{formatProductCount(slot.productCount)}</Text>
            </View>
            <Switch
              testID={`supp-reminder-switch-${slot.moment}`}
              accessibilityLabel={`Rappel ${slot.label}`}
              value={slot.enabled && !denied}
              disabled={denied}
              onValueChange={(enabled) => update({ moment: slot.moment, enabled, remindTime: slot.time })}
              trackColor={{ false: theme.border, true: getActionPrimary(theme) }}
              thumbColor="#FFFFFF"
            />
          </View>

          {slot.enabled && !denied ? (
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.muted, fontSize: 12.5, fontWeight: '600' }}>Heure du rappel</Text>
              <Stepper
                testID={`supp-reminder-time-${slot.moment}`}
                valueLabel={slot.time}
                minusLabel={`Reculer l'heure du rappel ${slot.label}`}
                plusLabel={`Avancer l'heure du rappel ${slot.label}`}
                onMinus={() => update({ moment: slot.moment, enabled: true, remindTime: shiftTime(slot.time, -15) })}
                onPlus={() => update({ moment: slot.moment, enabled: true, remindTime: shiftTime(slot.time, 15) })}
              />
            </View>
          ) : (
            <Text style={{ color: theme.muted, fontSize: 12.5, marginTop: 10 }}>Rappel désactivé</Text>
          )}

          {slot.enabled && !denied && slot.productCount === 0 ? (
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 8 }}>
              Aucun produit sur ce moment : aucune notification ne sera envoyée.
            </Text>
          ) : null}
        </Card>
      ))}

      <Text style={{ color: theme.muted, fontSize: 12.5, lineHeight: 18, marginTop: 4 }}>
        Un seul rappel par moment, qui liste les produits à prendre. Un créneau sans produit n'envoie rien.
      </Text>
    </View>
  );
}
