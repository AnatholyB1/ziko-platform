import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeStore, showAlert, formatDateFr } from '@ziko/plugin-sdk';
import { usePantryStore } from '../store';
import BarcodeScanner from './BarcodeScanner';
import type { BarcodeProduct } from '../utils/barcode';
import { COPY } from '../utils/copy';
import { dateToLocalISO, LOCATIONS, UNIT_LABEL, type FoodCategory, type PantryUnit, type StorageLocation } from '../utils/pantryLogic';
import { PrimaryButton, SecondaryButton } from '../components/parts';

const UNITS: PantryUnit[] = ['g', 'kg', 'ml', 'L', 'pieces', 'can', 'box', 'bag'];

const CATEGORIES: Array<{ id: FoodCategory; label: string }> = [
  { id: 'fruits', label: 'Fruits' },
  { id: 'vegetables', label: 'Légumes' },
  { id: 'meat', label: 'Viande' },
  { id: 'fish_seafood', label: 'Poisson' },
  { id: 'dairy', label: 'Produits laitiers' },
  { id: 'eggs', label: 'Oeufs' },
  { id: 'grains_pasta', label: 'Féculents' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'drinks', label: 'Boissons' },
  { id: 'other', label: 'Autre' },
];

/** `2026-11-14` -> Date locale (new Date('YYYY-MM-DD') serait UTC et decalerait d'un jour a l'ouest de Greenwich). */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function PantryItemForm({
  supabase,
  mode,
  itemId,
  autoScan = false,
}: {
  supabase: any;
  mode: 'add' | 'edit';
  itemId?: string;
  /** Ouvre le scanner des l'affichage (chemin "Scanner un code-barres" de l'etat vide). */
  autoScan?: boolean;
}) {
  const { addItem, updateItem, removeItem } = usePantryStore();
  const theme = useThemeStore((s) => s.theme);

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<string>('g');
  const [foodCategory, setFoodCategory] = useState<string>('other');
  const [storageLocation, setStorageLocation] = useState<string>('fridge');
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(mode === 'add' && autoScan);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadingItem, setLoadingItem] = useState(false);
  const [prefill, setPrefill] = useState<{ code: string; kcal: number | null } | null>(null);

  useEffect(() => {
    if (mode === 'edit' && itemId) {
      setLoadingItem(true);
      supabase
        .from('ziko_pantry_items')
        .select('*')
        .eq('id', itemId)
        .single()
        .then(({ data, error }: { data: any; error: any }) => {
          if (!error && data) {
            setName(data.name ?? '');
            setQuantity(String(data.quantity ?? ''));
            setUnit(data.unit ?? 'g');
            setFoodCategory(data.food_category ?? 'other');
            setStorageLocation(data.storage_location ?? 'fridge');
            setExpirationDate(data.expiration_date ? parseLocalDate(data.expiration_date) : null);
            setLowStockThreshold(data.low_stock_threshold != null ? String(data.low_stock_threshold) : '');
          }
          setLoadingItem(false);
        });
    }
  }, [mode, itemId]);

  // Le scan pre-remplit nom + quantite + unite + categorie ; la date de peremption reste a choisir (D-02).
  const applyScan = (p: BarcodeProduct) => {
    setName(p.name);
    setQuantity(String(p.quantity));
    setUnit(p.unit);
    setFoodCategory(p.food_category);
    setPrefill({ code: p.barcode, kcal: p.kcal100g });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert(COPY.errorTitle, COPY.validationName);
      return;
    }
    const qty = parseFloat(quantity.replace(',', '.'));
    if (!quantity || isNaN(qty) || qty <= 0) {
      showAlert(COPY.errorTitle, COPY.validationQuantity);
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        name: name.trim(),
        quantity: qty,
        unit,
        storage_location: storageLocation,
        food_category: foodCategory,
        expiration_date: expirationDate ? dateToLocalISO(expirationDate) : null,
        low_stock_threshold: lowStockThreshold ? parseFloat(lowStockThreshold.replace(',', '.')) : 1,
      };

      if (mode === 'add') {
        const { data, error } = await supabase
          .from('ziko_pantry_items')
          .insert({ ...payload, user_id: user.id })
          .select('*')
          .single();
        if (error) throw error;
        addItem(data);
      } else {
        const { data, error } = await supabase.from('ziko_pantry_items').update(payload).eq('id', itemId).select('*').single();
        if (error) throw error;
        updateItem(itemId!, data);
      }
      router.back();
    } catch {
      showAlert(COPY.errorTitle, COPY.errorSave);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    showAlert(COPY.deleteTitle, COPY.deleteBody, [
      { text: COPY.cancel, style: 'cancel' },
      {
        text: COPY.delete,
        style: 'destructive',
        onPress: async () => {
          await supabase.from('ziko_pantry_items').delete().eq('id', itemId);
          removeItem(itemId!);
          router.back();
        },
      },
    ]);
  };

  const chip = (value: string, label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={value}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{
        minHeight: 44,
        justifyContent: 'center',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.primary : theme.border,
        backgroundColor: selected ? theme.primarySubtle : theme.surface,
        borderRadius: 22,
        paddingHorizontal: 16,
        marginRight: 8,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: selected ? '700' : '500', color: theme.text }}>{label}</Text>
    </TouchableOpacity>
  );

  const inputStyle = {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    backgroundColor: theme.surface,
    fontSize: 16,
    color: theme.text,
    marginBottom: 16,
  };
  const labelStyle = { fontSize: 14, fontWeight: '700' as const, color: theme.text, marginBottom: 8 };

  if (loadingItem) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={COPY.formBack}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800', color: theme.text, flex: 1 }}>
              {mode === 'add' ? COPY.formAddTitle : COPY.formEditTitle}
            </Text>
            {mode === 'edit' ? (
              <TouchableOpacity onPress={handleDelete} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#B5301F' }}>{COPY.delete}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {prefill ? (
            <View
              accessibilityLiveRegion="polite"
              style={{
                flexDirection: 'row',
                gap: 10,
                alignItems: 'flex-start',
                backgroundColor: '#E8F0FD',
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Ionicons name="information-circle" size={20} color="#2563C9" />
              <Text style={{ flex: 1, fontSize: 14, color: theme.text, lineHeight: 20 }}>{COPY.prefillBanner(prefill.code)}</Text>
            </View>
          ) : (
            <View style={{ marginBottom: 16 }}>
              <SecondaryButton label={COPY.scanButton} icon="barcode-outline" onPress={() => setShowCamera(true)} />
            </View>
          )}

          <Text style={labelStyle}>{COPY.fieldName}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={COPY.fieldNamePlaceholder}
            placeholderTextColor={theme.muted}
            accessibilityLabel={COPY.fieldName}
            autoFocus={mode === 'add' && !autoScan}
            style={inputStyle}
          />

          <Text style={labelStyle}>{COPY.fieldQuantity}</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0"
            placeholderTextColor={theme.muted}
            accessibilityLabel={COPY.fieldQuantity}
            keyboardType="decimal-pad"
            style={inputStyle}
          />
          {prefill?.kcal != null ? (
            <Text style={{ fontSize: 14, color: theme.muted, marginTop: -8, marginBottom: 16 }}>{COPY.prefillKcal(prefill.kcal)}</Text>
          ) : null}

          <Text style={labelStyle}>{COPY.fieldUnit}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {UNITS.map((u) => chip(u, UNIT_LABEL[u] ?? u, unit === u, () => setUnit(u)))}
          </ScrollView>

          <Text style={labelStyle}>{COPY.fieldCategory}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {CATEGORIES.map((c) => chip(c.id, c.label, foodCategory === c.id, () => setFoodCategory(c.id)))}
          </ScrollView>

          <Text style={labelStyle}>{COPY.fieldLocation}</Text>
          <View
            style={{
              flexDirection: 'row',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            {LOCATIONS.map((loc, idx) => {
              const active = storageLocation === (loc.id as StorageLocation);
              return (
                <TouchableOpacity
                  key={loc.id}
                  onPress={() => setStorageLocation(loc.id)}
                  accessibilityRole="button"
                  accessibilityLabel={loc.label}
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? theme.primarySubtle : theme.surface,
                    borderLeftWidth: idx > 0 ? 1 : 0,
                    borderLeftColor: theme.border,
                    borderBottomWidth: 3,
                    borderBottomColor: active ? theme.primary : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: theme.text }}>{loc.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={labelStyle}>{COPY.fieldExpiry}</Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(!showDatePicker)}
            accessibilityRole="button"
            accessibilityLabel={`${COPY.fieldExpiry} : ${expirationDate ? formatDateFr(expirationDate) : COPY.fieldExpiryNone}`}
            style={{
              minHeight: 48,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              backgroundColor: theme.surface,
              marginBottom: 8,
            }}
          >
            <Ionicons name="calendar-outline" size={18} color={theme.muted} />
            <Text style={{ fontSize: 16, color: expirationDate ? theme.text : theme.muted }}>
              {expirationDate ? formatDateFr(expirationDate) : COPY.fieldExpiryNone}
            </Text>
          </TouchableOpacity>
          {showDatePicker ? (
            <DateTimePicker
              value={expirationDate || new Date()}
              mode="date"
              display="default"
              onChange={(_event: any, selected?: Date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selected) setExpirationDate(selected);
              }}
            />
          ) : null}
          {expirationDate ? (
            <TouchableOpacity onPress={() => setExpirationDate(null)} style={{ minHeight: 44, justifyContent: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: theme.muted, textDecorationLine: 'underline' }}>{COPY.fieldExpiryClear}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginBottom: 8 }} />
          )}

          <Text style={labelStyle}>{COPY.fieldThreshold}</Text>
          <TextInput
            value={lowStockThreshold}
            onChangeText={setLowStockThreshold}
            placeholder={COPY.fieldThresholdPlaceholder}
            placeholderTextColor={theme.muted}
            accessibilityLabel={COPY.fieldThreshold}
            keyboardType="decimal-pad"
            style={inputStyle}
          />

          <PrimaryButton
            label={saving ? '...' : mode === 'add' ? COPY.saveAdd : COPY.saveEdit}
            disabled={saving}
            onPress={handleSave}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <BarcodeScanner
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onScan={applyScan}
        onManual={() => setPrefill(null)}
      />
    </SafeAreaView>
  );
}
