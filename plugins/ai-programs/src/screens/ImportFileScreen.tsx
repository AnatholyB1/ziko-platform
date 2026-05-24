import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  FadeInUp,
  withTiming,
  withRepeat,
  withSequence,
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import { showAlert } from '@ziko/plugin-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScreenState = 'idle' | 'uploading' | 'parsing' | 'result' | 'failed';

interface ImportRow {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  overall_confidence?: number;
  parsed_data?: {
    weeks?: Array<{
      sessions?: Array<{
        exercises?: unknown[];
      }>;
    }>;
  };
  error_message?: string;
}

interface AssetInfo {
  uri: string;
  mimeType?: string;
  size?: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getFormatLabel(mimeType?: string): string {
  if (!mimeType) return 'Fichier';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'image/png' || mimeType === 'image/jpeg') return 'Image';
  if (mimeType.includes('spreadsheet') || mimeType.includes('ms-excel')) return 'Excel';
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'Word';
  return 'Fichier';
}

function getConfidenceColor(c?: number): string {
  if (c === undefined || c === null) return '#6B6963';
  if (c >= 0.8) return '#22C55E';
  if (c >= 0.5) return '#F59E0B';
  return '#EF4444';
}

function computeStats(parsedData?: ImportRow['parsed_data']) {
  if (!parsedData?.weeks) return { weeks: 0, sessions: 0, exercises: 0 };
  const weeks = parsedData.weeks.length;
  let sessions = 0;
  let exercises = 0;
  for (const w of parsedData.weeks) {
    sessions += w.sessions?.length ?? 0;
    for (const s of w.sessions ?? []) {
      exercises += s.exercises?.length ?? 0;
    }
  }
  return { weeks, sessions, exercises };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FormatChip({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: '#F0EFE9',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1C1A17' }}>{label}</Text>
    </View>
  );
}

function ConfidenceBanner({ confidence }: { confidence?: number }) {
  if (confidence === undefined || confidence === null) return null;

  let bg = '#DCFCE7';
  let border = '#22C55E';
  let icon: React.ComponentProps<typeof Ionicons>['name'] = 'checkmark-circle-outline';
  let text = `Extraction réussie — confiance globale ${Math.round(confidence * 100)}%`;

  if (confidence < 0.5) {
    bg = '#FEE2E2';
    border = '#EF4444';
    icon = 'alert-circle-outline';
    text = `Extraction incertaine — revue manuelle recommandée (confiance ${Math.round(confidence * 100)}%)`;
  } else if (confidence < 0.8) {
    bg = '#FEF9C3';
    border = '#F59E0B';
    icon = 'warning-outline';
    text = `Extraction partielle — vérifiez les champs en jaune (confiance ${Math.round(confidence * 100)}%)`;
  }

  return (
    <View
      style={{
        backgroundColor: bg,
        borderLeftWidth: 4,
        borderLeftColor: border,
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Ionicons name={icon} size={18} color={border} style={{ marginRight: 8 }} />
      <Text style={{ fontSize: 13, color: '#1C1A17', flex: 1 }}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

interface ImportFileScreenProps {
  supabase: SupabaseClient;
}

export default function ImportFileScreen({ supabase }: ImportFileScreenProps) {
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importId, setImportId] = useState<string | null>(null);
  const [parsedImport, setParsedImport] = useState<ImportRow | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [programName, setProgramName] = useState('');
  const [currentAsset, setCurrentAsset] = useState<AssetInfo | null>(null);

  // Refs for intervals and XHR abort
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Reanimated shared values
  const buttonScale = useSharedValue(1);
  const uploadBarWidth = useSharedValue(0);
  const parseBarWidth = useSharedValue(0);
  const parseBarOpacity = useSharedValue(1);
  const rotateValue = useSharedValue(0);
  const shakeX = useSharedValue(0);

  // Stat count-up animations
  const weeksValue = useSharedValue(0);
  const sessionsValue = useSharedValue(0);
  const exercisesValue = useSharedValue(0);

  const weeksDisplay = useDerivedValue(() => String(Math.round(weeksValue.value)));
  const sessionsDisplay = useDerivedValue(() => String(Math.round(sessionsValue.value)));
  const exercisesDisplay = useDerivedValue(() => String(Math.round(exercisesValue.value)));

  // Animated styles
  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const uploadBarStyle = useAnimatedStyle(() => ({
    width: `${uploadBarWidth.value * 100}%`,
  }));

  const parseBarStyle = useAnimatedStyle(() => ({
    width: `${parseBarWidth.value * 100}%`,
    opacity: parseBarOpacity.value,
  }));

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateValue.value}deg` }],
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Start rotation animation when parsing
  useEffect(() => {
    if (screenState === 'parsing') {
      rotateValue.value = withRepeat(withTiming(360, { duration: 3000 }), -1);
      // Slow progress fill
      parseBarWidth.value = 0.2;
      parseBarWidth.value = withTiming(0.85, { duration: 55000 });
      parseBarOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 600 }),
          withTiming(1, { duration: 600 }),
        ),
        -1,
      );
    } else {
      rotateValue.value = 0;
    }
  }, [screenState]);

  // Upload progress bar
  useEffect(() => {
    uploadBarWidth.value = withTiming(uploadProgress / 100, { duration: 200 });
  }, [uploadProgress]);

  // Elapsed timer during parsing
  useEffect(() => {
    if (screenState === 'parsing') {
      setElapsedSeconds(0);
      elapsedRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    }
    return () => {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    };
  }, [screenState]);

  // Polling during parsing
  useEffect(() => {
    if (screenState === 'parsing' && importId) {
      pollingRef.current = setInterval(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const res = await fetch(`${API_URL}/coach/imports/${importId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const json = await res.json();
          const imp: ImportRow = json.import ?? json;
          if (imp.status === 'ready') {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            setParsedImport(imp);
            setProgramName(imp.filename?.replace(/\.[^/.]+$/, '') ?? 'Programme importé');
            // Animate stats count-up
            const stats = computeStats(imp.parsed_data);
            weeksValue.value = withTiming(stats.weeks, { duration: 800 });
            sessionsValue.value = withTiming(stats.sessions, { duration: 800 });
            exercisesValue.value = withTiming(stats.exercises, { duration: 800 });
            setScreenState('result');
          } else if (imp.status === 'failed') {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            setErrorMessage(imp.error_message ?? 'Le fichier ne contient pas de programme structuré.');
            setScreenState('failed');
          }
        } catch {
          // polling errors are transient — keep polling
        }
      }, 2000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [screenState, importId]);

  // Shake animation when entering failed state
  useEffect(() => {
    if (screenState === 'failed') {
      shakeX.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 100 }),
        withTiming(-6, { duration: 100 }),
        withTiming(6, { duration: 100 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [screenState]);

  // ---------------------------------------------------------------------------
  // Upload flow
  // ---------------------------------------------------------------------------

  const startUpload = useCallback(async () => {
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_MIME_TYPES,
        copyToCacheDirectory: true,
      });
    } catch {
      showAlert('Erreur', "Impossible d'ouvrir le sélecteur de fichiers.");
      return;
    }

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;

    if (asset.size && asset.size > 25 * 1024 * 1024) {
      showAlert('Fichier trop grand', 'La taille maximale est 25 Mo.');
      return;
    }

    setCurrentAsset({
      uri: asset.uri,
      mimeType: asset.mimeType ?? undefined,
      size: asset.size ?? undefined,
      name: asset.name,
    });
    setUploadProgress(0);
    setScreenState('uploading');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Step 1: Create import record + get signed URL
      const createRes = await fetch(`${API_URL}/coach/imports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename: asset.name,
          mime_type: asset.mimeType ?? 'application/octet-stream',
          size_bytes: asset.size ?? 0,
          mode: 'athlete',
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error ?? `Erreur serveur ${createRes.status}`);
      }

      const { import_id, signed_upload_url } = await createRes.json();
      setImportId(import_id);

      // Step 2: Fetch blob then upload via XHR for progress tracking
      const blobRes = await fetch(asset.uri);
      const blob = await blobRes.blob();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload échoué: ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          xhrRef.current = null;
          reject(new Error('Erreur réseau pendant l\'upload'));
        };

        xhr.onabort = () => {
          xhrRef.current = null;
          reject(new Error('Upload annulé'));
        };

        xhr.open('PUT', signed_upload_url);
        xhr.setRequestHeader('Content-Type', asset.mimeType ?? 'application/octet-stream');
        xhr.send(blob);
      });

      // Step 3: Notify upload complete
      await fetch(`${API_URL}/coach/imports/${import_id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'uploaded' }),
      });

      // Step 4: Trigger parse
      await fetch(`${API_URL}/coach/imports/${import_id}/parse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      setScreenState('parsing');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur inattendue est survenue.';
      setErrorMessage(msg);
      setScreenState('failed');
    }
  }, [supabase]);

  const handleCancelUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setScreenState('idle');
    setUploadProgress(0);
    setCurrentAsset(null);
  }, []);

  const handleRetryParse = useCallback(async () => {
    if (!importId) return;
    setScreenState('parsing');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${API_URL}/coach/imports/${importId}/parse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la relance.';
      setErrorMessage(msg);
      setScreenState('failed');
    }
  }, [importId, supabase]);

  const handleReset = useCallback(() => {
    setScreenState('idle');
    setUploadProgress(0);
    setImportId(null);
    setParsedImport(null);
    setErrorMessage(null);
    setElapsedSeconds(0);
    setCurrentAsset(null);
    setProgramName('');
  }, []);

  const handleCommit = useCallback(async () => {
    if (!importId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${API_URL}/coach/imports/${importId}/commit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ program_name: programName || 'Programme importé', mode: 'athlete' }),
      });
      showAlert('Programme enregistré', 'Votre programme a été ajouté à vos programmes IA.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la validation.';
      showAlert('Erreur', msg);
    }
  }, [importId, programName, supabase]);

  const handlePressIn = useCallback(() => {
    buttonScale.value = withTiming(0.96, { duration: 100 });
  }, []);

  const handlePressOut = useCallback(() => {
    buttonScale.value = withTiming(1, { duration: 100 });
  }, []);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderIdleState = () => (
    <>
      {/* Upload card */}
      <Animated.View
        entering={FadeInUp.duration(250).delay(50)}
        style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E2E0DA',
          borderRadius: 12,
          padding: 32,
          paddingHorizontal: 24,
          alignItems: 'center',
          shadowColor: '#1C1A17',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <Ionicons name="cloud-upload-outline" size={48} color="#FF5C1A" />
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: '#1C1A17',
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          Importer un programme
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: '#6B6963',
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          PDF, Excel, Word ou image
        </Text>

        <Animated.View style={[{ marginTop: 24, width: '100%' }, buttonAnimStyle]}>
          <TouchableOpacity
            onPress={startUpload}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
            style={{
              backgroundColor: '#FF5C1A',
              borderRadius: 12,
              height: 44,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
              Choisir un fichier
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* Credit cost card */}
      <Animated.View
        entering={FadeInUp.duration(250).delay(100)}
        style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E2E0DA',
          borderRadius: 12,
          padding: 16,
          marginTop: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Ionicons name="information-circle-outline" size={16} color="#6B6963" style={{ marginRight: 8, marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 6 }}>
              Coût en crédits
            </Text>
            <Text style={{ fontSize: 12, color: '#6B6963', lineHeight: 18 }}>
              PDF : 1 crédit par page (max 10)
            </Text>
            <Text style={{ fontSize: 12, color: '#6B6963', lineHeight: 18 }}>
              Image, Excel, Word : 1 crédit
            </Text>
            <Text style={{ fontSize: 12, color: '#6B6963', lineHeight: 18 }}>
              Échec de l'analyse : 0 crédit débité
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Formats supported */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 12 }}>
          Formats acceptés
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <FormatChip label="PDF" />
          <FormatChip label="Excel .xlsx" />
          <FormatChip label="Word .docx" />
          <FormatChip label="PNG/JPEG" />
        </View>
      </View>
    </>
  );

  const renderUploadingState = () => (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E0DA',
        borderRadius: 12,
        padding: 24,
        paddingHorizontal: 20,
        shadowColor: '#1C1A17',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="document-outline" size={20} color="#6B6963" style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17' }} numberOfLines={1}>
            {currentAsset?.name ?? 'Fichier'}
          </Text>
          {currentAsset?.size !== undefined && (
            <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 2 }}>
              {formatBytes(currentAsset.size)}
            </Text>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View
        style={{
          marginTop: 20,
          height: 6,
          backgroundColor: '#E2E0DA',
          borderRadius: 9999,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            { height: 6, backgroundColor: '#FF5C1A', borderRadius: 9999 },
            uploadBarStyle,
          ]}
        />
      </View>

      <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 8 }}>
        Upload… {uploadProgress}%
      </Text>

      <TouchableOpacity onPress={handleCancelUpload} style={{ marginTop: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 14, color: '#6B6963' }}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );

  const renderParsingState = () => (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E0DA',
        borderRadius: 12,
        padding: 32,
        paddingHorizontal: 20,
        alignItems: 'center',
      }}
    >
      {/* Rotating icon */}
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 9999,
          backgroundColor: '#FFF7F4',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View style={rotateStyle}>
          <Ionicons name="sparkles-outline" size={32} color="#FF5C1A" />
        </Animated.View>
      </View>

      <Text
        style={{
          fontSize: 18,
          fontWeight: '600',
          color: '#1C1A17',
          marginTop: 20,
          textAlign: 'center',
        }}
      >
        Analyse en cours…
      </Text>
      <Text style={{ fontSize: 14, color: '#6B6963', textAlign: 'center', marginTop: 4 }}>
        L'IA extrait votre programme
      </Text>

      {/* Progress bar */}
      <View
        style={{
          marginTop: 24,
          width: '100%',
          height: 8,
          backgroundColor: '#E2E0DA',
          borderRadius: 9999,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            { height: 8, backgroundColor: '#FF5C1A', borderRadius: 9999 },
            parseBarStyle,
          ]}
        />
      </View>

      <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 8, textAlign: 'center' }}>
        {formatElapsed(elapsedSeconds)}
      </Text>

      <Text
        style={{
          fontSize: 12,
          color: '#6B6963',
          textAlign: 'center',
          marginTop: 16,
        }}
      >
        Patientez, cela peut prendre jusqu'à 60 secondes.
      </Text>
    </View>
  );

  const renderResultState = () => {
    if (!parsedImport) return null;
    const stats = computeStats(parsedImport.parsed_data);
    const formatLabel = getFormatLabel(parsedImport.mime_type);

    return (
      <Animated.View
        entering={FadeInUp.duration(350).springify().damping(16)}
        style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E2E0DA',
          borderRadius: 12,
          padding: 20,
          shadowColor: '#1C1A17',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', flex: 1, marginRight: 8 }} numberOfLines={1}>
            {parsedImport.filename}
          </Text>
          <View style={{ backgroundColor: '#F0EFE9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#1C1A17' }}>{formatLabel}</Text>
          </View>
        </View>

        {parsedImport.overall_confidence !== undefined && (
          <Text style={{ fontSize: 12, color: getConfidenceColor(parsedImport.overall_confidence), marginTop: 4 }}>
            Confiance : {Math.round(parsedImport.overall_confidence * 100)}%
          </Text>
        )}

        <ConfidenceBanner confidence={parsedImport.overall_confidence} />

        {/* Stats row */}
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: '#E2E0DA',
            paddingTop: 16,
            marginTop: 16,
          }}
        >
          {[
            { value: weeksDisplay, label: 'Semaines', count: stats.weeks },
            { value: sessionsDisplay, label: 'Séances', count: stats.sessions },
            { value: exercisesDisplay, label: 'Exercices', count: stats.exercises },
          ].map(({ value, label }) => (
            <View key={label} style={{ flex: 1, alignItems: 'center' }}>
              <Animated.Text style={{ fontSize: 18, fontWeight: '600', color: '#1C1A17' }}>
                {value as unknown as string}
              </Animated.Text>
              <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 2 }}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Program name input */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B6963', marginBottom: 6 }}>
            Nom du programme
          </Text>
          <TextInput
            value={programName}
            onChangeText={setProgramName}
            placeholder="Programme importé"
            placeholderTextColor="#6B6963"
            style={{
              height: 44,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E2E0DA',
              borderRadius: 8,
              paddingHorizontal: 12,
              fontSize: 14,
              color: '#1C1A17',
            }}
          />
        </View>

        {/* Action buttons */}
        <Animated.View style={[{ marginTop: 24 }, buttonAnimStyle]}>
          <TouchableOpacity
            onPress={handleCommit}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
            style={{
              backgroundColor: '#FF5C1A',
              borderRadius: 12,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
              Valider et utiliser
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          onPress={() =>
            showAlert(
              'Révision détaillée',
              'Utilisez la version web pour réviser les détails du programme.',
            )
          }
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E2E0DA',
            borderRadius: 12,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 12,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17' }}>
            Réviser les détails
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderFailedState = () => (
    <Animated.View style={shakeStyle}>
      <View
        style={{
          backgroundColor: '#FEE2E2',
          borderWidth: 1,
          borderColor: '#FCA5A5',
          borderRadius: 12,
          padding: 24,
          paddingHorizontal: 20,
          borderLeftWidth: 4,
          borderLeftColor: '#EF4444',
          alignItems: 'center',
        }}
      >
        <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: '#B91C1C',
            marginTop: 12,
            textAlign: 'center',
          }}
        >
          Analyse échouée
        </Text>
        <Text style={{ fontSize: 14, color: '#7F1D1D', textAlign: 'center', marginTop: 8 }}>
          {errorMessage ?? 'Le fichier ne contient pas de programme structuré.'}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: '#6B6963',
            fontStyle: 'italic',
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          Aucun crédit débité.
        </Text>

        <Animated.View style={[{ marginTop: 24, width: '100%' }, buttonAnimStyle]}>
          <TouchableOpacity
            onPress={handleRetryParse}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
            style={{
              backgroundColor: '#FF5C1A',
              borderRadius: 12,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
              Réessayer l'analyse
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          onPress={handleReset}
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E2E0DA',
            borderRadius: 12,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 12,
            width: '100%',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17' }}>
            Choisir un autre fichier
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // ---------------------------------------------------------------------------
  // Root render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#F7F6F3',
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back-outline" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#1C1A17' }}>
          Importer un fichier
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(300).springify()}>
          {screenState === 'idle' && renderIdleState()}
          {screenState === 'uploading' && renderUploadingState()}
          {screenState === 'parsing' && renderParsingState()}
          {screenState === 'result' && renderResultState()}
          {screenState === 'failed' && renderFailedState()}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
