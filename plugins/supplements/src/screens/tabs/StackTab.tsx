import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { Card, EmptyBlock, SecondaryButton, ACCENT_TEXT } from '../../components/ui';
import AddToStackSheet, { type AddToStackTarget } from '../../components/AddToStackSheet';
import { formatDose, formatMoments, type StackEntry } from '../../lib/moments';
import { removeStackItem } from '../../lib/data';
import { STACK_KEY } from '../../hooks';

/** C11 / C12 : uniquement les produits choisis, dose + moment en #B53D05, crayon pour modifier. */
export default function StackTab({
  supabase,
  userId,
  stack,
  loading,
  onBrowse,
  onChanged,
}: {
  supabase: any;
  userId: string | null;
  stack: StackEntry[];
  loading: boolean;
  onBrowse: () => void;
  onChanged: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AddToStackTarget | null>(null);

  if (loading) return <ActivityIndicator color={getActionPrimary(theme)} style={{ marginTop: 32 }} />;

  if (stack.length === 0) {
    return (
      <EmptyBlock
        icon="flask-outline"
        title="Ton stack est vide"
        message="Choisis un produit dans le Catalogue, règle la dose et le moment de prise. Il apparaîtra ici et dans Aujourd'hui."
        ctaLabel="Parcourir le catalogue"
        onCta={onBrowse}
      />
    );
  }

  const remove = (entry: StackEntry) => {
    showAlert('Retirer du stack ?', `${entry.name} ne sera plus proposé dans Aujourd'hui.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          if (!userId) return;
          try {
            await removeStackItem(supabase, userId, entry.supplementId);
            await qc.invalidateQueries({ queryKey: [STACK_KEY, userId] });
            onChanged();
          } catch {
            showAlert('Suppression impossible', 'Réessaie dans un instant.');
          }
        },
      },
    ]);
  };

  return (
    <View>
      <Text testID="supp-stack-count" style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 12 }}>
        {stack.length} produit{stack.length > 1 ? 's' : ''}
      </Text>

      <Card style={{ padding: 4, marginBottom: 16 }}>
        {stack.map((entry, i) => (
          <View
            key={entry.id}
            testID={`supp-stack-row-${entry.supplementId}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 64,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: theme.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>
                {entry.name}
              </Text>
              {entry.brandName ? (
                <Text style={{ color: theme.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                  {entry.brandName}
                </Text>
              ) : null}
              <Text style={{ color: ACCENT_TEXT, fontSize: 12.5, fontWeight: '600', marginTop: 2 }}>
                {formatDose(entry.dose, entry.doseUnit)} · {formatMoments(entry.moments)}
              </Text>
            </View>
            <TouchableOpacity
              testID={`supp-stack-edit-${entry.supplementId}`}
              accessibilityRole="button"
              accessibilityLabel={`Modifier ${entry.name}`}
              onPress={() =>
                setEditing({
                  supplementId: entry.supplementId,
                  name: entry.name,
                  dose: entry.dose,
                  doseUnit: entry.doseUnit,
                  moments: entry.moments,
                })
              }
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="create-outline" size={20} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${entry.name}`}
              onPress={() => remove(entry)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="trash-outline" size={19} color={theme.muted} />
            </TouchableOpacity>
          </View>
        ))}
      </Card>

      <SecondaryButton testID="supp-stack-add" label="Ajouter un produit" icon="add" onPress={onBrowse} />

      <AddToStackSheet
        supabase={supabase}
        userId={userId}
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          await qc.invalidateQueries({ queryKey: [STACK_KEY, userId] });
          onChanged();
        }}
      />
    </View>
  );
}
