import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useHydrationStore } from '../store';
import type { Container } from '../store';

// Cross-plugin: habits store for water habit sync
let useHabitsStore: any = null;
try { useHabitsStore = require('@ziko/plugin-habits').useHabitsStore; } catch {}

export default function HydrationDashboard({ supabase }: { supabase: any }) {
  const {
    logs, setLogs, goalMl, setGoalMl, loading, setLoading,
    getTodayTotal, getTodayProgress, addLog,
    containers, addContainer, updateContainer, removeContainer,
    favoriteContainerId, setFavoriteContainer, saveSettings,
  } = useHydrationStore();
  const theme = useThemeStore((s) => s.theme);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newMl, setNewMl] = useState('');
  const [newIcon, setNewIcon] = useState('🥤');

  // Cross-plugin: habits data (select individually to avoid infinite loop)
  const habitsHabits = useHabitsStore ? useHabitsStore((s: any) => s.habits) : [];
  const habitsGetStreak = useHabitsStore ? useHabitsStore((s: any) => s.getStreak) : null;
  const habitsUpdateLog = useHabitsStore ? useHabitsStore((s: any) => s.updateLog) : null;
  const waterHabit = habitsHabits?.find((h: any) => h.source === 'hydration_auto' || h.emoji === '💧');
  const waterStreak = waterHabit && habitsGetStreak ? habitsGetStreak(waterHabit.id) : 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('hydration_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: false });

      setLogs(data ?? []);

      // Load goal from user profile or hydration settings
      const { data: profile } = await supabase
        .from('user_plugins')
        .select('settings')
        .eq('user_id', user.id)
        .eq('plugin_id', 'hydration')
        .single();

      if (profile?.settings?.goal_ml) {
        setGoalMl(profile.settings.goal_ml);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleAddWater = async (ml: number) => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data, error } = await supabase
        .from('hydration_logs')
        .insert({ user_id: userId, amount_ml: ml, date: today })
        .select('*')
        .single();

      if (error) throw error;
      addLog(data);

      // Cross-plugin: sync water habit in habits plugin
      if (waterHabit && userId) {
        const newTotal = getTodayTotal() + ml;
        const glasses = Math.floor(newTotal / 250);
        try {
          await supabase.from('habit_logs').upsert({
            habit_id: waterHabit.id, user_id: userId, date: today, value: glasses,
          }, { onConflict: 'habit_id,date' });
          habitsUpdateLog?.(waterHabit.id, glasses);
        } catch {}
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de sauvegarder');
    }
  };

  const todayTotal = getTodayTotal();
  const progress = getTodayProgress();
  const glasses = Math.floor(todayTotal / 250);
  const remaining = Math.max(0, goalMl - todayTotal);

  // Wave color interpolation
  const waveColor = progress >= 1 ? '#4CAF50' : theme.primary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>Hydratation</Text>
          <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>
            Objectif : {(goalMl / 1000).toFixed(1)}L par jour
          </Text>
        </View>

        {/* Progress circle */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: 24, padding: 28,
          alignItems: 'center', borderWidth: 1, borderColor: theme.border, marginBottom: 24,
        }}>
          <View style={{
            width: 180, height: 180, borderRadius: 90,
            borderWidth: 8, borderColor: theme.border,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: waveColor + '11',
          }}>
            <Ionicons name="water" size={32} color={waveColor} />
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 32, marginTop: 4 }}>
              {todayTotal >= 1000 ? `${(todayTotal / 1000).toFixed(1)}L` : `${todayTotal}ml`}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>
              {Math.round(progress * 100)}%
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 20 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18 }}>{glasses}</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>verres</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18 }}>
                {remaining >= 1000 ? `${(remaining / 1000).toFixed(1)}L` : `${remaining}ml`}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>restant</Text>
            </View>
          </View>

          {progress >= 1 && (
            <View style={{
              backgroundColor: '#4CAF50' + '22', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16,
            }}>
              <Text style={{ color: '#4CAF50', fontWeight: '600', fontSize: 14 }}>
                ✅ Objectif atteint !
              </Text>
            </View>
          )}
        </View>

        {/* Quick add buttons from containers */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Ajouter</Text>
          <TouchableOpacity onPress={() => setShowContainerModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="settings-outline" size={16} color={theme.primary} />
            <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>Récipients</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          {containers.map((item) => {
            const isFav = favoriteContainerId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleAddWater(item.ml)}
                style={{
                  flex: 1, minWidth: '45%',
                  backgroundColor: theme.surface, borderRadius: 16, padding: 16,
                  borderWidth: isFav ? 2 : 1, borderColor: isFav ? theme.primary : theme.border,
                  alignItems: 'center', gap: 6,
                }}
              >
                {isFav && (
                  <View style={{ position: 'absolute', top: 8, right: 8 }}>
                    <Ionicons name="star" size={14} color={theme.primary} />
                  </View>
                )}
                <Text style={{ fontSize: 28 }}>{item.icon}</Text>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{item.label}</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>{item.ml}ml</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Today's log */}
        {logs.length > 0 && (
          <>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
              Aujourd'hui
            </Text>
            {logs.filter((l) => l.date === new Date().toISOString().split('T')[0]).map((log) => (
              <View
                key={log.id}
                style={{
                  backgroundColor: theme.surface, borderRadius: 12, padding: 12, marginBottom: 8,
                  borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
                }}
              >
                <Ionicons name="water" size={18} color={theme.primary} />
                <Text style={{ color: theme.text, fontWeight: '500', fontSize: 14, flex: 1 }}>
                  {log.amount_ml}ml
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                  {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Cross-plugin: habits link */}
        {useHabitsStore && waterHabit && (
          <TouchableOpacity
            onPress={() => router.push('/(app)/(plugins)/habits/dashboard' as any)}
            style={{
              backgroundColor: '#2196F3' + '11', borderRadius: 16, padding: 14,
              marginBottom: 16, borderWidth: 1, borderColor: '#2196F3' + '33',
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#2196F318', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-done" size={20} color="#2196F3" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                Habitude Eau {useHabitsStore ? `— ${Math.floor(getTodayTotal() / 250)} / ${waterHabit.target} verres` : ''}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>
                {waterStreak > 0 ? `🔥 ${waterStreak} jours consécutifs` : 'Synchronisé avec vos habitudes'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#2196F3" />
          </TouchableOpacity>
        )}

        {/* Cross-plugin links */}
        <View style={{ marginTop: 20, gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.push('/(app)/(plugins)/nutrition/dashboard' as any)}
            style={{
              backgroundColor: theme.surface, borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FF5C1A18', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>🥗</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Nutrition</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>Suivre vos repas en plus de l'eau</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(app)/workout/session' as any)}
            style={{
              backgroundColor: theme.surface, borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="barbell" size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Avant le workout</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>Pensez à bien boire avant la séance</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Container management modal */}
      <Modal visible={showContainerModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 20 }}>Mes récipients</Text>
            <TouchableOpacity onPress={() => { setShowContainerModal(false); setEditingContainer(null); }}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 100 }}>
            {containers.map((c) => {
              const isFav = favoriteContainerId === c.id;
              return (
                <View key={c.id} style={{
                  backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 10,
                  borderWidth: isFav ? 2 : 1, borderColor: isFav ? theme.primary : theme.border,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  <Text style={{ fontSize: 28 }}>{c.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{c.label}</Text>
                    <Text style={{ color: theme.muted, fontSize: 12 }}>{c.ml}ml</Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    setFavoriteContainer(isFav ? null : c.id);
                    saveSettings(supabase);
                  }} style={{ padding: 6 }}>
                    <Ionicons name={isFav ? 'star' : 'star-outline'} size={20} color={isFav ? theme.primary : theme.muted} />
                  </TouchableOpacity>
                  {!c.isDefault && (
                    <>
                      <TouchableOpacity onPress={() => {
                        setEditingContainer(c);
                        setNewLabel(c.label);
                        setNewMl(String(c.ml));
                        setNewIcon(c.icon);
                      }} style={{ padding: 6 }}>
                        <Ionicons name="pencil-outline" size={18} color={theme.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => {
                        Alert.alert('Supprimer', `Supprimer "${c.label}" ?`, [
                          { text: 'Annuler', style: 'cancel' },
                          { text: 'Supprimer', style: 'destructive', onPress: () => { removeContainer(c.id); saveSettings(supabase); } },
                        ]);
                      }} style={{ padding: 6 }}>
                        <Ionicons name="trash-outline" size={18} color="#F44336" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}

            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 8, marginBottom: 16 }}>
              ⭐ Le récipient favori sera utilisé comme bouton rapide pendant vos entraînements.
            </Text>

            {/* Add / Edit container form */}
            <View style={{
              backgroundColor: theme.surface, borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: theme.border,
            }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
                {editingContainer ? 'Modifier le récipient' : 'Ajouter un récipient'}
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                {['🥤', '🫗', '☕', '🍵', '🧃', '🥛', '🍶', '💧', '🧴', '🏺'].map((emoji) => (
                  <TouchableOpacity key={emoji} onPress={() => setNewIcon(emoji)} style={{
                    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: newIcon === emoji ? theme.primary + '22' : theme.background,
                    borderWidth: 1, borderColor: newIcon === emoji ? theme.primary : theme.border,
                  }}>
                    <Text style={{ fontSize: 18 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                value={newLabel}
                onChangeText={setNewLabel}
                placeholder="Nom (ex: Shaker)"
                placeholderTextColor={theme.muted}
                style={{
                  backgroundColor: theme.background, borderRadius: 10, borderWidth: 1, borderColor: theme.border,
                  paddingHorizontal: 14, paddingVertical: 10, color: theme.text, fontSize: 14, marginBottom: 10,
                }}
              />

              <TextInput
                value={newMl}
                onChangeText={setNewMl}
                placeholder="Contenance en ml (ex: 600)"
                placeholderTextColor={theme.muted}
                keyboardType="number-pad"
                style={{
                  backgroundColor: theme.background, borderRadius: 10, borderWidth: 1, borderColor: theme.border,
                  paddingHorizontal: 14, paddingVertical: 10, color: theme.text, fontSize: 14, marginBottom: 14,
                }}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                {editingContainer && (
                  <TouchableOpacity
                    onPress={() => { setEditingContainer(null); setNewLabel(''); setNewMl(''); setNewIcon('🥤'); }}
                    style={{ flex: 1, backgroundColor: theme.background, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
                  >
                    <Text style={{ color: theme.muted, fontWeight: '600' }}>Annuler</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    const ml = parseInt(newMl);
                    if (!newLabel.trim() || !ml || ml <= 0) {
                      Alert.alert('Erreur', 'Remplissez le nom et la contenance.');
                      return;
                    }
                    if (editingContainer) {
                      updateContainer(editingContainer.id, { label: newLabel.trim(), ml, icon: newIcon });
                      setEditingContainer(null);
                    } else {
                      addContainer({ id: `custom-${Date.now()}`, label: newLabel.trim(), ml, icon: newIcon });
                    }
                    setNewLabel('');
                    setNewMl('');
                    setNewIcon('🥤');
                    saveSettings(supabase);
                  }}
                  style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {editingContainer ? 'Modifier' : 'Ajouter'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
