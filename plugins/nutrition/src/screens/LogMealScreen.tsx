import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNutritionStore } from '../store';
import {
  useThemeStore, useTranslation, showAlert, useCreditStore, getActionPrimary,
  MEAL_TYPES, MEAL_METHODS, mealTypeForHour, formatClock, sumMacros, scaleFood, addLabel,
  buildInsertRows, groupByMeal, deriveRecents, dateKeyDaysAgo, localDateKey, RECENTS_WINDOW_DAYS, scanCostLabel,
  SCAN_CREDIT_COST, parsePending, enqueuePending, removePending, parsePrefs, saveMeal,
  type MealType, type MealMethod, type BasketItem, type PendingMeal, type MealPrefs,
} from '@ziko/plugin-sdk';
import ScoreBadge from '../components/ScoreBadge';
import { getOrFetchProduct, FoodProduct } from '../utils/offApi';

const PREFS_KEY = 'ziko:meal:prefs';
const PENDING_KEY = 'ziko:meal:pending';

// Awaitable credit earn helper — returns { credited } for toast triggering
async function earnCredit(supabase: any, source: string, key: string): Promise<{ credited: boolean }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { credited: false };
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    const res = await fetch(`${API_URL}/credits/earn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ source, idempotency_key: key }),
    });
    if (!res.ok) return { credited: false };
    const data = await res.json();
    return { credited: data.credited === true };
  } catch {
    return { credited: false };
  }
}

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

interface CustomEntry { name: string; calories: string; protein_g: string; carbs_g: string; fat_g: string }
const EMPTY_CUSTOM: CustomEntry = { name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' };

interface ScanFood {
  food_name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; serving_g: number; confidence: string;
}

const METHOD_ICON: Record<MealMethod, React.ComponentProps<typeof Ionicons>['name']> = {
  search: 'search', scan: 'camera', barcode: 'barcode-outline', custom: 'create-outline',
};

let keySeq = 0;
const nextKey = () => `b${Date.now()}_${keySeq++}`;

export default function LogMealScreen({ supabase, onSaved }: { supabase: any; onSaved?: () => void }) {
  const { addLog } = useNutritionStore();
  const goalKcal = useNutritionStore((s) => s.calorieGoal);
  const goalP = useNutritionStore((s) => s.proteinGoal);
  const goalC = useNutritionStore((s) => s.carbsGoal);
  const goalF = useNutritionStore((s) => s.fatGoal);
  const goals = { kcal: goalKcal, p: goalP, c: goalC, f: goalF };
  const theme = useThemeStore((s) => s.theme);
  const action = getActionPrimary(theme);
  const { t, tMeal } = useTranslation();

  const now = useMemo(() => new Date(), []);

  const [prefsReady, setPrefsReady] = useState(false);
  const [prefs, setPrefs] = useState<MealPrefs>({ lastMethod: 'search', lastMealType: null });
  const [mealType, setMealType] = useState<MealType>(() => mealTypeForHour(now.getHours()));
  const [method, setMethod] = useState<MealMethod>('search');

  const [userId, setUserId] = useState<string | null>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [recentRows, setRecentRows] = useState<any[]>([]);
  const [pending, setPending] = useState<PendingMeal[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);

  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [custom, setCustom] = useState<CustomEntry>(EMPTY_CUSTOM);
  const [focused, setFocused] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Photo
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanResults, setScanResults] = useState<ScanFood[] | null>(null);
  const [scanDescription, setScanDescription] = useState('');
  const scanScrollRef = useRef<ScrollView>(null);

  // Code-barres
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const [barcodeProduct, setBarcodeProduct] = useState<FoodProduct | null>(null);
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [barcodeScannedCode, setBarcodeScannedCode] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [servingGrams, setServingGrams] = useState(100);

  // ── Preferences memorisees (D-07) : derniere methode + dernier repas ──
  useEffect(() => {
    (async () => {
      try {
        const p = parsePrefs(await AsyncStorage.getItem(PREFS_KEY));
        setPrefs(p);
        setMethod(p.lastMethod);
        // Hors creneau (23h-04h59) : dernier repas utilise, sinon snack
        setMealType(mealTypeForHour(now.getHours(), p.lastMealType));
      } catch { /* defauts */ }
      setPrefsReady(true);
    })();
  }, [now]);

  const persistPrefs = useCallback((next: MealPrefs) => {
    setPrefs(next);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const chooseMethod = (m: MealMethod) => {
    setMethod(m);
    persistPrefs({ ...prefs, lastMethod: m });
  };
  const chooseMeal = (mt: MealType) => setMealType(mt);

  // ── Repas du jour + recents (A17, D-03, D-09) ──
  const loadLogs = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLogsLoaded(true); return; }
      setUserId(user.id);
      const since = dateKeyDaysAgo(RECENTS_WINDOW_DAYS);
      const { data, error } = await supabase
        .from('ziko_nutrition_logs')
        .select('id, date, meal_type, food_name, calories, protein_g, carbs_g, fat_g, serving_g, food_product_id, nutriscore_grade, ecoscore_grade, created_at')
        .eq('user_id', user.id)
        .gte('date', since)
        .order('created_at', { ascending: false })
        .limit(300);
      if (!error && data) {
        setRecentRows(data);
        const todayKey = localDateKey();
        setTodayLogs(data.filter((r: any) => r.date === todayKey));
      }
    } catch { /* hors-ligne : on garde l'etat local */ }
    setLogsLoaded(true);
  }, [supabase]);

  // ── File d'attente hors-ligne (M-5) ──
  const flushPending = useCallback(async () => {
    try {
      let list = parsePending(await AsyncStorage.getItem(PENDING_KEY));
      if (list.length === 0) { setPending([]); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPending(list); return; }
      for (const p of list) {
        const rows = p.rows.filter((r) => r.user_id === user.id);
        if (rows.length === 0) continue;
        const res = await saveMeal(supabase, rows);
        if (res.status === 'saved') list = removePending(list, p.id);
        else if (res.status === 'network') break;
      }
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list));
      setPending(list);
    } catch { /* reessai a la prochaine ouverture */ }
  }, [supabase]);

  useEffect(() => {
    (async () => {
      await flushPending();
      await loadLogs();
      onSaved?.();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Minuit franchi pendant que l'ecran reste monte : recharge les repas du jour au retour au premier plan.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') loadLogs(); });
    return () => sub.remove();
  }, [loadLogs]);

  // ── Recherche (D-05 : 3 lignes squelette pendant la requete) ──
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearching(false); setSearchFailed(false); return; }
    setSearching(true);
    const tb = setTimeout(async () => {
      try {
        const { data, error } = await supabase.from('ziko_food_database').select('*').ilike('name', `%${query.trim()}%`).limit(30);
        if (error) { setSearchFailed(true); setResults([]); } else { setSearchFailed(false); setResults((data ?? []) as FoodItem[]); }
      } catch {
        setSearchFailed(true); setResults([]);
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(tb);
  }, [query, supabase]);

  useEffect(() => {
    if (method === 'barcode' && permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [method, permission, requestPermission]);

  // ── Panier ──
  const basketTotal = useMemo(() => sumMacros(basket), [basket]);
  const addToBasket = (item: Omit<BasketItem, 'key'>) => setBasket((b) => [...b, { ...item, key: nextKey() }]);
  const removeFromBasket = (key: string) => setBasket((b) => b.filter((x) => x.key !== key));
  const toggleFood = (food: FoodItem) => {
    const existing = basket.find((b) => b.food_name === food.name && b.serving_g === (food.serving_g || 100));
    if (existing) { removeFromBasket(existing.key); return; }
    addToBasket(scaleFood(food, food.serving_g || 100));
  };
  const isInBasket = (food: FoodItem) => basket.some((b) => b.food_name === food.name && b.serving_g === (food.serving_g || 100));

  const customValid = custom.name.trim().length > 0 && custom.calories.trim().length > 0;
  const customItem = (): Omit<BasketItem, 'key'> => ({
    food_name: custom.name.trim(),
    calories: parseFloat(custom.calories.replace(',', '.')) || 0,
    protein_g: parseFloat(custom.protein_g.replace(',', '.')) || 0,
    carbs_g: parseFloat(custom.carbs_g.replace(',', '.')) || 0,
    fat_g: parseFloat(custom.fat_g.replace(',', '.')) || 0,
    serving_g: 100,
  });

  // Total affiche dans la barre : panier (+ saisie manuelle en cours, A20)
  const manualPending = method === 'custom' && customValid;
  const barItems = manualPending ? [...basket, { ...customItem(), key: 'manual' }] : basket;
  const barTotal = sumMacros(barItems);

  // ── Enregistrement groupe (D-06, D-11, D-13) ──
  const commit = async () => {
    if (barItems.length === 0 || saving) return;
    setSaving(true);
    let uid = userId;
    if (!uid) {
      try { uid = (await supabase.auth.getUser()).data?.user?.id ?? null; } catch { uid = null; }
    }
    if (!uid) { setSaving(false); showAlert(t('general.error'), t('nutrition.notAuth')); return; }
    const rows = buildInsertRows(barItems, uid, localDateKey(), mealType);
    const res = await saveMeal(supabase, rows);
    if (res.status === 'saved') {
      res.data.forEach((d) => addLog(d as any));
      persistPrefs({ ...prefs, lastMethod: method, lastMealType: mealType });
      // un seul gain de credit par ajout groupe (cle = id du premier log)
      const firstId = res.data[0]?.id;
      if (firstId) {
        earnCredit(supabase, 'meal', firstId).then((r) => { if (r.credited) useCreditStore.getState().showEarnToast(); });
      }
      onSaved?.();
      setSaving(false);
      router.back();
      return;
    }
    if (res.status === 'network') {
      const entry: PendingMeal = { id: nextKey(), rows, queuedAt: new Date().toISOString() };
      try {
        const list = enqueuePending(parsePending(await AsyncStorage.getItem(PENDING_KEY)), entry);
        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list));
        setPending(list);
      } catch { /* meme si le stockage echoue, on informe */ }
      persistPrefs({ ...prefs, lastMethod: method, lastMealType: mealType });
      setSaving(false);
      showAlert(t('nutrition.logMeal'), t('meal.queued'), [{ text: 'OK', onPress: () => router.back() }]);
      return;
    }
    setSaving(false);
    showAlert(t('general.error'), res.message);
  };

  // ── Photo (inchange fonctionnellement : upload signe puis /ai/vision/nutrition) ──
  const pickImage = async (source: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { showAlert(t('nutrition.permRequired'), t('nutrition.permCamera')); return; }
      result = await ImagePicker.launchCameraAsync({ base64: false, quality: 0.7 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showAlert(t('nutrition.permRequired'), t('nutrition.permGallery')); return; }
      result = await ImagePicker.launchImageLibraryAsync({ base64: false, quality: 0.7 });
    }
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    // Resize to max 1568px — Anthropic rejects images > 8000px per dimension (ZIKO-MOBILE-2)
    let imageUri = asset.uri;
    try {
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: Math.min(asset.width ?? 1568, 1568) } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      imageUri = resized.uri;
    } catch (e) {
      console.warn('[Nutrition] Image resize failed, using original:', e);
    }
    setScanResults(null);
    setScanDescription('');
    setScanImage(imageUri);
  };

  useEffect(() => {
    if (!scanImage) return;
    scanScrollRef.current?.scrollTo({ y: 0, animated: false });
    const timer = setTimeout(() => analyzeImage(scanImage), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanImage]);

  const analyzeImage = async (uri: string) => {
    setAnalyzing(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const uid = session?.user?.id;
      if (!token || !uid) { showAlert(t('general.error'), t('nutrition.notAuth')); setAnalyzing(false); return; }
      const scanPath = `${uid}/scan-${Date.now()}.jpg`;
      const urlRes = await fetch(`${apiUrl}/storage/upload-url?bucket=ziko-scan-photos&path=${scanPath}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!urlRes.ok) { showAlert(t('general.error'), 'Failed to get upload URL'); setAnalyzing(false); return; }
      const { upload_url } = await urlRes.json();
      const blobRes = await fetch(uri);
      const blob = await blobRes.blob();
      const putRes = await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
      if (!putRes.ok) { showAlert(t('general.error'), 'Photo upload failed'); setAnalyzing(false); return; }
      const res = await fetch(`${apiUrl}/ai/vision/nutrition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storage_path: scanPath, meal_context: mealType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Analysis failed' }));
        showAlert(t('general.error'), err.error || 'Failed to analyze image');
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

  const addScanResult = (f: ScanFood) => {
    addToBasket({ food_name: f.food_name, calories: f.calories, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, serving_g: f.serving_g });
  };
  const editScanResult = (f: Pick<ScanFood, 'food_name' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>) => {
    setCustom({ name: f.food_name, calories: String(f.calories), protein_g: String(f.protein_g), carbs_g: String(f.carbs_g), fat_g: String(f.fat_g) });
    chooseMethod('custom');
  };

  // ── Code-barres ──
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setBarcodeScannedCode(data);
    setBarcodeLoading(true);
    setBarcodeProduct(null);
    setBarcodeNotFound(false);
    try {
      const product = await getOrFetchProduct(data, supabase);
      if (product) { setBarcodeProduct(product); setServingGrams(product.serving_size_g ?? 100); }
      else setBarcodeNotFound(true);
    } catch {
      setBarcodeNotFound(true); // issue A21 : saisie manuelle, aussi hors-ligne
    }
    setBarcodeLoading(false);
  };
  const handleScanAgain = () => {
    scannedRef.current = false;
    setBarcodeProduct(null); setBarcodeNotFound(false); setBarcodeScannedCode(''); setBarcodeLoading(false); setServingGrams(100);
  };
  const barcodeScaled = barcodeProduct ? {
    calories: Math.round(barcodeProduct.energy_kcal * servingGrams / 100),
    protein_g: +(barcodeProduct.proteins_g * servingGrams / 100).toFixed(1),
    carbs_g: +(barcodeProduct.carbs_g * servingGrams / 100).toFixed(1),
    fat_g: +(barcodeProduct.fat_g * servingGrams / 100).toFixed(1),
  } : null;
  const addBarcodeProduct = () => {
    if (!barcodeProduct || !barcodeScaled) return;
    addToBasket({
      food_name: barcodeProduct.name, ...barcodeScaled, serving_g: servingGrams,
      food_product_id: barcodeProduct.id, nutriscore_grade: barcodeProduct.nutriscore_grade, ecoscore_grade: barcodeProduct.ecoscore_grade,
    });
    handleScanAgain();
  };

  // ── Derives d'affichage ──
  const groups = useMemo(() => groupByMeal(todayLogs), [todayLogs]);
  const loggedMeals = useMemo(() => new Set(groups.map((g) => g.meal_type)), [groups]);
  const pendingRows = useMemo(() => pending.flatMap((p) => p.rows), [pending]);
  const dayTotals = useMemo(() => sumMacros([...todayLogs, ...pendingRows]), [todayLogs, pendingRows]);
  const recents = useMemo(() => deriveRecents(recentRows, 8), [recentRows]);
  const remaining = goals.kcal - dayTotals.calories;
  const clock = formatClock(now);
  const empty = logsLoaded && todayLogs.length === 0 && pendingRows.length === 0;

  const card = { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, shadowColor: '#1C1A17', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 3 } as const;

  const macroRow = (label: string, val: number, goal: number) => {
    const pct = goal > 0 ? Math.min(1, val / goal) : 0;
    return (
      <View key={label} style={{ flex: 1 }}>
        <Text style={{ color: theme.muted, fontSize: 11 }}>{label}</Text>
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700', marginTop: 2 }}>{Math.round(val)} / {Math.round(goal)} g</Text>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.border, marginTop: 4, overflow: 'hidden' }}>
          <View style={{ height: 4, width: `${pct * 100}%`, backgroundColor: theme.primary }} />
        </View>
      </View>
    );
  };

  const methodLabel = (m: MealMethod) => t(`meal.method.${m}`);
  const showBar = barItems.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* En-tete */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('general.back')} style={{ marginRight: 12, padding: 4 }}>
            <Ionicons name="chevron-back" size={24} color={theme.muted} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: theme.text }}>{t('nutrition.logMeal')}</Text>
          {saving && <ActivityIndicator color={theme.primary} />}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" ref={scanScrollRef} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 + (showBar ? 80 : 0) }}>
          {/* Recap du jour (D-01 / M-3) */}
          <View testID="meal-recap" style={{ ...card, padding: 16, marginTop: 4 }}>
            <Text style={{ color: theme.muted, fontSize: 12 }}>{t('meal.today')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
              <Text testID="meal-recap-kcal" style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>{dayTotals.calories}</Text>
              <Text style={{ color: theme.muted, fontSize: 13, marginLeft: 6 }}>/ {goals.kcal} kcal</Text>
              {!empty && (
                <Text style={{ color: theme.muted, fontSize: 12, marginLeft: 'auto' }}>
                  {remaining >= 0 ? t('meal.remaining', { n: remaining }) : t('meal.over', { n: -remaining })}
                </Text>
              )}
            </View>
            {empty ? (
              <Text style={{ color: theme.muted, fontSize: 13, marginTop: 8 }}>{t('meal.nothingYet')}</Text>
            ) : (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                {macroRow(t('macro.protein'), dayTotals.protein_g, goals.p)}
                {macroRow(t('macro.carbs'), dayTotals.carbs_g, goals.c)}
                {macroRow(t('macro.fat'), dayTotals.fat_g, goals.f)}
              </View>
            )}
          </View>

          {/* Repas preselectionne (D-02) */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {MEAL_TYPES.map((mt) => {
              const sel = mealType === mt;
              return (
                <TouchableOpacity key={mt} testID={`meal-chip-${mt}`} onPress={() => chooseMeal(mt)} accessibilityRole="button" accessibilityState={{ selected: sel }}
                  style={{ flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, backgroundColor: sel ? action : theme.surface, borderWidth: 1, borderColor: sel ? action : theme.border }}>
                  {loggedMeals.has(mt) && <Ionicons name="checkmark-circle" size={14} color={sel ? '#fff' : '#16A34A'} />}
                  <Text style={{ color: sel ? '#fff' : theme.text, fontSize: 12, fontWeight: '700' }}>{tMeal(mt)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text testID="meal-suggestion" style={{ color: theme.muted, fontSize: 12, marginTop: 8 }}>
            {t('meal.suggested', { meal: tMeal(mealTypeForHour(now.getHours(), prefs.lastMealType)), time: clock })}
          </Text>

          {/* Segment des 4 methodes (D-04 / M-4) */}
          <View style={{ flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 12, padding: 4, marginTop: 16, borderWidth: 1, borderColor: theme.border }}>
            {MEAL_METHODS.map((m) => {
              const sel = method === m;
              return (
                <TouchableOpacity key={m} testID={`meal-method-${m}`} onPress={() => chooseMethod(m)} accessibilityRole="button" accessibilityState={{ selected: sel }}
                  style={{ flex: 1, minHeight: 44, borderRadius: 9, backgroundColor: sel ? action : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
                  <Ionicons name={METHOD_ICON[m]} size={14} color={sel ? '#fff' : theme.muted} />
                  <Text style={{ color: sel ? '#fff' : theme.muted, fontWeight: '700', fontSize: 12 }}>{methodLabel(m)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {prefsReady && (
            <Text testID="meal-last-method" style={{ color: theme.muted, fontSize: 12, marginTop: 8 }}>
              {t('meal.lastMethod', { method: methodLabel(prefs.lastMethod) })}
            </Text>
          )}

          {/* ── Corps de la methode ── */}
          <View style={{ marginTop: 16 }}>
            {method === 'search' && (
              <View>
                <TextInput
                  testID="meal-search-input"
                  value={query}
                  onChangeText={setQuery}
                  onFocus={() => setFocused('q')}
                  onBlur={() => setFocused(null)}
                  placeholder={t('meal.searchTitle')}
                  placeholderTextColor={theme.muted}
                  accessibilityLabel={t('meal.searchTitle')}
                  style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: focused === 'q' ? 2 : 1, borderColor: focused === 'q' ? theme.primary : theme.border, paddingHorizontal: 16, paddingVertical: 12, color: theme.text, fontSize: 15 }}
                />
                <View style={{ marginTop: 12 }}>
                  {!query.trim() ? (
                    <View style={{ ...card, padding: 16, alignItems: 'center' }}>
                      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{t('meal.searchEmptyTitle')}</Text>
                      <Text style={{ color: theme.muted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>{t('meal.searchEmptyBody')}</Text>
                    </View>
                  ) : searching ? (
                    <View testID="meal-skeleton">
                      {[0, 1, 2].map((i) => (
                        <View key={i} style={{ ...card, height: 64, marginBottom: 8, opacity: 0.6 }} />
                      ))}
                    </View>
                  ) : searchFailed ? (
                    <View style={{ ...card, padding: 16 }}>
                      <Text style={{ color: theme.muted, fontSize: 13 }}>{t('meal.offlineNote')}</Text>
                      <TouchableOpacity onPress={() => chooseMethod('custom')} style={{ marginTop: 10, minHeight: 44, borderRadius: 12, backgroundColor: action, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>{t('meal.enterManually')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : results.length === 0 ? (
                    <View testID="meal-no-result" style={{ ...card, padding: 16, alignItems: 'center' }}>
                      <Text style={{ color: theme.muted, fontSize: 13, textAlign: 'center' }}>{t('meal.noFood', { query: query.trim() })}</Text>
                      <TouchableOpacity onPress={() => { setCustom((c) => ({ ...c, name: query.trim() })); chooseMethod('custom'); }}
                        style={{ marginTop: 10, minHeight: 44, paddingHorizontal: 20, borderRadius: 12, backgroundColor: action, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>{t('meal.enterManually')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    results.map((item) => {
                      const sel = isInBasket(item);
                      return (
                        <TouchableOpacity key={item.id} testID="meal-result" onPress={() => toggleFood(item)} accessibilityRole="button" accessibilityState={{ selected: sel }}
                          style={{ ...card, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderColor: sel ? theme.primary : theme.border, borderWidth: sel ? 2 : 1 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{item.name}</Text>
                            {item.brand ? <Text style={{ color: theme.muted, fontSize: 11 }}>{item.brand}</Text> : null}
                            <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>{item.serving_g} g · {item.calories} kcal · {item.protein_g} g prot.</Text>
                          </View>
                          <Ionicons name={sel ? 'checkmark-circle' : 'add-circle-outline'} size={26} color={sel ? theme.primary : theme.muted} />
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>
            )}

            {method === 'scan' && (
              <View>
                {!scanImage ? (
                  <View style={{ ...card, padding: 20, alignItems: 'center' }}>
                    <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}>
                      <Ionicons name="camera-outline" size={40} color={theme.primary} />
                    </View>
                    <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700', marginTop: 14 }}>{t('meal.photoTitle')}</Text>
                    <Text style={{ color: theme.muted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>{t('meal.photoHint')}</Text>
                    <Text testID="meal-scan-cost" style={{ color: theme.text, fontSize: 13, fontWeight: '700', marginTop: 10 }}>{scanCostLabel(SCAN_CREDIT_COST)}</Text>
                    <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{t('meal.photoFree')}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' }}>
                      <TouchableOpacity onPress={() => pickImage('camera')} style={{ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: action, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                        <Ionicons name="camera" size={18} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '700' }}>{t('nutrition.camera')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => pickImage('gallery')} style={{ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                        <Ionicons name="images" size={18} color={theme.primary} />
                        <Text style={{ color: theme.text, fontWeight: '700' }}>{t('nutrition.gallery')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View>
                    <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
                      <Image source={{ uri: scanImage }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
                    </View>
                    <TouchableOpacity onPress={() => { setScanImage(null); setScanResults(null); }}
                      style={{ minHeight: 44, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <Text style={{ color: theme.muted, fontWeight: '600' }}>{t('nutrition.newScan')}</Text>
                    </TouchableOpacity>
                    {analyzing ? (
                      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={{ color: theme.muted, marginTop: 10 }}>{t('nutrition.analyzing')}</Text>
                      </View>
                    ) : scanResults ? (
                      <View>
                        {scanDescription ? <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 10, fontStyle: 'italic' }}>{scanDescription}</Text> : null}
                        {scanResults.length === 0 ? (
                          <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 12 }}>{t('nutrition.noFood')}</Text>
                        ) : scanResults.map((food, i) => (
                          <View key={i} style={{ ...card, padding: 14, marginBottom: 10 }}>
                            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{food.food_name}</Text>
                            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{food.serving_g} g · {food.calories} kcal · {food.protein_g} g prot. · {food.carbs_g} g gluc. · {food.fat_g} g lip.</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                              <TouchableOpacity onPress={() => addScanResult(food)} style={{ flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: action, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: '#fff', fontWeight: '700' }}>{t('nutrition.logThis')}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => editScanResult(food)} style={{ flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: theme.text, fontWeight: '600' }}>{t('nutrition.editThis')}</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            )}

            {method === 'barcode' && (
              permission && !permission.granted ? (
                <View style={{ ...card, padding: 20, alignItems: 'center' }}>
                  <Ionicons name="camera-outline" size={40} color={theme.muted} />
                  <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', marginTop: 10 }}>{t('nutrition.cameraPermDenied')}</Text>
                  <TouchableOpacity onPress={() => chooseMethod('custom')} style={{ marginTop: 12, minHeight: 44, paddingHorizontal: 20, borderRadius: 12, backgroundColor: action, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{t('meal.enterManually')}</Text>
                  </TouchableOpacity>
                </View>
              ) : barcodeLoading ? (
                <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>
              ) : barcodeProduct && barcodeScaled ? (
                <View style={{ ...card, padding: 16 }}>
                  {barcodeProduct.image_url ? (
                    <Image source={{ uri: barcodeProduct.image_url }} style={{ width: '100%', height: 160, borderRadius: 10 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: '100%', height: 100, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="nutrition-outline" size={48} color={theme.muted} /></View>
                  )}
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 12 }}>{barcodeProduct.name}</Text>
                  {barcodeProduct.brand ? <Text style={{ fontSize: 12, color: theme.muted }}>{barcodeProduct.brand}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <ScoreBadge grade={barcodeProduct.nutriscore_grade} type="nutriscore" size="lg" />
                    <ScoreBadge grade={barcodeProduct.ecoscore_grade} type="ecoscore" size="lg" />
                  </View>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 14, marginBottom: 6 }}>{t('nutrition.servingSize')}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[50, 100, 150, 200].map((val) => (
                      <TouchableOpacity key={val} onPress={() => setServingGrams(val)}
                        style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', borderWidth: 1, borderColor: servingGrams === val ? theme.primary : theme.border, backgroundColor: servingGrams === val ? theme.primary + '18' : theme.surface }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: servingGrams === val ? theme.primary : theme.text }}>{val} g</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity onPress={() => setServingGrams((p) => Math.max(1, p - 5))} accessibilityLabel="-5 g" style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>-</Text>
                    </TouchableOpacity>
                    <TextInput value={String(servingGrams)} keyboardType="numeric"
                      onChangeText={(txt) => { const n = parseInt(txt, 10); setServingGrams(isNaN(n) ? 100 : Math.max(1, Math.min(1000, n))); }}
                      style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: theme.text, backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingVertical: 10 }} />
                    <TouchableOpacity onPress={() => setServingGrams((p) => Math.min(1000, p + 5))} accessibilityLabel="+5 g" style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, textAlign: 'center', marginTop: 12 }}>
                    {barcodeScaled.calories} kcal · {barcodeScaled.protein_g} g prot. · {barcodeScaled.carbs_g} g gluc. · {barcodeScaled.fat_g} g lip.
                  </Text>
                  <TouchableOpacity onPress={addBarcodeProduct} style={{ minHeight: 48, borderRadius: 12, backgroundColor: action, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('nutrition.logThisMeal')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleScanAgain} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: theme.muted, fontSize: 14 }}>{t('nutrition.scanAgain')}</Text>
                  </TouchableOpacity>
                </View>
              ) : barcodeNotFound ? (
                <View testID="meal-barcode-notfound" style={{ ...card, padding: 20, alignItems: 'center' }}>
                  <Ionicons name="barcode-outline" size={40} color={theme.muted} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 12, textAlign: 'center' }}>{t('meal.barcodeNotFound', { code: barcodeScannedCode })}</Text>
                  <Text style={{ fontSize: 13, color: theme.muted, marginTop: 6, textAlign: 'center' }}>{t('meal.barcodeNotFoundBody')}</Text>
                  <TouchableOpacity testID="meal-barcode-manual" onPress={() => chooseMethod('custom')} style={{ minHeight: 48, borderRadius: 12, backgroundColor: action, alignItems: 'center', justifyContent: 'center', marginTop: 16, width: '100%' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('meal.enterManually')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleScanAgain} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: theme.muted, fontSize: 14 }}>{t('meal.scanOther')}</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 8, textAlign: 'center' }}>{t('meal.offlineNote')}</Text>
                </View>
              ) : (
                <View style={{ height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
                  <CameraView style={{ flex: 1 }} facing="back" onBarcodeScanned={handleBarcodeScanned} barcodeScannerSettings={{ barcodeTypes: ['ean13'] }} />
                  <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
                    <View style={{ width: 240, height: 100, borderRadius: 10, borderWidth: 2, borderColor: '#fff' }} />
                    <Text style={{ color: '#fff', fontSize: 13, marginTop: 10 }}>{t('nutrition.barcodeAlign')}</Text>
                  </View>
                </View>
              )
            )}

            {method === 'custom' && (
              <View>
                {([
                  { key: 'name', label: t('meal.name'), keyboard: 'default', placeholder: 'Bol de lentilles maison' },
                  { key: 'calories', label: t('meal.kcalField'), keyboard: 'numeric', placeholder: '0' },
                  { key: 'protein_g', label: t('meal.proteinField'), keyboard: 'numeric', placeholder: '0' },
                  { key: 'carbs_g', label: t('meal.carbsField'), keyboard: 'numeric', placeholder: '0' },
                  { key: 'fat_g', label: t('meal.fatField'), keyboard: 'numeric', placeholder: '0' },
                ] as const).map(({ key, label, keyboard, placeholder }) => (
                  <View key={key} style={{ marginBottom: 12 }}>
                    <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 4 }}>{label}</Text>
                    <TextInput
                      testID={`meal-custom-${key}`}
                      value={custom[key]}
                      onChangeText={(v) => setCustom((c) => ({ ...c, [key]: v }))}
                      onFocus={() => setFocused(key)}
                      onBlur={() => setFocused(null)}
                      placeholder={placeholder}
                      placeholderTextColor={theme.muted}
                      keyboardType={keyboard}
                      style={{ backgroundColor: theme.surface, borderRadius: 10, borderWidth: focused === key ? 2 : 1, borderColor: focused === key ? theme.primary : theme.border, paddingHorizontal: 14, paddingVertical: 10, color: theme.text, fontSize: 15 }}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Panier courant */}
          {basket.length > 0 && (
            <View style={{ marginTop: 16 }}>
              {basket.map((b) => (
                <View key={b.key} testID="meal-basket-item" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                  <Text style={{ flex: 1, color: theme.text, fontSize: 13, marginLeft: 8 }} numberOfLines={1}>{b.food_name}</Text>
                  <Text style={{ color: theme.muted, fontSize: 12, marginRight: 8 }}>{Math.round(b.calories)} kcal</Text>
                  <TouchableOpacity onPress={() => removeFromBasket(b.key)} accessibilityLabel={t('meal.removeItem')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={18} color={theme.muted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Deja ajoute aujourd'hui (A17 / M-3) */}
          {(groups.length > 0 || pendingRows.length > 0) && (
            <View testID="meal-already-added" style={{ marginTop: 20 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>{t('meal.alreadyAdded')}</Text>
              {groups.map((g) => (
                <View key={g.meal_type} testID="meal-group" style={{ ...card, padding: 14, marginBottom: 8 }}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{tMeal(g.meal_type)} · {g.calories} kcal</Text>
                  <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{g.names.join(', ')}</Text>
                </View>
              ))}
              {pending.length > 0 && (
                <View style={{ ...card, padding: 14, marginBottom: 8 }}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{t('meal.pending')} · {sumMacros(pendingRows).calories} kcal</Text>
                  <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{pendingRows.map((r) => r.food_name).join(', ')}</Text>
                </View>
              )}
            </View>
          )}

          {/* Recents (D-09) : sous la recherche, requete vide */}
          {method === 'search' && !query.trim() && recents.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>{t('meal.recents')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {recents.map((r) => (
                  <TouchableOpacity key={r.food_name} testID="meal-recent" onPress={() => addToBasket({ food_name: r.food_name, calories: r.calories, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, serving_g: r.serving_g, food_product_id: r.food_product_id, nutriscore_grade: r.nutriscore_grade, ecoscore_grade: r.ecoscore_grade })}
                    style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, justifyContent: 'center' }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{r.food_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Barre d'action collante (D-01) */}
        {showBar && (
          <View testID="meal-action-bar" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View>
              <Text style={{ color: theme.muted, fontSize: 11 }}>Total</Text>
              <Text testID="meal-bar-total" style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>{barTotal.calories} kcal</Text>
            </View>
            <TouchableOpacity testID="meal-add-button" onPress={commit} disabled={saving} accessibilityRole="button"
              style={{ flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: action, alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.6 : 1 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                {manualPending && basket.length === 0 ? t(`meal.addTo.${mealType}`) : addLabel(barItems.length)}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
