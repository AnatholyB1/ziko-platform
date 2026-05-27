import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { supabase } from '../../../../src/lib/supabase';

// ── Types ──────────────────────────────────────────────────────

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_name: string | null;
}

// ── Helpers ────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "a l'instant";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}j`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Screen ────────────────────────────────────────────────────

export default function PostDetailRoute() {
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const theme = useThemeStore((s) => s.theme);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!postId) { setLoading(false); return; }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      // Load post with author info
      const { data: postRow } = await supabase
        .from('community_posts')
        .select('id, content, image_url, likes_count, comments_count, created_at, user_id, user_profiles!inner(name, avatar_url)')
        .eq('id', postId)
        .single();

      // Load comments with author info
      const { data: commentRows } = await supabase
        .from('post_comments')
        .select('id, content, created_at, user_id, user_profiles!inner(name)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .limit(30);

      // Check if liked
      let likedByMe = false;
      if (user && postId) {
        const { data: like } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle();
        likedByMe = !!like;
      }

      if (postRow) {
        const profile = (postRow as any).user_profiles;
        setPost({
          id: postRow.id,
          content: postRow.content,
          image_url: postRow.image_url,
          likes_count: postRow.likes_count ?? 0,
          comments_count: postRow.comments_count ?? 0,
          created_at: postRow.created_at,
          author_name: profile?.name ?? null,
          author_avatar: profile?.avatar_url ?? null,
        });
        setLikeCount(postRow.likes_count ?? 0);
      }

      setLiked(likedByMe);

      setComments(
        (commentRows ?? []).map((c: any) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          author_name: c.user_profiles?.name ?? null,
        }))
      );
    } catch (e) {
      // silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLike = async () => {
    if (!postId || !userId) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !postId || submitting) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showAlert('Erreur', 'Non connecte'); return; }

      await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: user.id,
        content: commentText.trim(),
      });

      setCommentText('');
      await loadData();
    } catch {
      showAlert('Erreur', 'Impossible d\'envoyer le commentaire');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: 1, borderBottomColor: theme.border,
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 36, height: 36, borderRadius: 11,
              backgroundColor: `${theme.text}0F`,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Publication</Text>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

            {/* Post card */}
            {post ? (
              <View style={{
                backgroundColor: theme.surface, borderRadius: 16,
                borderWidth: 1, borderColor: theme.border, padding: 16, marginBottom: 16,
                shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
              }}>
                {/* Author row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: `${theme.primary}18`,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: theme.primary }}>
                      {(post.author_name ?? '?').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                      {post.author_name ?? 'Utilisateur'}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.muted }}>{formatDate(post.created_at)}</Text>
                  </View>
                </View>

                {/* Post body */}
                <Text style={{ fontSize: 15, color: theme.text, lineHeight: 22, marginBottom: 14 }}>
                  {post.content}
                </Text>

                {/* Like & comment counts */}
                <View style={{ flexDirection: 'row', gap: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
                  <TouchableOpacity onPress={handleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={liked ? 'heart' : 'heart-outline'}
                      size={20}
                      color={liked ? theme.primary : theme.muted}
                    />
                    <Text style={{ fontSize: 13, color: liked ? theme.primary : theme.muted, fontWeight: '600' }}>
                      {likeCount}
                    </Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="chatbubble-outline" size={18} color={theme.muted} />
                    <Text style={{ fontSize: 13, color: theme.muted, fontWeight: '600' }}>
                      {comments.length}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ color: theme.muted }}>Publication introuvable</Text>
              </View>
            )}

            {/* Comments section */}
            <Text style={{
              fontSize: 10, fontWeight: '800', color: theme.muted,
              letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
            }}>
              Commentaires ({comments.length})
            </Text>

            {comments.length === 0 ? (
              <Text style={{ color: theme.muted, fontSize: 13, paddingLeft: 4 }}>
                Sois le premier a commenter !
              </Text>
            ) : (
              <View style={{ gap: 0 }}>
                {comments.map((c, i) => (
                  <View
                    key={c.id}
                    style={{
                      flexDirection: 'row', gap: 10, paddingVertical: 12,
                      borderBottomWidth: i < comments.length - 1 ? 1 : 0,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <View style={{
                      width: 32, height: 32, borderRadius: 16,
                      backgroundColor: `${theme.primary}18`,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>
                        {(c.author_name ?? '?').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>
                          {c.author_name ?? 'Utilisateur'}
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.muted }}>
                          · {relativeTime(c.created_at)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, color: theme.text, lineHeight: 18 }}>{c.content}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Comment input bar */}
        <View style={{
          flexDirection: 'row', gap: 10, padding: 12,
          borderTopWidth: 1, borderTopColor: theme.border,
          backgroundColor: theme.surface,
        }}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Ajouter un commentaire..."
            placeholderTextColor={theme.muted}
            style={{
              flex: 1, fontSize: 14, color: theme.text,
              paddingVertical: 8, paddingHorizontal: 12,
              backgroundColor: theme.background, borderRadius: 20,
              borderWidth: 1, borderColor: theme.border,
            }}
            maxLength={300}
            multiline
          />
          <TouchableOpacity
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || submitting}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: theme.primary,
              alignItems: 'center', justifyContent: 'center',
              opacity: (!commentText.trim() || submitting) ? 0.4 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
