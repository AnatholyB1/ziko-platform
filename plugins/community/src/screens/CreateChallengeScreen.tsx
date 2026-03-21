import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCommunityStore, createChallenge } from '../store';

const SCORING_OPTIONS = [
  { value: 'volume', label: 'Volume total', icon: 'barbell', desc: 'Kg soulevés au total' },
  { value: 'sessions', label: 'Séances', icon: 'fitness', desc: 'Nombre de séances complétées' },
  { value: 'xp', label: 'XP', icon: 'star', desc: 'Points d\'expérience gagnés' },
  { value: 'habits', label: 'Habitudes', icon: 'checkmark-circle', desc: 'Habitudes complétées' },
];

export default function CreateChallengeScreen({ supabase }: { supabase: any }) {
  const { friends } = useCommunityStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'1v1' | 'team'>('1v1');
  const [scoring, setScoring] = useState('volume');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [prizeCoins, setPrizeCoins] = useState('0');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [teamNames, setTeamNames] = useState(['Équipe 1', 'Équipe 2']);
  const [submitting, setSubmitting] = useState(false);

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!title.trim()) return Alert.alert('Erreur', 'Donne un titre au défi');
    if (!endDate) return Alert.alert('Erreur', 'Choisis une date de fin');

    setSubmitting(true);
    try {
      const result = await createChallenge(supabase, {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        scoring,
        startDate,
        endDate,
        prizeCoins: parseInt(prizeCoins) || 0,
        teams: type === 'team' ? teamNames.map((n) => ({ name: n })) : undefined,
        invitedUserIds: selectedFriends.length > 0 ? selectedFriends : undefined,
      });

      if (result) {
        Alert.alert('Créé !', 'Ton défi a été créé');
        router.back();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1A17" />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1C1A17', flex: 1 }}>Nouveau Défi</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 6 }}>Titre</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Qui soulève le plus en 7 jours ?"
            placeholderTextColor="#B0ADA8"
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA',
              paddingHorizontal: 14, height: 46, fontSize: 15, color: '#1C1A17',
            }}
          />
        </View>

        {/* Description */}
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 6 }}>Description (optionnel)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Règles du défi..."
            placeholderTextColor="#B0ADA8"
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA',
              paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1C1A17',
              minHeight: 80, textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Type */}
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 8 }}>Type</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {([['1v1', '1v1', 'flash'], ['team', 'Équipe', 'people']] as const).map(([val, label, icon]) => {
              const active = type === val;
              return (
                <TouchableOpacity key={val} onPress={() => setType(val as any)}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    height: 48, borderRadius: 14,
                    backgroundColor: active ? '#FF5C1A' : '#FFFFFF',
                    borderWidth: 1, borderColor: active ? '#FF5C1A' : '#E2E0DA',
                  }}>
                  <Ionicons name={icon as any} size={18} color={active ? '#FFFFFF' : '#7A7670'} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: active ? '#FFFFFF' : '#1C1A17' }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Team names (if team) */}
        {type === 'team' && (
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 8 }}>Noms des équipes</Text>
            {teamNames.map((name, i) => (
              <TextInput
                key={i}
                value={name}
                onChangeText={(v) => {
                  const copy = [...teamNames];
                  copy[i] = v;
                  setTeamNames(copy);
                }}
                style={{
                  backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA',
                  paddingHorizontal: 14, height: 42, fontSize: 14, color: '#1C1A17', marginBottom: 8,
                }}
              />
            ))}
            <TouchableOpacity onPress={() => setTeamNames([...teamNames, `Équipe ${teamNames.length + 1}`])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="add-circle" size={18} color="#FF5C1A" />
              <Text style={{ color: '#FF5C1A', fontSize: 13, fontWeight: '600' }}>Ajouter une équipe</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scoring */}
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 8 }}>Critère de classement</Text>
          <View style={{ gap: 8 }}>
            {SCORING_OPTIONS.map((opt) => {
              const active = scoring === opt.value;
              return (
                <TouchableOpacity key={opt.value} onPress={() => setScoring(opt.value)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    backgroundColor: active ? '#FF5C1A08' : '#FFFFFF',
                    borderRadius: 14, padding: 14,
                    borderWidth: 1, borderColor: active ? '#FF5C1A' : '#E2E0DA',
                  }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: active ? '#FF5C1A18' : '#F7F6F3',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={opt.icon as any} size={18} color={active ? '#FF5C1A' : '#7A7670'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17' }}>{opt.label}</Text>
                    <Text style={{ fontSize: 12, color: '#7A7670' }}>{opt.desc}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={22} color="#FF5C1A" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Dates */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 6 }}>Début</Text>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#B0ADA8"
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA',
                paddingHorizontal: 14, height: 42, fontSize: 14, color: '#1C1A17',
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 6 }}>Fin</Text>
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#B0ADA8"
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA',
                paddingHorizontal: 14, height: 42, fontSize: 14, color: '#1C1A17',
              }}
            />
          </View>
        </View>

        {/* Prize */}
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 6 }}>Mise en pièces (optionnel)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 20 }}>🪙</Text>
            <TextInput
              value={prizeCoins}
              onChangeText={setPrizeCoins}
              keyboardType="numeric"
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA',
                paddingHorizontal: 14, height: 42, fontSize: 15, color: '#1C1A17', flex: 1,
              }}
            />
          </View>
        </View>

        {/* Invite friends */}
        {friends.length > 0 && (
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 8 }}>
              Inviter des amis ({selectedFriends.length} sélectionné{selectedFriends.length > 1 ? 's' : ''})
            </Text>
            <View style={{ gap: 6 }}>
              {friends.map((f) => {
                const sel = selectedFriends.includes(f.id);
                return (
                  <TouchableOpacity key={f.id} onPress={() => toggleFriend(f.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      backgroundColor: sel ? '#FF5C1A08' : '#FFFFFF',
                      borderRadius: 12, padding: 12,
                      borderWidth: 1, borderColor: sel ? '#FF5C1A' : '#E2E0DA',
                    }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: '#FF5C1A18', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ color: '#FF5C1A', fontWeight: '700', fontSize: 15 }}>
                        {(f.name || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#1C1A17' }}>
                      {f.name || 'Ami'}
                    </Text>
                    <Ionicons
                      name={sel ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={sel ? '#FF5C1A' : '#E2E0DA'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity onPress={handleCreate} disabled={submitting}
          style={{
            backgroundColor: '#FF5C1A', borderRadius: 14, paddingVertical: 16,
            alignItems: 'center', opacity: submitting ? 0.6 : 1, marginTop: 8,
          }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
            {submitting ? 'Création...' : 'Créer le défi'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
