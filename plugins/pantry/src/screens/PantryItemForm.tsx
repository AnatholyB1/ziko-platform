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
import { useCameraPermissions } from 'expo-camera';
import { useThemeStore, useTranslation, showAlert } from '@ziko/plugin-sdk';
import { usePantryStore } from '../store';
import BarcodeScanner from './BarcodeScanner';

// ── Field option definitions ─────────────────────────────

const UNITS = ['g', 'kg', 'ml', 'L', 'pieces', 'can', 'box', 'bag'] as const;
const UNIT_LABELS: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  L: 'L',
  pieces: 'pièces',
  can: 'canette',
  box: 'boîte',
  bag: 'sachet',
};

const CATEGORIES = [
  'fruits',
  'vegetables',
  'meat',
  'fish_seafood',
  'dairy',
  'eggs',
  'grains_pasta',
  'snacks',
  'drinks',
  'other',
] as const;

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  fruits: 'pantry.cat_fruits',
  vegetables: 'pantry.cat_vegetables',
  meat: 'pantry.cat_meat',
  fish_seafood: 'pantry.cat_fish_seafood',
  dairy: 'pantry.cat_dairy',
  eggs: 'pantry.cat_eggs',
  grains_pasta: 'pantry.cat_grains_pasta',
  snacks: 'pantry.cat_snacks',
  drinks: 'pantry.cat_drinks',
  other: 'pantry.cat_other',
};

// ── PantryItemForm ───────────────────────────────────────

