import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadComments, addComment, likePost, unlikePost, type PostComment } from '../store';

interface Props {
  supabase: SupabaseClient;
  postId?: string;
  onBack: () => void;
}

export default function PostDetailScreen({ supabase, postId, onBack }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const [post, setPost] = useState<{ content: string; likes_count: number; liked_by_me: boolean } | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!postId) { setLoadingComments(false); return; }

    setLoadingComments(true);
    const [{ data: postRow }, fetchedComments] = await Promise.all([
      supabase.from('community_posts').select('content, likes_count').eq('id', postId).single(),
      loadComments(supabase, postId),
    ]);

    const { data: { user } } = await supabase.auth.getUser();
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

    setPost(postRow ? { content: postRow.content, likes_count: postRow.likes_count, liked_by_me: likedByMe } : null);
    setLikeCount(postRow?.likes_count ?? 0);
    setLiked(likedByMe);
    setComments(fetchedComments);
    setLoadingComments(false);
  }, [postId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLike = async () => {
    if (!postId) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      await unlikePost(supabase, postId);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      await likePost(supabase, postId);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !postId || submitting) return;
    setSubmitting(true);
    await addComment(supabase, postId, commentText.trim());
    setCommentText('');
    const fresh = await loadComments(supabase, postId);
    setComments(fresh);
    setSubmitting(false);
  };

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}j`;
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
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>Publication</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}>
        {/* Post content */}
        {post && (
          <View style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 16 }}>
            <Text style={{ fontSize: 15, color: theme.text, lineHeight: 22 }}>{post.content}</Text>
            <TouchableOpacity onPress={handleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? theme.primary : theme.muted} />
              <Text style={{ fontSize: 13, color: liked ? theme.primary : theme.muted, fontWeight: '600' }}>{likeCount}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Comments */}
        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Commentaires ({comments.length})
        </Text>

        {loadingComments ? (
          <ActivityIndicator color={theme.primary} />
        ) : comments.length === 0 ? (
          <Text style={{ color: theme.muted, fontSize: 13 }}>Sois le premier à commenter !</Text>
        ) : (
          comments.map((c, i) => (
            <View key={c.id} style={{
              flexDirection: 'row', gap: 10, paddingVertical: 10,
              borderBottomWidth: i < comments.length - 1 ? 1 : 0,
              borderBottomColor: theme.border,
            }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>
                  {(c.profile?.name ?? '?').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>{c.profile?.name ?? 'Utilisateur'}</Text>
                  <Text style={{ fontSize: 11, color: theme.muted }}>· {relativeTime(c.created_at)}</Text>
                </View>
                <Text style={{ fontSize: 13, color: theme.text }}>{c.content}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Comment input */}
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
          style={{ flex: 1, fontSize: 14, color: theme.text, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.background, borderRadius: 20, borderWidth: 1, borderColor: theme.border }}
          maxLength={300}
          multiline
        />
        <TouchableOpacity
          onPress={handleSubmitComment}
          disabled={!commentText.trim() || submitting}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', opacity: (!commentText.trim() || submitting) ? 0.4 : 1 }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
