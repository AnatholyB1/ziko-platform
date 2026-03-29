import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useCardioStore, ACTIVITY_LABELS, formatPace } from '../store';
import type { CardioSession, RoutePoint } from '../store';

function formatTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`;
  return `${m} min`;
}

function computeSplits(routePoints: RoutePoint[], totalDuration: number, totalDistance: number) {
  if (!routePoints || routePoints.length < 2 || totalDistance < 0.5) return [];
  const splits: { km: number; paceSecPerKm: number }[] = [];
  let cumDist = 0;
  let lastKmIdx = 0;

  for (let i = 1; i < routePoints.length; i++) {
    const prev = routePoints[i - 1];
    const cur = routePoints[i];
    const dLat = ((cur.lat - prev.lat) * Math.PI) / 180;
    const dLng = ((cur.lng - prev.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((prev.lat * Math.PI) / 180) *
        Math.cos((cur.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const segDist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    cumDist += segDist;

    if (cumDist >= splits.length + 1) {
      const splitDuration =
        ((cur.timestamp - routePoints[lastKmIdx].timestamp) / 1000);
      splits.push({ km: splits.length + 1, paceSecPerKm: Math.round(splitDuration) });
      lastKmIdx = i;
    }
  }
  return splits;
}

// Route visualizer — draws a connected polyline using angled View segments
function RouteVisualizer({ points, color }: { points: RoutePoint[]; color: string }) {
  if (!points || points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;

  const W = 300;
  const H = 160;
  const PAD = 16;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  // Sample down to ~60 points for performance
  const step = Math.max(1, Math.floor(points.length / 60));
  const sampled = points.filter((_, i) => i % step === 0);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1]);
  }

  const toXY = (p: RoutePoint) => ({
    x: PAD + ((p.lng - minLng) / lngRange) * innerW,
    y: PAD + ((maxLat - p.lat) / latRange) * innerH,
  });

  const coords = sampled.map(toXY);

  // Build line segments between consecutive points
  const segments = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const x1 = coords[i].x;
    const y1 = coords[i].y;
    const x2 = coords[i + 1].x;
    const y2 = coords[i + 1].y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 0.5) continue;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    segments.push({ x1, y1, length, angle });
  }

  const start = coords[0];
  const end = coords[coords.length - 1];

  return (
    <View
      style={{
        width: W,
        height: H,
        backgroundColor: color + '12',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: color + '35',
        alignSelf: 'center',
        marginBottom: 16,
      }}
    >
      {/* Grid lines for context */}
      {[0.25, 0.5, 0.75].map((f) => (
        <View
          key={`h${f}`}
          style={{
            position: 'absolute',
            left: 0, right: 0,
            top: H * f,
            height: 1,
            backgroundColor: color + '15',
          }}
        />
      ))}

      {/* Polyline segments */}
      {segments.map((seg, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: seg.x1,
            top: seg.y1 - 1.5,
            width: seg.length,
            height: 3,
            backgroundColor: color,
            opacity: 0.85,
            borderRadius: 2,
            transform: [{ rotate: `${seg.angle}deg` }],
            transformOrigin: '0 50%',
          }}
        />
      ))}

      {/* Start marker */}
      <View
        style={{
          position: 'absolute',
          left: start.x - 7,
          top: start.y - 7,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: '#4CAF50',
          borderWidth: 2,
          borderColor: '#fff',
        }}
      />

      {/* End marker */}
      <View
        style={{
          position: 'absolute',
          left: end.x - 7,
          top: end.y - 7,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: '#FF5722',
          borderWidth: 2,
          borderColor: '#fff',
        }}
      />
    </View>
  );
}

export default function CardioDetail({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const { sessions, setSessions } = useCardioStore();
  const params = useLocalSearchParams<{ id: string }>();
  const session = sessions.find((s) => s.id === params.id) as CardioSession | undefined;

  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [saving, setSaving] = useState(false);

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.muted }}>Session introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: theme.primary }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const activity = ACTIVITY_LABELS[session.activity_type] ?? ACTIVITY_LABELS.other;
  const date = new Date(session.date);
  const splits = session.route_data && session.distance_km
    ? computeSplits(session.route_data, session.duration_min * 60, session.distance_km)
    : [];

  // Personal best check against all other sessions of same type
  const sameTypeSessions = sessions.filter((s) => s.id !== session.id && s.activity_type === session.activity_type);
  const isPRDistance = session.distance_km != null &&
    sameTypeSessions.every((s) => (s.distance_km ?? 0) <= (session.distance_km ?? 0));
  const isPRPace = session.avg_pace_sec_per_km != null &&
    sameTypeSessions.every((s) => !s.avg_pace_sec_per_km || s.avg_pace_sec_per_km >= session.avg_pace_sec_per_km!);

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('cardio_sessions')
        .update({ notes: notes.trim() })
        .eq('id', session.id);
      if (error) throw error;
      setSessions(sessions.map((s) => s.id === session.id ? { ...s, notes: notes.trim() } : s));
      setEditingNotes(false);
    } catch (err: any) {
      showAlert('Erreur', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    showAlert(
      'Supprimer',
      'Supprimer cette session définitivement ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('cardio_sessions').delete().eq('id', session.id);
              setSessions(sessions.filter((s) => s.id !== session.id));
              router.back();
            } catch (err: any) {
              showAlert('Erreur', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero header */}
        <View style={{
          backgroundColor: activity.color + '18',
          paddingTop: 20, paddingHorizontal: 20, paddingBottom: 28,
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Ionicons name="arrow-back" size={24} color={activity.color} />
            </TouchableOpacity>
            <Text style={{ color: activity.color, fontWeight: '700', fontSize: 14, flex: 1 }}>
              {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color="#F44336" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Text style={{ fontSize: 48 }}>{activity.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900' }}>
                {session.title ?? activity.label}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>
                {activity.label}
              </Text>
            </View>
          </View>

          {/* PR badges */}
          {(isPRDistance || isPRPace) && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {isPRDistance && (
                <View style={{ backgroundColor: '#FFD700', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                  <Ionicons name="trophy" size={12} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>Record distance</Text>
                </View>
              )}
              {isPRPace && (
                <View style={{ backgroundColor: '#FF5C1A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                  <Ionicons name="flash" size={12} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>Record allure</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={{ padding: 20 }}>
          {/* Main stats grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Durée', value: formatTime(session.duration_min), icon: 'time-outline', color: '#2196F3' },
              ...(session.distance_km != null
                ? [{ label: 'Distance', value: `${session.distance_km.toFixed(2)} km`, icon: 'map-outline', color: '#FF5722' }]
                : []),
              ...(session.avg_pace_sec_per_km != null
                ? [{ label: session.activity_type === 'cycling' ? 'Vitesse moy.' : 'Allure moy.',
                    value: session.activity_type === 'cycling'
                      ? `${((session.distance_km ?? 0) / (session.duration_min / 60)).toFixed(1)} km/h`
                      : formatPace(session.avg_pace_sec_per_km),
                    icon: 'speedometer-outline', color: '#FF9800' }]
                : []),
              ...(session.calories_burned != null
                ? [{ label: 'Calories', value: `${session.calories_burned} kcal`, icon: 'flame-outline', color: '#F44336' }]
                : []),
              ...(session.avg_heart_rate != null
                ? [{ label: 'Fréq. cardiaque', value: `${session.avg_heart_rate} bpm`, icon: 'heart-outline', color: '#E91E63' }]
                : []),
              ...(session.elevation_gain_m != null
                ? [{ label: 'Dénivelé', value: `+${Math.round(session.elevation_gain_m)} m`, icon: 'trending-up-outline', color: '#4CAF50' }]
                : []),
            ].map(({ label, value, icon, color }) => (
              <View
                key={label}
                style={{
                  width: '47%', backgroundColor: theme.surface, borderRadius: 16, padding: 16,
                  borderWidth: 1, borderColor: theme.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: color + '20', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name={icon as any} size={14} color={color} />
                  </View>
                  <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
                </View>
                <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
              </View>
            ))}
          </View>

          {/* Route visualization */}
          {session.route_data && session.route_data.length > 2 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Parcours</Text>
              <RouteVisualizer points={session.route_data} color={activity.color} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50' }} />
                  <Text style={{ color: theme.muted, fontSize: 12 }}>Départ</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF5722' }} />
                  <Text style={{ color: theme.muted, fontSize: 12 }}>Arrivée</Text>
                </View>
              </View>
            </View>
          )}

          {/* Splits */}
          {splits.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Splits</Text>
              <View style={{ backgroundColor: theme.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.border }}>
                <View style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                  <Text style={{ flex: 1, color: theme.muted, fontSize: 12, fontWeight: '600' }}>KM</Text>
                  <Text style={{ flex: 1, color: theme.muted, fontSize: 12, fontWeight: '600', textAlign: 'right' }}>ALLURE</Text>
                </View>
                {splits.map((split, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row', padding: 14,
                      borderBottomWidth: i < splits.length - 1 ? 1 : 0,
                      borderBottomColor: theme.border,
                      backgroundColor: i % 2 === 0 ? 'transparent' : theme.background + '80',
                    }}
                  >
                    <Text style={{ flex: 1, color: theme.text, fontWeight: '600' }}>{split.km}</Text>
                    <Text style={{ flex: 1, color: activity.color, fontWeight: '700', textAlign: 'right' }}>
                      {formatPace(split.paceSecPerKm)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Notes */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Notes</Text>
              {!editingNotes && (
                <TouchableOpacity onPress={() => setEditingNotes(true)}>
                  <Ionicons name="pencil-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
              )}
            </View>
            {editingNotes ? (
              <View>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Comment s'est passée cette session ?"
                  placeholderTextColor={theme.muted}
                  style={{
                    backgroundColor: theme.surface, borderRadius: 14, padding: 16,
                    color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border,
                    minHeight: 80, textAlignVertical: 'top', marginBottom: 12,
                  }}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => { setEditingNotes(false); setNotes(session.notes ?? ''); }}
                    style={{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
                  >
                    <Text style={{ color: theme.text, fontWeight: '600' }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveNotes}
                    disabled={saving}
                    style={{ flex: 2, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Sauvegarder</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setEditingNotes(true)}
                style={{
                  backgroundColor: theme.surface, borderRadius: 14, padding: 16,
                  borderWidth: 1, borderColor: theme.border, minHeight: 60,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: session.notes ? theme.text : theme.muted, fontSize: 15, lineHeight: 22 }}>
                  {session.notes || 'Ajouter des notes...'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
