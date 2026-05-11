import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  supabase: SupabaseClient;
  postId?: string;
  onBack: () => void;
}

const MOCK_COMMENTS = [
  { id: '1', author: 'Tom K.',   initials: 'TK', color: '#2E7BF6', text: 'Énorme 🔥 bravo pour la régularité', time: '1h' },
  { id: '2', author: 'Julie P.', initials: 'JP', color: '#2E9E5B', text: 'Tu fais quoi comme programme ?', time: '45 min' },
  { id: '3', author: 'Sam R.',   initials: 'SR', color: '#E8A33A', text: "RPE 9 c'est solide, tu visais combien ?", time: '20 min' },
];

export default function PostDetailScreen({ supabase: _supabase, postId: _postId, onBack }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(247);
  const [comment, setComment] = useState('');

  const handleLike = () => {
    setLiked((l) => !l);
    setLikeCount((c) => liked ? c - 1 : c + 1);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: theme.border,
      }}>
        <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, flex: 1 }}>Publication</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Author row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.violet, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 13, color: '#fff' }}>MA</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>Marie Adam</Text>
            <Text style={{ fontSize: 11, color: theme.muted }}>@marie.a · il y a 2h</Text>
          </View>
          <TouchableOpacity style={{
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
            borderWidth: 1, borderColor: theme.primary,
          }}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.primary }}>Suivre</Text>
          </TouchableOpacity>
        </View>

        {/* Caption */}
        <Text style={{ paddingHorizontal: 16, fontSize: 14, color: theme.text, lineHeight: 22, marginBottom: 14 }}>
          PR du jour 💪 — 175 kg au soulevé de terre. 6 mois pour passer de 140 à 175. Patience et constance, le reste suit.
        </Text>

        {/* Image placeholder */}
        <View style={{
          aspectRatio: 4 / 5, marginHorizontal: 16, borderRadius: 18, overflow: 'hidden',
          backgroundColor: theme.cardDark, alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{
            position: 'absolute', top: 14, left: 14, paddingHorizontal: 10, paddingVertical: 5,
            backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFAF6', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              🏆 PR · +5 kg
            </Text>
          </View>
          <Ionicons name="barbell-outline" size={80} color="rgba(255,250,246,0.18)" />
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 }}>
          {[{ n: '175 kg', l: 'Charge' }, { n: '5 × 1', l: 'Sets × Reps' }, { n: 'RPE 9', l: 'Intensité' }].map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>{s.n}</Text>
              <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Reactions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 14 }}>
          <TouchableOpacity onPress={handleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#E94B3C' : theme.text} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{likeCount}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="chatbubble-outline" size={19} color={theme.text} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>32</Text>
          </View>
          <Ionicons name="link-outline" size={19} color={theme.text} />
          <View style={{ flex: 1 }} />
          <Ionicons name="bookmark-outline" size={19} color={theme.text} />
        </View>

        {/* Comments */}
        <Text style={{ paddingHorizontal: 16, fontSize: 10.5, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
          Commentaires · 32
        </Text>
        {MOCK_COMMENTS.map((c, i) => (
          <View key={c.id} style={{
            flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10,
            borderBottomWidth: i < MOCK_COMMENTS.length - 1 ? 1 : 0, borderBottomColor: theme.border,
          }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '800', fontSize: 11, color: '#fff' }}>{c.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>{c.author}</Text>
                <Text style={{ fontSize: 10.5, color: theme.muted }}>· {c.time}</Text>
              </View>
              <Text style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>{c.text}</Text>
              <Text style={{ fontSize: 11, color: theme.muted, fontWeight: '700', marginTop: 4 }}>Répondre</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Reply input */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingVertical: 10,
        backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border,
      }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontWeight: '800', fontSize: 11, color: '#fff' }}>TM</Text>
        </View>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Ajoute un commentaire…"
          placeholderTextColor={theme.muted}
          style={{
            flex: 1, paddingHorizontal: 14, paddingVertical: 10,
            backgroundColor: theme.text + '0D', borderRadius: 999,
            fontSize: 13, color: theme.text,
          }}
        />
        {comment.length > 0 && (
          <TouchableOpacity style={{ backgroundColor: theme.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Envoyer</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