export default function PantryItemForm({
  supabase,
  mode,
  itemId,
}: {
  supabase: any;
  mode: 'add' | 'edit';
  itemId?: string;
}) {
  const { addItem, updateItem, removeItem } = usePantryStore();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [, requestPermission] = useCameraPermissions();

  // Form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<string>('g');
  const [foodCategory, setFoodCategory] = useState<string>('other');
  const [storageLocation, setStorageLocation] = useState<string>('pantry');
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadingItem, setLoadingItem] = useState(false);

  // Load existing item for edit mode
  useEffect(() => {
    if (mode === 'edit' && itemId) {
      setLoadingItem(true);
      supabase
        .from('pantry_items')
        .select('*')
        .eq('id', itemId)
        .single()
        .then(({ data, error }: { data: any; error: any }) => {
          if (error || !data) {
            setLoadingItem(false);
            return;
          }
          setName(data.name ?? '');
          setQuantity(String(data.quantity ?? ''));
          setUnit(data.unit ?? 'g');
          setFoodCategory(data.food_category ?? 'other');
          setStorageLocation(data.storage_location ?? 'pantry');
          setExpirationDate(data.expiration_date ? new Date(data.expiration_date) : null);
          setLowStockThreshold(
            data.low_stock_threshold != null ? String(data.low_stock_threshold) : '',
          );
          setLoadingItem(false);
        });
    }
  }, [mode, itemId]);

  // ── Barcode scan handler ─────────────────────────────

  const handleBarcodeScanPress = async () => {
    const { status } = await requestPermission();
    if (status !== 'granted') {
      showAlert(t('pantry.camera_required'), t('pantry.camera_required_desc'));
      return;
    }
    setShowCamera(true);
  };

  // ── Save handler ─────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert(t('pantry.error_save_title'), t('pantry.validation_name'));
      return;
    }
    const qty = parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      showAlert(t('pantry.error_save_title'), t('pantry.validation_quantity'));
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
        expiration_date: expirationDate
          ? expirationDate.toISOString().split('T')[0]
          : null,
        low_stock_threshold: lowStockThreshold ? parseFloat(lowStockThreshold) : 1,
      };

      if (mode === 'add') {
        const { data, error } = await supabase
          .from('pantry_items')
          .insert({ ...payload, user_id: user.id })
          .select('*')
          .single();

        if (error) throw error;
        addItem(data);
      } else {
        const { data, error } = await supabase
          .from('pantry_items')
          .update(payload)
          .eq('id', itemId)
          .select('*')
          .single();

        if (error) throw error;
        updateItem(itemId!, data);
      }

      router.back();
    } catch {
      showAlert(t('pantry.error_save_title'), t('pantry.error_save'));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete handler ───────────────────────────────────

  const handleDelete = () => {
    showAlert(t('pantry.delete_title'), t('pantry.delete_body'), [
      { text: t('pantry.delete_cancel'), style: 'cancel' },
      {
        text: t('pantry.delete_confirm'),
        style: 'destructive',
        onPress: async () => {
          await supabase.from('pantry_items').delete().eq('id', itemId);
          removeItem(itemId!);
          router.back();
        },
      },
    ]);
  };

  // ── Chip component ───────────────────────────────────

  const renderChip = (
    value: string,
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={value}
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: selected ? theme.primary : theme.border,
        backgroundColor: selected ? theme.primary + '15' : theme.surface,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: selected ? '700' : '400',
          color: selected ? theme.primary : theme.muted,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const textInputStyle = {
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: theme.background,
    fontSize: 16,
    color: theme.text,
    marginBottom: 16,
  };

  const fieldLabelStyle = {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.text,
    marginBottom: 8,
  };

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}>
          {/* Form header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 16,
              marginBottom: 24,
            }}
          >
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
              <Ionicons name="chevron-back" size={24} color={theme.muted} />
            </TouchableOpacity>

            <Text
              style={{ fontSize: 22, fontWeight: '700', color: theme.text, flex: 1 }}
            >
              {mode === 'add' ? t('pantry.form_add_title') : t('pantry.form_edit_title')}
            </Text>

            {mode === 'edit' && (
              <TouchableOpacity onPress={handleDelete} style={{ padding: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#F44336' }}>
                  {t('pantry.delete')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 1. Barcode scan button */}
          <TouchableOpacity
            onPress={handleBarcodeScanPress}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: theme.surface,
              marginBottom: 16,
            }}
          >
            <Ionicons name="camera-outline" size={20} color={theme.primary} />
            <Text style={{ fontSize: 16, fontWeight: '400', color: theme.text }}>
              {t('pantry.scan_barcode')}
            </Text>
          </TouchableOpacity>

          {/* 2. Nom */}
          <Text style={fieldLabelStyle}>{t('pantry.field_name')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('pantry.field_name_placeholder')}
            placeholderTextColor={theme.muted}
            autoFocus={mode === 'add'}
            style={textInputStyle}
          />

          {/* 3. Quantite */}
          <Text style={fieldLabelStyle}>{t('pantry.field_quantity')}</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder={t('pantry.field_quantity_placeholder')}
            placeholderTextColor={theme.muted}
            keyboardType="numeric"
            style={textInputStyle}
          />

          {/* 4. Unite — horizontal chips */}
          <Text style={fieldLabelStyle}>{t('pantry.field_unit')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 16 }}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {UNITS.map((u) =>
              renderChip(u, UNIT_LABELS[u] ?? u, unit === u, () => setUnit(u)),
            )}
          </ScrollView>

          {/* 5. Categorie — horizontal chips */}
          <Text style={fieldLabelStyle}>{t('pantry.field_category')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 16 }}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {CATEGORIES.map((cat) =>
              renderChip(
                cat,
                t(CATEGORY_LABEL_KEYS[cat]),
                foodCategory === cat,
                () => setFoodCategory(cat),
              ),
            )}
          </ScrollView>

          {/* 6. Emplacement — segmented row */}
          <Text style={fieldLabelStyle}>{t('pantry.field_location')}</Text>
          <View
            style={{
              flexDirection: 'row',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.border,
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            {(['fridge', 'freezer', 'pantry'] as const).map((loc, idx) => {
              const active = storageLocation === loc;
              const locLabels = {
                fridge: t('pantry.location_fridge'),
                freezer: t('pantry.location_freezer'),
                pantry: t('pantry.location_pantry'),
              };
              return (
                <TouchableOpacity
                  key={loc}
                  onPress={() => setStorageLocation(loc)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    alignItems: 'center',
                    backgroundColor: active ? theme.primary : theme.surface,
                    borderLeftWidth: idx > 0 ? 1 : 0,
                    borderLeftColor: theme.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: active ? '#FFFFFF' : theme.muted,
                    }}
                  >
                    {locLabels[loc]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 7. Date d'expiration */}
          <Text style={fieldLabelStyle}>{t('pantry.field_expiry')}</Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(!showDatePicker)}
            style={{
              padding: 16,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 14,
              backgroundColor: theme.background,
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 16, color: expirationDate ? theme.text : theme.muted }}>
              {expirationDate
                ? expirationDate.toLocaleDateString('fr-FR')
                : t('pantry.field_expiry_none')}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={expirationDate || new Date()}
              mode="date"
              display="default"
              onChange={(_event: any, selectedDate?: Date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  setExpirationDate(selectedDate);
                }
              }}
            />
          )}
          {expirationDate && (
            <TouchableOpacity
              onPress={() => setExpirationDate(null)}
              style={{ marginBottom: 16 }}
            >
              <Text style={{ fontSize: 14, color: theme.muted, textDecorationLine: 'underline' }}>
                {t('pantry.field_expiry_none')}
              </Text>
            </TouchableOpacity>
          )}
          {!expirationDate && <View style={{ marginBottom: 16 }} />}

          {/* 8. Seuil stock bas */}
          <Text style={fieldLabelStyle}>{t('pantry.field_threshold')}</Text>
          <TextInput
            value={lowStockThreshold}
            onChangeText={setLowStockThreshold}
            placeholder={t('pantry.field_threshold_placeholder')}
            placeholderTextColor={theme.muted}
            keyboardType="numeric"
            style={textInputStyle}
          />

          {/* CTA button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                {mode === 'add' ? t('pantry.save_add') : t('pantry.save_edit')}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* BarcodeScanner modal */}
      <BarcodeScanner
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onScan={(scannedName) => setName(scannedName)}
        onNotFound={() =>
          showAlert(t('pantry.barcode_not_found_title'), t('pantry.barcode_not_found'))
        }
      />
    </SafeAreaView>
  );
}
