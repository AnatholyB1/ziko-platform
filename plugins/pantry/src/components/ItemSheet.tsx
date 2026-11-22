import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { COPY } from '../utils/copy';
import {
  LOCATION_LABEL, expiryBadge, formatQuantity, formatShortDateFr, locationOf, restockQuantity, stepQuantity, type PantryRow,
} from '../utils/pantryLogic';
import { TextBadge, SecondaryButton, PrimaryButton } from './parts';

interface Props {
  item: PantryRow | null;
  supabase: any;
  userId: string | undefined;
  today: string;
  onClose: () => void;
  /** Recharge l'inventaire apres une modification. */
  onChanged: () => void;
  onEdit: (id: string) => void;
}

/** Fiche article (B15) : quantite ajustable, peremption, Aux courses / Utiliser / Retirer. */
export default function ItemSheet({ item, supabase, userId, today, onClose, onChanged, onEdit }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const [qty, setQty] = useState<number>(item?.quantity ?? 0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setQty(item?.quantity ?? 0);
    setNotice(null);
  }, [item?.id]);

  if (!item) return null;
  const unit = String(item.unit);
  const badge = expiryBadge(item.expiration_date, today);

  const saveQuantity = async (next: number) => {
    const previous = qty;
    setQty(next); // optimiste
    setBusy(true);
    const { error } = await supabase.from('ziko_pantry_items').update({ quantity: next }).eq('id', item.id);
    setBusy(false);
    if (error) {
      setQty(previous);
      showAlert(COPY.errorTitle, COPY.actionError);
      return;
    }
    onChanged();
  };

  const toShopping = async () => {
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase.from('ziko_shopping_list_items').insert({
      user_id: userId,
      name: item.name,
      quantity: restockQuantity(item),
      unit,
      pantry_item_id: item.id,
      source: 'manual',
    });
    setBusy(false);
    if (error) {
      showAlert(COPY.errorTitle, COPY.shopAddError);
      return;
    }
    setNotice(COPY.addedToShopping);
  };

  const remove = () => {
    showAlert(COPY.removeTitle, COPY.removeBody, [
      { text: COPY.cancel, style: 'cancel' },
      {
        text: COPY.removeConfirm,
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('ziko_pantry_items').delete().eq('id', item.id);
          if (error) {
            showAlert(COPY.errorTitle, COPY.actionError);
            return;
          }
          onChanged();
          onClose();
        },
      },
    ]);
  };

  const stepper = (label: string, icon: 'remove' | 'add', dir: 1 | -1) => (
    <TouchableOpacity
      onPress={() => saveQuantity(stepQuantity(qty, unit, dir))}
      disabled={busy || (dir === -1 && qty <= 0)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: dir === -1 && qty <= 0 ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon} size={20} color={theme.text} />
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel={COPY.itemClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,26,23,0.45)' }}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 32,
            gap: 12,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border }} />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1, color: theme.muted, textTransform: 'uppercase' }}>
                {LOCATION_LABEL[locationOf(item)]}
              </Text>
              <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 2 }}>
                {item.name}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onEdit(item.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={COPY.itemEdit}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="create-outline" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 15, color: theme.muted }}>{COPY.itemQuantity}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {stepper(COPY.decrease, 'remove', -1)}
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ fontSize: 17, fontWeight: '700', color: theme.text, minWidth: 72, textAlign: 'center' }}
                >
                  {formatQuantity(qty, unit)}
                </Text>
                {stepper(COPY.increase, 'add', 1)}
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: theme.border }} />
            <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 15, color: theme.muted }}>{COPY.itemExpiry}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>
                  {item.expiration_date ? formatShortDateFr(item.expiration_date) : COPY.itemNoExpiry}
                </Text>
                {badge ? <TextBadge text={badge.text} tone={badge.tone} /> : null}
              </View>
            </View>
          </View>

          {notice ? (
            <Text accessibilityLiveRegion="polite" style={{ fontSize: 14, color: '#17703D', fontWeight: '600' }}>
              {notice}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SecondaryButton flex label={COPY.itemToShopping} icon="cart-outline" onPress={toShopping} />
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={COPY.itemUse}
                icon="checkmark"
                disabled={busy || qty <= 0}
                onPress={() => saveQuantity(stepQuantity(qty, unit, -1))}
              />
            </View>
          </View>
          <SecondaryButton danger label={COPY.itemRemove} icon="trash-outline" onPress={remove} />
        </View>
      </View>
    </Modal>
  );
}
