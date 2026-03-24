import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Vibration, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useCardioStore, ACTIVITY_LABELS } from '../store';
import type { RoutePoint } from '../store';

const GPS_ACTIVITY_TYPES = ['running', 'cycling', 'walking'] as const;

// Haversine formula — distance in km between two GPS coords
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPaceMin(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0 || !isFinite(secPerKm)) return '--:--';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Smooth elevation gain: only count increases > 2m
function computeElevationGain(points: RoutePoint[]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = (points[i].altitude ?? 0) - (points[i - 1].altitude ?? 0);
    if (diff > 2) gain += diff;
  }
  return Math.round(gain);
}

type TrackingState = 'idle' | 'running' | 'paused' | 'saving';

export default function CardioTracker({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { addSession } = useCardioStore();

  const [activityType, setActivityType] = useState<string>('running');
  const [trackingState, setTrackingState] = useState<TrackingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [currentPaceSecPerKm, setCurrentPaceSecPerKm] = useState(0);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastPointRef = useRef<RoutePoint | null>(null);
  const recentDistancesRef = useRef<{ dist: number; time: number }[]>([]);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (locationSubRef.current) locationSubRef.current.remove();
    locationSubRef.current = null;
    intervalRef.current = null;
  }, []);

  useEffect(() => () => stopTracking(), []);

  const startLocationTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError('Permission GPS refusée. Active la localisation dans les réglages.');
      return false;
    }
    setLocationError(null);

    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5, // update every 5m
        timeInterval: 3000,
      },
      (loc) => {
        const point: RoutePoint = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          timestamp: loc.timestamp,
          altitude: loc.coords.altitude ?? undefined,
        };

        setRoutePoints((prev) => {
          const last = prev[prev.length - 1];
          if (!last) return [...prev, point];

          const segDist = haversine(last.lat, last.lng, point.lat, point.lng);
          // Filter GPS noise: ignore jumps > 50m in < 3s
          const timeDiff = (point.timestamp - last.timestamp) / 1000;
          if (segDist > 0.05 && timeDiff < 3) return prev;

          if (segDist > 0.001) { // > 1m
            setDistanceKm((d) => d + segDist);

            // Rolling 60s pace
            const now = point.timestamp;
            recentDistancesRef.current = [
              ...recentDistancesRef.current.filter((r) => now - r.time < 60000),
              { dist: segDist, time: now },
            ];
            const recentDist = recentDistancesRef.current.reduce((s, r) => s + r.dist, 0);
            const recentTime = (now - (recentDistancesRef.current[0]?.time ?? now)) / 1000;
            if (recentDist > 0.05 && recentTime > 5) {
              setCurrentPaceSecPerKm(recentTime / recentDist);
            }
          }

          return [...prev, point];
        });

        lastPointRef.current = point;
      }
    );
    return true;
  }, []);

  const handleStart = async () => {
    const ok = await startLocationTracking();
    if (!ok) return;
    setElapsed(0);
    setDistanceKm(0);
    setCurrentPaceSecPerKm(0);
    setRoutePoints([]);
    recentDistancesRef.current = [];
    setTrackingState('running');
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    Vibration.vibrate(100);
  };

  const handlePause = () => {
    if (trackingState === 'running') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (locationSubRef.current) locationSubRef.current.remove();
      locationSubRef.current = null;
      setTrackingState('paused');
      Vibration.vibrate(200);
    } else if (trackingState === 'paused') {
      startLocationTracking();
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      setTrackingState('running');
      Vibration.vibrate(100);
    }
  };

  const handleStop = () => {
    if (elapsed < 30) {
      showAlert('Trop court', 'Continue encore un peu avant d\'arrêter !');
      return;
    }
    showAlert(
      'Terminer la session',
      `${formatTime(elapsed)} · ${distanceKm.toFixed(2)} km\n\nSauvegarder cette session ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Sauvegarder', style: 'default', onPress: () => handleSave() },
      ]
    );
  };

  const handleSave = async () => {
    stopTracking();
    setTrackingState('saving');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const durationMin = Math.max(1, Math.round(elapsed / 60));
      const dist = parseFloat(distanceKm.toFixed(2));
      const paceSecPerKm = dist > 0 ? Math.round(elapsed / dist) : null;
      const estCalories = Math.round(durationMin * (activityType === 'cycling' ? 8 : 10));
      const elevGain = computeElevationGain(routePoints);
      const today = new Date().toISOString();

      const actLabel = ACTIVITY_LABELS[activityType]?.label ?? activityType;
      const title = `${actLabel} · ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}`;

      const { data, error } = await supabase
        .from('cardio_sessions')
        .insert({
          user_id: user.id,
          title,
          activity_type: activityType,
          duration_min: durationMin,
          distance_km: dist > 0 ? dist : null,
          calories_burned: estCalories,
          avg_pace_sec_per_km: paceSecPerKm,
          elevation_gain_m: elevGain > 0 ? elevGain : null,
          route_data: routePoints.length > 0 ? routePoints : null,
          notes: '',
          date: today,
        })
        .select('*')
        .single();

      if (error) throw error;
      addSession(data);
      Vibration.vibrate([0, 200, 100, 200]);
      router.replace('/(plugins)/cardio/dashboard' as any);
    } catch (err: any) {
      showAlert('Erreur', err.message ?? 'Impossible de sauvegarder');
      setTrackingState('paused');
    }
  };

  const avgPaceSecPerKm = distanceKm > 0 ? elapsed / distanceKm : 0;
  const actInfo = ACTIVITY_LABELS[activityType] ?? ACTIVITY_LABELS.running;

  // ─── IDLE: activity picker ────────────────────────────────────────────────
  if (trackingState === 'idle') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 32 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Ionicons name="arrow-back" size={24} color={theme.primary} />
            </TouchableOpacity>
            <View>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 24 }}>Enregistrer</Text>
              <Text style={{ color: theme.muted, fontSize: 14, marginTop: 2 }}>Sélectionne ton activité</Text>
            </View>
          </View>

          {locationError && (
            <View style={{
              backgroundColor: '#F4433615', borderRadius: 12, padding: 14, marginBottom: 20,
              borderWidth: 1, borderColor: '#F4433640', flexDirection: 'row', gap: 10,
            }}>
              <Ionicons name="warning" size={18} color="#F44336" />
              <Text style={{ color: '#F44336', fontSize: 13, flex: 1 }}>{locationError}</Text>
            </View>
          )}

          <View style={{ gap: 12 }}>
            {GPS_ACTIVITY_TYPES.map((key) => {
              const info = ACTIVITY_LABELS[key];
              const selected = activityType === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setActivityType(key)}
                  style={{
                    backgroundColor: selected ? actInfo.color + '15' : theme.surface,
                    borderRadius: 18, padding: 20, borderWidth: 2,
                    borderColor: selected ? info.color : theme.border,
                    flexDirection: 'row', alignItems: 'center', gap: 16,
                  }}
                >
                  <Text style={{ fontSize: 32 }}>{info.emoji}</Text>
                  <View>
                    <Text style={{ color: selected ? info.color : theme.text, fontWeight: '700', fontSize: 18 }}>
                      {info.label}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>
                      {key === 'running' ? 'Parcours GPS · Allure · Élévation' :
                        key === 'cycling' ? 'Distance GPS · Vitesse · Puissance' :
                          'Parcours GPS · Distance · Durée'}
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={24} color={info.color} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => setActivityType('other')}
            style={{
              marginTop: 12, backgroundColor: theme.surface, borderRadius: 18, padding: 20,
              borderWidth: 2, borderColor: activityType === 'other' ? theme.primary : theme.border,
              flexDirection: 'row', alignItems: 'center', gap: 16,
            }}
          >
            <Text style={{ fontSize: 32 }}>💪</Text>
            <View>
              <Text style={{ color: activityType === 'other' ? theme.primary : theme.text, fontWeight: '700', fontSize: 18 }}>
                Autre activité
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>
                Durée et calories uniquement
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStart}
            style={{
              backgroundColor: theme.primary, borderRadius: 20, padding: 20,
              alignItems: 'center', marginTop: 40, flexDirection: 'row',
              justifyContent: 'center', gap: 12,
            }}
          >
            <Ionicons name="play-circle" size={28} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>Démarrer</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── ACTIVE / PAUSED: live tracker ──────────────────────────────────────
  const isRunning = trackingState === 'running';
  const isSaving = trackingState === 'saving';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, padding: 24 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 28, marginRight: 10 }}>{actInfo.emoji}</Text>
          <View>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }}>{actInfo.label}</Text>
            <Text style={{ color: isRunning ? '#4CAF50' : '#FF9800', fontSize: 13, fontWeight: '600' }}>
              {isRunning ? '● En cours' : '⏸ Pause'}
            </Text>
          </View>
        </View>

        {/* Main timer */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: theme.text, fontSize: 72, fontWeight: '900', letterSpacing: -2 }}>
            {formatTime(elapsed)}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>Durée</Text>
        </View>

        {/* Stats grid */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{
            flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 18,
            borderWidth: 1, borderColor: theme.border, alignItems: 'center',
          }}>
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>
              {distanceKm.toFixed(2)}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>km</Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 18,
            borderWidth: 1, borderColor: theme.border, alignItems: 'center',
          }}>
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>
              {activityType === 'cycling'
                ? (distanceKm > 0 && elapsed > 0 ? ((distanceKm / elapsed) * 3600).toFixed(1) : '--')
                : formatPaceMin(currentPaceSecPerKm || avgPaceSecPerKm)}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
              {activityType === 'cycling' ? 'km/h' : '/km'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 40 }}>
          <View style={{
            flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 18,
            borderWidth: 1, borderColor: theme.border, alignItems: 'center',
          }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>
              {Math.round(elapsed / 60 * (activityType === 'cycling' ? 8 : 10))}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>kcal est.</Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 18,
            borderWidth: 1, borderColor: theme.border, alignItems: 'center',
          }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>
              {routePoints.length}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>pts GPS</Text>
          </View>
        </View>

        {/* Avg pace bar */}
        {distanceKm > 0.1 && (
          <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 6 }}>Allure moyenne</Text>
            <Text style={{ color: theme.primary, fontSize: 22, fontWeight: '800' }}>
              {formatPaceMin(avgPaceSecPerKm)}<Text style={{ color: theme.muted, fontSize: 14, fontWeight: '400' }}> /km</Text>
            </Text>
          </View>
        )}

        {/* Controls */}
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
          <TouchableOpacity
            onPress={handleStop}
            disabled={isSaving}
            style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: '#F4433620', justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Ionicons name="stop" size={28} color="#F44336" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePause}
            disabled={isSaving}
            style={{
              width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primary,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Ionicons name={isRunning ? 'pause' : 'play'} size={36} color="#fff" />
          </TouchableOpacity>

          <View style={{ width: 64 }} />
        </View>

        {isSaving && (
          <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 20, fontSize: 14 }}>
            Sauvegarde en cours...
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
