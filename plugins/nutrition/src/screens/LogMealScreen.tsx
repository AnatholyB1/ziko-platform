import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNutritionStore } from '../store';
import { useThemeStore, useTranslation, showAlert } from '@ziko/plugin-sdk';
import ScoreBadge from '../components/ScoreBadge';
import { getOrFetchProduct, FoodProduct } from '../utils/offApi';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = typeof MEAL_TYPES[number];

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_g: number;
  brand?: string;
}

interface CustomEntry {
  name: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  serving_g: string;
}

const EMPTY_CUSTOM: CustomEntry = {
  name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', serving_g: '100',
};

export default function LogMealScreen({ supabase }: { supabase: any }) {
  const { addLog, selectedDate } = useNutritionStore();
  const theme = useThemeStore((s) => s.theme);
  const { t, tMeal, locale } = useTranslation();
  const [tab, setTab] = useState<'search' | 'scan' | 'barcode' | 'custom'>('search');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState<CustomEntry>(EMPTY_CUSTOM);
  const [saving, setSaving] = useState(false);

  // Scan tab state
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanResults, setScanResults] = useState<Array<{
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    serving_g: number;
    confidence: string;
  }> | null>(null);
  const [scanDescription, setScanDescription] = useState('');

  // Barcode tab state
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const [barcodeProduct, setBarcodeProduct] = useState<FoodProduct | null>(null);
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [barcodeScannedCode, setBarcodeScannedCode] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [servingGrams, setServingGrams] = useState(100);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const tb = setTimeout(async () => {
      setLoading(true);
      let req = supabase.from('food_database').select('*').limit(30);
      req = req.ilike('name', `%${query}%`);
      const { data } = await req;
      setResults((data ?? []) as FoodItem[]);
      setLoading(false);
    }, 400);
    return () => clearTimeout(tb);
  }, [query]);

  // Request camera permission when barcode tab is focused
  useEffect(() => {
    if (tab === 'barcode' && !permission?.granted) {
      requestPermission();
    }
  }, [tab, permission]);

  const saveLog = async (entry: Omit<any, 'id' | 'created_at'>) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showAlert(t('general.error'), t('nutrition.notAuth')); setSaving(false); return; }
    const { data, error } = await supabase.from('nutrition_logs').insert({
      ...entry,
      user_id: user.id,
      date: selectedDate,
      meal_type: mealType,
    }).select().single();
    setSaving(false);
    if (error) { showAlert(t('general.error'), error.message); return; }
    addLog(data);
    router.back();
  };

  const logFood = (food: FoodItem) => {
    saveLog({
      food_name: food.name,
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      serving_g: food.serving_g,
    });
  };

  const submitCustom = () => {
    if (!custom.name.trim() || !custom.calories) {
      showAlert(t('general.required'), t('nutrition.required'));
      return;
    }
    saveLog({
      food_name: custom.name.trim(),
      calories: parseFloat(custom.calories) || 0,
      protein_g: parseFloat(custom.protein_g) || 0,
      carbs_g: parseFloat(custom.carbs_g) || 0,
      fat_g: parseFloat(custom.fat_g) || 0,
      serving_g: parseFloat(custom.serving_g) || 100,
    });
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t('nutrition.permRequired'), t('nutrition.permCamera'));
        return;
      }
      result = await ImagePicker.launchCameraAsync({ base64: false, quality: 0.7 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t('nutrition.permRequired'), t('nutrition.permGallery'));
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ base64: false, quality: 0.7 });
    }
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setScanImage(asset.uri);
    setScanResults(null);
    setScanDescription('');
    analyzeImage(asset.uri);
  };

  const analyzeImage = async (uri: string) => {
    setAnalyzing(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const userId = session?.user?.id;
      if (!token || !userId) {
        showAlert(t('general.error'), t('nutrition.notAuth'));
        setAnalyzing(false);
        return;
      }

      // Step 1: get signed upload URL for scan-photos bucket (per D-22)
      const scanPath = `${userId}/scan-${Date.now()}.jpg`;
      const urlRes = await fetch(
        `${apiUrl}/storage/upload-url?bucket=scan-photos&path=${scanPath}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!urlRes.ok) {
        showAlert(t('general.error'), 'Failed to get upload URL');
        setAnalyzing(false);
        return;
      }
      const { upload_url } = await urlRes.json();

      // Step 2: fetch blob from local URI and PUT to Supabase Storage (per D-22)
      const blobRes = await fetch(uri);
      const blob = await blobRes.blob();
      const putRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      if (!putRes.ok) {
        showAlert(t('general.error'), 'Photo upload failed');
        setAnalyzing(false);
        return;
      }

      // Step 3: POST storage_path to vision/nutrition (per D-22, no base64)
      const res = await fetch(`${apiUrl}/ai/vision/nutrition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ storage_path: scanPath, meal_context: mealType }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Analysis failed' }));
        showAlert('Error', err.error || 'Failed to analyze image');
        setAnalyzing(false);
        return;
      }

      const data = await res.json();
      setScanResults(data.foods ?? []);
      setScanDescription(data.description ?? '');
    } catch (e: any) {
      showAlert(t('general.error'), e.message || 'Network error');
    }
    setAnalyzing(false);
  };

  const logScanResult = (food: { food_name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; serving_g: number }) => {
    saveLog({
      food_name: food.food_name,
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      serving_g: food.serving_g,
    });
  };

  const editScanResult = (food: { food_name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; serving_g: number }) => {
    setCustom({
      name: food.food_name,
      calories: String(food.calories),
      protein_g: String(food.protein_g),
      carbs_g: String(food.carbs_g),
      fat_g: String(food.fat_g),
      serving_g: String(food.serving_g),
    });
    setTab('custom');
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setBarcodeScannedCode(data);
    setBarcodeLoading(true);
    setBarcodeProduct(null);
    setBarcodeNotFound(false);
    try {
      const product = await getOrFetchProduct(data, supabase);
      if (product) {
        setBarcodeProduct(product);
        setServingGrams(product.serving_size_g ?? 100);
      } else {
        setBarcodeNotFound(true);
      }
    } catch (e: any) {
      showAlert(t('general.error'), e.message || 'Network error');
      setBarcodeNotFound(true);
    }
    setBarcodeLoading(false);
  };

  const handleScanAgain = () => {
    scannedRef.current = false;
    setBarcodeProduct(null);
    setBarcodeNotFound(false);
    setBarcodeScannedCode('');
    setBarcodeLoading(false);
    setServingGrams(100);
  };

  const logBarcodeProduct = () => {
    if (!barcodeProduct) return;
    const ratio = servingGrams / 100;
    saveLog({
      food_name: barcodeProduct.name,
      calories: Math.round(barcodeProduct.energy_kcal * ratio),
      protein_g: +(barcodeProduct.proteins_g * ratio).toFixed(1),
      carbs_g: +(barcodeProduct.carbs_g * ratio).toFixed(1),
      fat_g: +(barcodeProduct.fat_g * ratio).toFixed(1),
      serving_g: servingGrams,
      food_product_id: barcodeProduct.id,
      nutriscore_grade: barcodeProduct.nutriscore_grade,
      ecoscore_grade: barcodeProduct.ecoscore_grade,
    });
  };

  const editBarcodeProduct = () => {
    if (!barcodeProduct) {
      setTab('custom');
      return;
    }
    const ratio = servingGrams / 100;
    editScanResult({
      food_name: barcodeProduct.name,
      calories: Math.round(barcodeProduct.energy_kcal * ratio),
      protein_g: +(barcodeProduct.proteins_g * ratio).toFixed(1),
      carbs_g: +(barcodeProduct.carbs_g * ratio).toFixed(1),
      fat_g: +(barcodeProduct.fat_g * ratio).toFixed(1),
      serving_g: servingGrams,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color="#7A7670" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: theme.text }}>{t('nutrition.logMeal')}</Text>
          {saving && <ActivityIndicator color={theme.primary} />}
        </View>

        {/* Meal type selector */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 }}>
          {MEAL_TYPES.map((mt) => (
            <TouchableOpacity key={mt} onPress={() => setMealType(mt)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: mealType === mt ? theme.primary : theme.surface, alignItems: 'center', borderWidth: 1, borderColor: mealType === mt ? theme.primary : theme.border }}>
              <Text style={{ color: mealType === mt ? '#fff' : theme.muted, fontSize: 12, fontWeight: '600' }}>{tMeal(mt)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab toggle */}
        <View style={{ flexDirection: 'row', marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {(['search', 'scan', 'barcode', 'custom'] as const).map((tb) => (
            <TouchableOpacity key={tb} onPress={() => setTab(tb)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: tab === tb ? theme.primary : 'transparent', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
              {tb === 'scan' && <Ionicons name="camera" size={14} color={tab === tb ? '#fff' : theme.muted} />}
              {tb === 'barcode' && <Ionicons name="barcode-outline" size={14} color={tab === tb ? '#fff' : theme.muted} />}
              <Text style={{ color: tab === tb ? '#fff' : theme.muted, fontWeight: '600', fontSize: 12 }}>
                {tb === 'custom' ? t('nutrition.custom') : tb === 'scan' ? t('nutrition.scan') : tb === 'barcode' ? t('nutrition.barcode') : t('nutrition.search')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'search' ? (
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('nutrition.searchFood')}
              placeholderTextColor="#7A7670"
              style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 12, color: theme.text, marginBottom: 12, fontSize: 15 }}
              autoFocus
            />

            {loading ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => logFood(item)}
                    style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                        {item.name}
                      </Text>
                      {item.brand && <Text style={{ color: theme.muted, fontSize: 11 }}>{item.brand}</Text>}
                      <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>
                        {item.serving_g}g · P{item.protein_g}g · C{item.carbs_g}g · F{item.fat_g}g
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.primary, fontWeight: '700' }}>{item.calories}</Text>
                      <Text style={{ color: theme.muted, fontSize: 11 }}>kcal</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  query ? <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 32 }}>{t('nutrition.noResults', { query })}</Text> : null
                }
              />
            )}
          </View>
        ) : tab === 'scan' ? (
          <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 100 }}>
            {!scanImage ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: theme.border }}>
                  <Ionicons name="camera-outline" size={44} color={theme.primary} />
                </View>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{t('nutrition.scanMeal')}</Text>
                <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', marginBottom: 32, paddingHorizontal: 20 }}>
                  {t('nutrition.scanDesc')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => pickImage('camera')}
                    style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                    <Ionicons name="camera" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('nutrition.camera')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => pickImage('gallery')}
                    style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: theme.border }}>
                    <Ionicons name="images" size={20} color={theme.primary} />
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{t('nutrition.gallery')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                {/* Image preview */}
                <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
                  <Image source={{ uri: scanImage }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
                </View>

                {/* Re-scan buttons */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  <TouchableOpacity onPress={() => { setScanImage(null); setScanResults(null); }}
                    style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}>
                    <Text style={{ color: theme.muted, fontWeight: '600', fontSize: 13 }}>{t('nutrition.newScan')}</Text>
                  </TouchableOpacity>
                </View>

                {analyzing ? (
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={{ color: theme.muted, marginTop: 12, fontSize: 14 }}>{t('nutrition.analyzing')}</Text>
                  </View>
                ) : scanResults ? (
                  <View>
                    {scanDescription ? (
                      <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 12, fontStyle: 'italic' }}>{scanDescription}</Text>
                    ) : null}

                    {scanResults.length === 0 ? (
                      <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 20 }}>{t('nutrition.noFood')}</Text>
                    ) : (
                      scanResults.map((food, i) => (
                        <View key={i} style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, flex: 1 }}>{food.food_name}</Text>
                            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: food.confidence === 'high' ? '#dcfce7' : food.confidence === 'medium' ? '#fef3c7' : '#fee2e2' }}>
                              <Text style={{ fontSize: 10, fontWeight: '600', color: food.confidence === 'high' ? '#16a34a' : food.confidence === 'medium' ? '#d97706' : '#dc2626' }}>{food.confidence}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                            <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>{food.calories} kcal</Text>
                            <Text style={{ color: theme.muted, fontSize: 12 }}>{food.serving_g}g serving</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                            {[
                              { label: t('macro.protein'), val: food.protein_g, color: '#3b82f6' },
                              { label: t('macro.carbs'), val: food.carbs_g, color: '#f59e0b' },
                              { label: t('macro.fat'), val: food.fat_g, color: '#ef4444' },
                            ].map((m) => (
                              <View key={m.label} style={{ flex: 1, backgroundColor: theme.background, borderRadius: 8, padding: 8, alignItems: 'center' }}>
                                <Text style={{ color: m.color, fontWeight: '700', fontSize: 14 }}>{m.val}g</Text>
                                <Text style={{ color: theme.muted, fontSize: 10 }}>{m.label}</Text>
                              </View>
                            ))}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => logScanResult(food)}
                              style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('nutrition.logThis')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => editScanResult(food)}
                              style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}>
                              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{t('nutrition.editThis')}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        ) : tab === 'barcode' ? (
          // Barcode tab
          permission && !permission.granted ? (
            // Permission denied state
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <Ionicons name="camera-outline" size={48} color={theme.muted} />
              <Text style={{ fontSize: 14, color: theme.muted, textAlign: 'center', marginTop: 12, paddingHorizontal: 32 }}>
                {t('nutrition.cameraPermDenied')}
              </Text>
            </View>
          ) : barcodeLoading ? (
            // Loading state
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : barcodeProduct ? (
            // Product found state
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20 }}>
              <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: theme.border }}>
                {/* Product photo */}
                {barcodeProduct.image_url ? (
                  <Image
                    source={{ uri: barcodeProduct.image_url }}
                    style={{ width: '100%', height: 180, borderRadius: 10 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ width: '100%', height: 180, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="nutrition-outline" size={64} color={theme.muted} />
                  </View>
                )}

                {/* Name and brand */}
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 12 }}>
                  {barcodeProduct.name}
                </Text>
                {barcodeProduct.brand ? (
                  <Text style={{ fontSize: 12, color: theme.muted }}>{barcodeProduct.brand}</Text>
                ) : null}

                {/* Score badges */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <ScoreBadge grade={barcodeProduct.nutriscore_grade} type="nutriscore" size="lg" />
                  <ScoreBadge grade={barcodeProduct.ecoscore_grade} type="ecoscore" size="lg" />
                </View>

                {/* Macros per 100g */}
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 16, marginBottom: 8 }}>
                  {t('nutrition.per100g')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[
                    { val: barcodeProduct.energy_kcal, unit: 'kcal' },
                    { val: barcodeProduct.proteins_g, unit: 'g P' },
                    { val: barcodeProduct.carbs_g, unit: 'g C' },
                    { val: barcodeProduct.fat_g, unit: 'g F' },
                  ].map((m, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{m.val}</Text>
                      <Text style={{ fontSize: 11, color: theme.muted }}>{m.unit}</Text>
                    </View>
                  ))}
                </View>

                {/* Serving size adjuster */}
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 16, marginBottom: 8 }}>
                  {t('nutrition.servingSize')}
                </Text>
                {/* Quick-select chips */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[50, 100, 150, 200].map((val) => (
                    <TouchableOpacity
                      key={val}
                      onPress={() => setServingGrams(val)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: servingGrams === val ? theme.primary : theme.border,
                        backgroundColor: servingGrams === val ? theme.primary + '18' : theme.surface,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: servingGrams === val ? theme.primary : theme.text }}>
                        {val}g
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* Stepper row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => setServingGrams((prev) => Math.max(1, prev - 5))}
                    style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    value={String(servingGrams)}
                    onChangeText={(text) => {
                      const parsed = parseInt(text, 10);
                      if (isNaN(parsed)) {
                        setServingGrams(100);
                      } else {
                        setServingGrams(Math.max(1, Math.min(1000, parsed)));
                      }
                    }}
                    keyboardType="numeric"
                    style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: theme.text, backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingVertical: 8 }}
                  />
                  <TouchableOpacity
                    onPress={() => setServingGrams((prev) => Math.min(1000, prev + 5))}
                    style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Scaled macros row */}
                {(() => {
                  const ratio = servingGrams / 100;
                  const scaledCal = Math.round(barcodeProduct.energy_kcal * ratio);
                  const scaledProtein = +(barcodeProduct.proteins_g * ratio).toFixed(1);
                  const scaledCarbs = +(barcodeProduct.carbs_g * ratio).toFixed(1);
                  const scaledFat = +(barcodeProduct.fat_g * ratio).toFixed(1);
                  return (
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, textAlign: 'center', marginTop: 12 }}>
                      {scaledCal} kcal · {scaledProtein}g P · {scaledCarbs}g C · {scaledFat}g F
                    </Text>
                  );
                })()}

                {/* Log this meal button */}
                <TouchableOpacity
                  onPress={logBarcodeProduct}
                  style={{ backgroundColor: theme.primary, borderRadius: 12, padding: 16, marginTop: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('nutrition.logThisMeal')}</Text>
                </TouchableOpacity>

                {/* Enter manually button */}
                <TouchableOpacity
                  onPress={editBarcodeProduct}
                  style={{ backgroundColor: 'transparent', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border, marginTop: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{t('nutrition.enterManually')}</Text>
                </TouchableOpacity>

                {/* Scan again link */}
                <TouchableOpacity onPress={handleScanAgain} style={{ paddingTop: 8, alignItems: 'center' }}>
                  <Text style={{ color: theme.muted, fontSize: 14 }}>{t('nutrition.scanAgain')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : barcodeNotFound ? (
            // Not found state
            <View style={{ flex: 1, paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 }}>
              <Ionicons name="barcode-outline" size={48} color={theme.muted} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 16, textAlign: 'center' }}>
                {t('nutrition.barcodeNotFound')}
              </Text>
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 8, textAlign: 'center' }}>
                {t('nutrition.barcodeNotFoundHint').replace('{barcode}', barcodeScannedCode)}
              </Text>
              <TouchableOpacity
                onPress={() => setTab('custom')}
                style={{ backgroundColor: theme.primary, borderRadius: 12, padding: 16, marginTop: 24, alignItems: 'center', width: '100%' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('nutrition.enterManually')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleScanAgain} style={{ paddingTop: 12, alignItems: 'center' }}>
                <Text style={{ color: theme.muted, fontSize: 14 }}>{t('nutrition.scanAgain')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Default: camera live
            <View style={{ flex: 1 }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
              />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
                <View style={{ width: 260, height: 120, borderRadius: 10, borderWidth: 2, borderColor: '#fff', backgroundColor: 'transparent' }} />
                <Text style={{ color: '#fff', fontSize: 14, marginTop: 12, textAlign: 'center' }}>
                  {t('nutrition.barcodeAlign')}
                </Text>
              </View>
            </View>
          )
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            {[
              { key: 'name', label: t('nutrition.foodName'), placeholder: 'e.g. Poulet grillé', keyboard: 'default' },
              { key: 'calories', label: t('nutrition.calories'), placeholder: '0', keyboard: 'numeric' },
              { key: 'serving_g', label: t('nutrition.serving'), placeholder: '100', keyboard: 'numeric' },
              { key: 'protein_g', label: t('nutrition.protein'), placeholder: '0', keyboard: 'numeric' },
              { key: 'carbs_g', label: t('nutrition.carbs'), placeholder: '0', keyboard: 'numeric' },
              { key: 'fat_g', label: t('nutrition.fat'), placeholder: '0', keyboard: 'numeric' },
            ].map(({ key, label, placeholder, keyboard }) => (
              <View key={key} style={{ marginBottom: 12 }}>
                <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 4 }}>{label}</Text>
                <TextInput
                  value={(custom as any)[key]}
                  onChangeText={(v) => setCustom((c) => ({ ...c, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor="#7A7670"
                  keyboardType={keyboard as any}
                  style={{ backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 10, color: theme.text, fontSize: 15 }}
                />
              </View>
            ))}

            <TouchableOpacity onPress={submitCustom} disabled={saving}
              style={{ backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8, opacity: saving ? 0.6 : 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('nutrition.saveEntry')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
