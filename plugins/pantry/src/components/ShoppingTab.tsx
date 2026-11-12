import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import type { ShoppingListItem } from '../types/shopping';
import { COPY } from '../utils/copy';
import { putAway } from '../utils/data';
import { computeMissing, formatQuantity, type PantryRow, type ShoppingRow } from '../utils/pantryLogic';
import { StateCard, useCardStyle, PrimaryButton } from './parts';

interface Props {
  supabase: any;
  userId: string | undefined;
  pantry: PantryRow[];
  rows: ShoppingListItem[];
  today: string;
  /** Recharge inventaire + liste apres une ecriture. */
  onChanged: () => void;
}

interface Line {
  key: string;
  name: string;
  sub: string;
  group: 'missing' | 'manual';
  auto: boolean;
  rowId?: string;
}

function CheckBox({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      testID="shopping-checkbox"
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          borderWidth: checked ? 0 : 2,
          borderColor: theme.muted,
          backgroundColor: checked ? getActionPrimary(theme) : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function ShoppingTab({ supabase, userId, pantry, rows, today, onChanged }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const card = useCardStyle();
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [putting, setPutting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Etat initial des coches : colonne `checked` quand elle existe.
  useEffect(() => {
    setChecked((prev) => {
      const next = { ...prev };
      for (const r of rows) if (r.checked && next[`row:${r.id}`] === undefined) next[`row:${r.id}`] = true;
      return next;
    });
  }, [rows]);

  const missing = useMemo(() => computeMissing(pantry, today), [pantry, today]);

  const lines: Line[] = useMemo(() => {
    const out: Line[] = [];
    for (const m of missing) {
      out.push({ key: `auto:${m.pantryItemId}`, name: m.name, sub: m.reason, group: 'missing', auto: true });
    }
    for (const r of rows) {
      if (r.source === 'manual') {
        const q = r.quantity != null && r.unit ? formatQuantity(r.quantity, r.unit) : '';
        out.push({ key: `row:${r.id}`, name: r.name, sub: q, group: 'manual', auto: false, rowId: r.id });
      } else {
        const sub = r.recipe_name ? COPY.shopForRecipe(r.recipe_name) : r.reason ?? '';
        out.push({ key: `row:${r.id}`, name: r.name, sub, group: 'missing', auto: false, rowId: r.id });
      }
    }
    return out;
  }, [missing, rows]);

  const missingLines = lines.filter((l) => l.group === 'missing');
  const manualLines = lines.filter((l) => l.group === 'manual');
  const checkedKeys = lines.filter((l) => checked[l.key]).map((l) => l.key);

  const toggle = async (line: Line) => {
    const next = !checked[line.key];
    setChecked((c) => ({ ...c, [line.key]: next }));
    if (line.rowId) {
      // Persistance best-effort (colonne `checked` ajoutee par la migration) ; l'etat local fait foi sinon.
      await supabase.from('ziko_shopping_list_items').update({ checked: next }).eq('id', line.rowId);
    }
  };

  const addManual = async () => {
    const name = draft.trim();
    if (!name || !userId) return;
    setAdding(true);
    const { error } = await supabase
      .from('ziko_shopping_list_items')
      .insert({ user_id: userId, name, quantity: 1, unit: 'pieces', source: 'manual' });
    setAdding(false);
    if (error) {
      showAlert(COPY.errorTitle, COPY.shopAddError);
      return;
    }
    setDraft('');
    onChanged();
  };

  const removeRow = async (line: Line) => {
    if (!line.rowId) return;
    const { error } = await supabase.from('ziko_shopping_list_items').delete().eq('id', line.rowId);
    if (error) {
      showAlert(COPY.errorTitle, COPY.actionError);
      return;
    }
    onChanged();
  };

  const ranger = async () => {
    if (!userId || checkedKeys.length === 0) return;
    setPutting(true);
    setDone(null);
    try {
      const autoChecked = missing.filter((m) => checked[`auto:${m.pantryItemId}`]);
      const rowsChecked: ShoppingRow[] = rows
        .filter((r) => checked[`row:${r.id}`])
        .map((r) => ({
          id: r.id,
          name: r.name,
          quantity: r.quantity,
          unit: r.unit,
          pantry_item_id: r.pantry_item_id,
          source: r.source,
          recipe_name: r.recipe_name,
        }));
      await putAway(supabase, userId, { autoChecked, rows: rowsChecked, pantry });
      const n = autoChecked.length + rowsChecked.length;
      setChecked({});
      setDone(COPY.shopPutDone(n));
      onChanged();
    } catch {
      showAlert(COPY.errorTitle, COPY.shopPutError);
    } finally {
      setPutting(false);
    }
  };

  const renderLine = (l: Line, idx: number) => {
    const isChecked = !!checked[l.key];
    return (
      <View
        key={l.key}
        style={{
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          paddingRight: 8,
          borderTopWidth: idx === 0 ? 0 : 1,
          borderTopColor: theme.border,
        }}
      >
        <CheckBox checked={isChecked} label={`${l.name}, ${isChecked ? COPY.checked : COPY.unchecked}`} onPress={() => toggle(l)} />
        <View style={{ flex: 1, paddingVertical: 8 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: isChecked ? theme.muted : theme.text,
              textDecorationLine: isChecked ? 'line-through' : 'none',
            }}
          >
            {l.name}
          </Text>
          {l.sub ? <Text style={{ fontSize: 14, color: theme.muted, marginTop: 2 }}>{l.sub}</Text> : null}
        </View>
        {l.group === 'manual' ? (
          <TouchableOpacity
            onPress={() => removeRow(l)}
            accessibilityRole="button"
            accessibilityLabel={`${COPY.shopRemoveLine} : ${l.name}`}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color={theme.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const group = (title: string, items: Line[]) =>
    items.length === 0 ? null : (
      <View style={{ marginTop: 16 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1, color: theme.muted, textTransform: 'uppercase', marginBottom: 8 }}
        >
          {title}
        </Text>
        <View style={{ ...card }}>{items.map(renderLine)}</View>
      </View>
    );

  return (
    <View style={{ marginTop: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          paddingLeft: 12,
        }}
      >
        <Ionicons name="add" size={20} color={theme.muted} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addManual}
          placeholder={COPY.shopAddPlaceholder}
          placeholderTextColor={theme.muted}
          accessibilityLabel={COPY.shopAddLabel}
          returnKeyType="done"
          style={{ flex: 1, fontSize: 15, color: theme.text, paddingHorizontal: 8, paddingVertical: 10 }}
        />
        {draft.trim() ? (
          <TouchableOpacity
            onPress={addManual}
            disabled={adding}
            accessibilityRole="button"
            accessibilityLabel={COPY.shopAddLabel}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-forward-circle" size={26} color={getActionPrimary(theme)} />
          </TouchableOpacity>
        ) : null}
      </View>

      {done ? (
        <Text accessibilityLiveRegion="polite" style={{ marginTop: 12, fontSize: 14, fontWeight: '600', color: '#17703D' }}>
          {done}
        </Text>
      ) : null}

      {lines.length === 0 ? (
        <StateCard icon="cart-outline" title={COPY.shopEmptyTitle} body={COPY.shopEmptyBody} />
      ) : (
        <>
          {group(COPY.shopMissingGroup, missingLines)}
          {group(COPY.shopManualGroup, manualLines)}
        </>
      )}

      {checkedKeys.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            label={putting ? COPY.shopPutting : COPY.shopPut(checkedKeys.length)}
            icon="file-tray-full-outline"
            disabled={putting}
            onPress={ranger}
          />
        </View>
      ) : null}
    </View>
  );
}
