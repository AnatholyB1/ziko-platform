# Replace Mock Data with Real Supabase Data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les 3 sources de données mockées par des vraies données Supabase : le fil d'actualité communautaire, les commentaires sur un post, et l'historique/stats d'un exercice.

**Architecture:**
- Community posts/comments : nouvelle migration SQL (033) avec tables `community_posts`, `post_likes`, `post_comments` + fonctions dans le store existant de la communauté.
- Lift detail : aucune nouvelle table — les données sont déjà dans `session_sets` + `workout_sessions`. On ajoute une fonction de chargement et on branche l'UI.

**Tech Stack:** Supabase PostgreSQL + RLS, React Native, Zustand, TypeScript, Expo Router

---

## Fichiers concernés

| Action | Fichier |
|--------|---------|
| Créer | `supabase/migrations/033_community_posts.sql` |
| Modifier | `plugins/community/src/store.ts` |
| Modifier | `plugins/community/src/screens/CommunityDashboard.tsx` |
| Modifier | `plugins/community/src/screens/PostDetailScreen.tsx` |
| Modifier | `apps/mobile/app/(app)/profile/index.tsx` |
| Modifier | `apps/mobile/app/(app)/profile/lift-detail.tsx` |

---

## PARTIE A — Feed communautaire & Commentaires

### Task 1: Migration SQL 033

**Files:**
- Create: `supabase/migrations/033_community_posts.sql`

- [ ] **Step 1: Créer la migration**

```sql
-- supabase/migrations/033_community_posts.sql
-- ============================================================
-- 033 — Community Posts, Likes & Comments
-- ============================================================

-- ── 1. POSTS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_posts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content        TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  likes_count    INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_feed ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON public.community_posts(user_id, created_at DESC);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_read"   ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON public.community_posts FOR DELETE USING (auth.uid() = user_id);

-- ── 2. LIKES ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id    UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes(user_id);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_read"   ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- Trigger : maintient likes_count automatiquement
CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_likes_count ON public.post_likes;
CREATE TRIGGER trg_post_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();

-- ── 3. COMMENTS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id, created_at ASC);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_read"   ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON public.post_comments FOR DELETE USING (auth.uid() = user_id);

-- Trigger : maintient comments_count automatiquement
CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_comments_count ON public.post_comments;
CREATE TRIGGER trg_post_comments_count
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();
```

- [ ] **Step 2: Appliquer la migration via Supabase MCP**

Dans le terminal du projet (ou via Supabase MCP `apply_migration`) :
```bash
# Option A — Supabase CLI (si local stack actif)
npx supabase db push

# Option B — Coller le SQL dans Supabase Dashboard > SQL Editor
```

Vérifier que les 3 tables apparaissent dans Supabase > Table Editor.

---

### Task 2: Ajouter types + feed state dans le store communauté

**Files:**
- Modify: `plugins/community/src/store.ts`

- [ ] **Step 1: Ajouter les types Post et PostComment après la ligne `export interface HabitEncouragement {`**

Ouvrir `plugins/community/src/store.ts`. Après le bloc `HabitEncouragement` (ligne ~157), insérer :

```ts
export interface Post {
  id: string;
  user_id: string;
  content: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profile: { name: string | null; avatar_url: string | null } | null;
  liked_by_me: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: { name: string | null } | null;
}
```

- [ ] **Step 2: Ajouter `feed: Post[]` à l'interface CommunityState et à l'état initial**

Dans l'interface `CommunityState` (ligne ~189), ajouter `feed: Post[];`.

Dans `useCommunityStore` (ligne ~209), ajouter `feed: [],` dans le state initial.

Le bloc `CommunityState` doit ressembler à :

```ts
interface CommunityState {
  friends: FriendProfile[];
  pendingRequests: Friendship[];
  conversations: Conversation[];
  activeMessages: Message[];
  activeConversationId: string | null;
  challenges: Challenge[];
  activeChallenges: Challenge[];
  groupWorkouts: GroupWorkout[];
  invites: AppInvite[];
  stats: CommunityStats | null;
  recentEncouragements: HabitEncouragement[];
  recentGiftsReceived: (XpGift | CoinGift)[];
  screenReactions: ScreenReaction[];
  feed: Post[];
  isLoading: boolean;

  setData: (d: Partial<CommunityState>) => void;
  setLoading: (v: boolean) => void;
}
```

Et dans le `create<CommunityState>()` ajouter `feed: [],` avec les autres propriétés.

---

### Task 3: Ajouter loadFeed(), createPost(), likePost(), unlikePost()

**Files:**
- Modify: `plugins/community/src/store.ts`

- [ ] **Step 1: Ajouter la fonction helper `relativeTime` avant les exports de fonctions**

À la fin du fichier `plugins/community/src/store.ts`, avant `searchUsers`, ajouter :

```ts
// ── Feed helpers ─────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}
```

- [ ] **Step 2: Ajouter `loadFeed()` et `createPost()`**

Après le helper `relativeTime`, ajouter :

```ts
export async function loadFeed(supabase: any, limit = 30) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: rows } = await supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!rows || rows.length === 0) {
    useCommunityStore.getState().setData({ feed: [] });
    return;
  }

  // Fetch profiles for all post authors
  const userIds = [...new Set<string>(rows.map((r: any) => r.user_id))];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, name, avatar_url')
    .in('id', userIds);
  const profileMap = new Map<string, { name: string | null; avatar_url: string | null }>(
    (profiles ?? []).map((p: any) => [p.id, { name: p.name, avatar_url: p.avatar_url }])
  );

  // Fetch which posts the current user liked
  const postIds = rows.map((r: any) => r.id);
  const { data: myLikes } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', user.id)
    .in('post_id', postIds);
  const likedSet = new Set<string>((myLikes ?? []).map((l: any) => l.post_id));

  const feed: Post[] = rows.map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    content: row.content,
    likes_count: row.likes_count,
    comments_count: row.comments_count,
    created_at: row.created_at,
    profile: profileMap.get(row.user_id) ?? null,
    liked_by_me: likedSet.has(row.id),
  }));

  useCommunityStore.getState().setData({ feed });
}

export async function createPost(supabase: any, content: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('community_posts').insert({ user_id: user.id, content });
  await loadFeed(supabase);
}
```

- [ ] **Step 3: Ajouter `likePost()` et `unlikePost()`**

```ts
export async function likePost(supabase: any, postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });

  // Optimistic update
  const store = useCommunityStore.getState();
  store.setData({
    feed: store.feed.map((p) =>
      p.id === postId ? { ...p, likes_count: p.likes_count + 1, liked_by_me: true } : p
    ),
  });
}

export async function unlikePost(supabase: any, postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);

  // Optimistic update
  const store = useCommunityStore.getState();
  store.setData({
    feed: store.feed.map((p) =>
      p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1), liked_by_me: false } : p
    ),
  });
}
```

---

### Task 4: Ajouter loadComments() et addComment()

**Files:**
- Modify: `plugins/community/src/store.ts`

- [ ] **Step 1: Ajouter les fonctions de commentaires**

```ts
export async function loadComments(supabase: any, postId: string): Promise<PostComment[]> {
  const { data: rows } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (!rows || rows.length === 0) return [];

  const userIds = [...new Set<string>(rows.map((r: any) => r.user_id))];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, name')
    .in('id', userIds);
  const profileMap = new Map<string, { name: string | null }>(
    (profiles ?? []).map((p: any) => [p.id, { name: p.name }])
  );

  return rows.map((row: any) => ({
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    profile: profileMap.get(row.user_id) ?? null,
  }));
}

export async function addComment(supabase: any, postId: string, content: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, content });
}
```

---

### Task 5: Mettre à jour CommunityDashboard — remplacer MOCK_FEED

**Files:**
- Modify: `plugins/community/src/screens/CommunityDashboard.tsx`

- [ ] **Step 1: Remplacer l'import et supprimer MOCK_FEED**

En haut du fichier, modifier l'import du store :

```ts
import { useCommunityStore, loadCommunity, loadFeed, likePost, unlikePost, type Post } from '../store';
```

Supprimer entièrement le bloc `const MOCK_FEED = [...]` (lignes 12–16).

- [ ] **Step 2: Ajouter `feed` à la déstructuration du store**

```ts
const {
  friends, pendingRequests, conversations, activeChallenges,
  groupWorkouts, stats, recentEncouragements, feed, isLoading,
} = useCommunityStore();
```

- [ ] **Step 3: Appeler `loadFeed` aux côtés de `loadCommunity`**

Remplacer :
```ts
const load = useCallback(() => loadCommunity(supabase), []);
```
Par :
```ts
const load = useCallback(() => Promise.all([loadCommunity(supabase), loadFeed(supabase)]), []);
```

- [ ] **Step 4: Remplacer le rendu de `MOCK_FEED` par `feed`**

Remplacer tout le bloc `{MOCK_FEED.map((post) => (` par :

```tsx
{feed.length === 0 ? (
  <View style={{ alignItems: 'center', paddingVertical: 20 }}>
    <Ionicons name="newspaper-outline" size={36} color="#E2E0DA" />
    <Text style={{ color: theme.muted, fontSize: 13, marginTop: 8 }}>
      Aucune publication pour l'instant
    </Text>
  </View>
) : feed.map((post) => {
  const authorName = post.profile?.name ?? 'Utilisateur';
  const initials = authorName.slice(0, 2).toUpperCase();
  const diffMs = Date.now() - new Date(post.created_at).getTime();
  const mins = Math.floor(diffMs / 60000);
  const timeAgo = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}j`;

  return (
    <TouchableOpacity
      key={post.id}
      onPress={() => router.push(`/(app)/(plugins)/community/post?id=${post.id}` as any)}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontWeight: '800', fontSize: 12, color: theme.primary }}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>{authorName}</Text>
          <Text style={{ fontSize: 10.5, color: theme.muted }}>· {timeAgo}</Text>
        </View>
        <Text style={{ fontSize: 12.5, color: theme.text, lineHeight: 18 }} numberOfLines={2}>{post.content}</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
          <TouchableOpacity
            onPress={() => post.liked_by_me ? unlikePost(supabase, post.id) : likePost(supabase, post.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={13} color={post.liked_by_me ? theme.primary : theme.muted} />
            <Text style={{ fontSize: 11, color: post.liked_by_me ? theme.primary : theme.muted }}>{post.likes_count}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="chatbubble-outline" size={12} color={theme.muted} />
            <Text style={{ fontSize: 11, color: theme.muted }}>{post.comments_count}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
})}
```

- [ ] **Step 5: Vérifier que la compilation TypeScript passe**

```bash
cd C:\ziko-platform && rtk tsc --noEmit -p apps/mobile/tsconfig.json
```

Attendu : 0 erreurs sur les fichiers modifiés.

---

### Task 6: Mettre à jour PostDetailScreen — remplacer MOCK_COMMENTS

**Files:**
- Modify: `plugins/community/src/screens/PostDetailScreen.tsx`

- [ ] **Step 1: Remplacer les imports et supprimer MOCK_COMMENTS**

Remplacer l'entête du fichier par :

```ts
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadComments, addComment, likePost, unlikePost, type PostComment } from '../store';
```

Supprimer entièrement `const MOCK_COMMENTS = [...]` (lignes 13–17).

- [ ] **Step 2: Réécrire le composant pour charger les vraies données**

Remplacer la déclaration du composant `PostDetailScreen` par :

```tsx
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

    // Check if current user liked
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
```

- [ ] **Step 3: Vérifier la compilation TypeScript**

```bash
cd C:\ziko-platform && rtk tsc --noEmit -p apps/mobile/tsconfig.json
```

Attendu : 0 erreurs.

- [ ] **Step 4: Commit Partie A**

```bash
cd C:\ziko-platform
rtk git add supabase/migrations/033_community_posts.sql plugins/community/src/store.ts plugins/community/src/screens/CommunityDashboard.tsx plugins/community/src/screens/PostDetailScreen.tsx
rtk git commit -m "feat(community): real feed + comments — replace MOCK_FEED and MOCK_COMMENTS with Supabase data"
```

---

## PARTIE B — Lift Detail : données réelles

### Task 7: Mettre à jour profile/index.tsx pour passer l'exerciseId

**Files:**
- Modify: `apps/mobile/app/(app)/profile/index.tsx`

Le profil charge déjà les PRs via `session_sets`. Il faut aussi récupérer `exercise_id` pour le passer à l'écran lift-detail.

- [ ] **Step 1: Modifier la requête PR pour inclure exercise_id**

Trouver le bloc `loadPRs` (autour de la ligne 358). Changer :

```ts
const { data } = await supabase
  .from('session_sets')
  .select('weight_kg, reps, exercises(name)')
  .not('weight_kg', 'is', null)
  .order('weight_kg', { ascending: false })
  .limit(50);
```

Par :

```ts
const { data } = await supabase
  .from('session_sets')
  .select('exercise_id, weight_kg, reps, exercises(name)')
  .not('weight_kg', 'is', null)
  .order('weight_kg', { ascending: false })
  .limit(50);
```

- [ ] **Step 2: Inclure exerciseId dans le Map des PRs**

Trouver la boucle `for (const s of data as any[])`. Remplacer le corps par :

```ts
for (const s of data as any[]) {
  const name = s.exercises?.name ?? 'Exercice';
  if (!seen.has(name)) {
    seen.set(name, { exercise: name, exerciseId: s.exercise_id, weight: s.weight_kg, reps: s.reps ?? 1, delta: 2.5 });
  }
}
```

- [ ] **Step 3: Mettre à jour l'interface locale des PRs et le type de `prs` state**

Chercher la déclaration de state `prs` (chercher `setPrs` ou `useState` pour les PRs). Assurer que le type inclut `exerciseId`. Chercher :

```ts
const [prs, setPrs] = useState<Array<{ exercise: string; weight: number; reps: number; delta: number }>>([]);
```

Remplacer par :

```ts
const [prs, setPrs] = useState<Array<{ exercise: string; exerciseId: string; weight: number; reps: number; delta: number }>>([]);
```

- [ ] **Step 4: Mettre à jour la navigation vers lift-detail**

Trouver (autour de la ligne 205) :

```ts
router.push({ pathname: '/(app)/profile/lift-detail' as any, params: { lift: pr.exercise } })
```

Remplacer par :

```ts
router.push({ pathname: '/(app)/profile/lift-detail' as any, params: { lift: pr.exercise, exerciseId: pr.exerciseId } })
```

- [ ] **Step 5: Mettre à jour `PRsList` pour accepter exerciseId**

Trouver la définition de `PRsList` et son interface :

```ts
function PRsList({ prs }: { prs: Array<{ exercise: string; weight: number; reps: number; delta: number }> }) {
```

Remplacer par :

```ts
function PRsList({ prs }: { prs: Array<{ exercise: string; exerciseId: string; weight: number; reps: number; delta: number }> }) {
```

---

### Task 8: Réécrire lift-detail.tsx avec vraies données

**Files:**
- Modify: `apps/mobile/app/(app)/profile/lift-detail.tsx`

- [ ] **Step 1: Remplacer le contenu entier du fichier**

Le fichier actuel utilise `MOCK_HISTORY`, `STATS`, et `generateData` (données aléatoires). On le remplace intégralement :

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../../src/stores/themeStore';
import { supabase } from '../../../src/lib/supabase';

// ── Types ────────────────────────────────────────────────────

interface SessionBest {
  date: string;        // ISO string de workout_sessions.started_at
  maxWeight: number;   // kg
  bestReps: number;    // reps à ce max weight
  isPR: boolean;       // true si c'est un nouveau record progressif
}

interface LiftStats {
  totalVolumeKg: number;
  sessionCount: number;
  progressionPct: number | null; // null si pas assez de données
  estimated1RM: number;          // Epley: weight * (1 + reps/30)
}

// ── Plages ───────────────────────────────────────────────────

const RANGES = [
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 90 },
  { id: '6m', label: '6M', days: 180 },
  { id: '1a', label: '1A', days: 365 },
  { id: 'all', label: 'Tout', days: 0 },
];

// ── Chart ────────────────────────────────────────────────────

const CHART_WIDTH = Dimensions.get('window').width - 64;
const CHART_HEIGHT = 100;

function MiniChart({ data, primaryColor }: { data: number[]; primaryColor: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  return (
    <View style={{ height: CHART_HEIGHT, position: 'relative' }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: (i / 3) * CHART_HEIGHT, height: 1, backgroundColor: '#E2E0DA', opacity: 0.5 }} />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 1 }}>
        {data.map((v, i) => {
          const barH = ((v - min) / range) * (CHART_HEIGHT - 8) + 4;
          const isLast = i === data.length - 1;
          return (
            <View key={i} style={{ flex: 1, height: barH, backgroundColor: isLast ? primaryColor : `${primaryColor}44`, borderRadius: 2 }} />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 10, color: '#6B6963', fontWeight: '700' }}>{min} kg</Text>
        <Text style={{ fontSize: 10, color: '#6B6963', fontWeight: '700' }}>{max} kg</Text>
      </View>
    </View>
  );
}

// ── Loader ───────────────────────────────────────────────────

async function loadLiftHistory(
  exerciseId: string,
  rangeDays: number
): Promise<{ history: SessionBest[]; stats: LiftStats }> {
  // Filtrer par date si rangeDays > 0
  let query = supabase
    .from('session_sets')
    .select('weight_kg, reps, session_id, workout_sessions!inner(started_at, user_id)')
    .eq('exercise_id', exerciseId)
    .not('weight_kg', 'is', null)
    .order('workout_sessions(started_at)', { ascending: true });

  if (rangeDays > 0) {
    const since = new Date(Date.now() - rangeDays * 86400000).toISOString();
    query = query.gte('workout_sessions.started_at', since);
  }

  const { data } = await query.limit(500);
  if (!data || data.length === 0) {
    return { history: [], stats: { totalVolumeKg: 0, sessionCount: 0, progressionPct: null, estimated1RM: 0 } };
  }

  // Grouper par session_id → garder le meilleur set (max weight)
  const sessionMap = new Map<string, { date: string; maxWeight: number; bestReps: number; totalVolumeKg: number }>();
  for (const row of data as any[]) {
    const sid = row.session_id;
    const w = Number(row.weight_kg);
    const r = Number(row.reps ?? 1);
    const date = row.workout_sessions?.started_at ?? '';
    const existing = sessionMap.get(sid);
    if (!existing) {
      sessionMap.set(sid, { date, maxWeight: w, bestReps: r, totalVolumeKg: w * r });
    } else {
      sessionMap.set(sid, {
        date,
        maxWeight: Math.max(existing.maxWeight, w),
        bestReps: w > existing.maxWeight ? r : existing.bestReps,
        totalVolumeKg: existing.totalVolumeKg + w * r,
      });
    }
  }

  // Trier par date, marquer les PRs progressifs
  const sorted = [...sessionMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  let runningMax = 0;
  const history: SessionBest[] = sorted.map((s) => {
    const isPR = s.maxWeight > runningMax;
    if (isPR) runningMax = s.maxWeight;
    return { date: s.date, maxWeight: s.maxWeight, bestReps: s.bestReps, isPR };
  });

  // Calcul stats globales
  const totalVolumeKg = [...sessionMap.values()].reduce((acc, s) => acc + s.totalVolumeKg, 0);
  const sessionCount = sessionMap.size;
  const firstMax = history[0]?.maxWeight ?? 0;
  const lastMax = history[history.length - 1]?.maxWeight ?? 0;
  const progressionPct = firstMax > 0 && history.length >= 2
    ? Math.round(((lastMax - firstMax) / firstMax) * 100)
    : null;
  // Epley 1RM estimate from the best set
  const best = [...sessionMap.values()].reduce((a, b) => a.maxWeight > b.maxWeight ? a : b);
  const estimated1RM = Math.round(best.maxWeight * (1 + best.bestReps / 30) * 10) / 10;

  return { history, stats: { totalVolumeKg, sessionCount, progressionPct, estimated1RM } };
}

// ── Screen ───────────────────────────────────────────────────

export default function LiftDetailScreen() {
  const { lift, exerciseId } = useLocalSearchParams<{ lift: string; exerciseId: string }>();
  const theme = useThemeStore((s) => s.theme);
  const [range, setRange] = useState('3m');
  const [history, setHistory] = useState<SessionBest[]>([]);
  const [stats, setStats] = useState<LiftStats | null>(null);
  const [loading, setLoading] = useState(true);

  const exerciseName = lift ?? 'Exercice';

  useEffect(() => {
    if (!exerciseId) { setLoading(false); return; }
    setLoading(true);
    const r = RANGES.find((r) => r.id === range) ?? RANGES[1];
    loadLiftHistory(exerciseId, r.days).then(({ history: h, stats: s }) => {
      setHistory(h);
      setStats(s);
      setLoading(false);
    });
  }, [range, exerciseId]);

  const chartData = useMemo(() => history.map((h) => h.maxWeight), [history]);
  const currentPR = history.length > 0 ? history[history.length - 1].maxWeight : null;
  const prHistory = useMemo(() => history.filter((h) => h.isPR).reverse(), [history]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: `${theme.text}0F`, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, lineHeight: 24 }}>{exerciseName}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
          {/* PR Hero card */}
          <View style={{ backgroundColor: '#1C1A17', borderRadius: 16, padding: 18, marginBottom: 14, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: -30, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: `${theme.primary}55`, opacity: 0.6 }} />
            <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>Record actuel</Text>
            {currentPR !== null ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <Text style={{ fontSize: 44, fontWeight: '800', color: '#FFFAF6', lineHeight: 48 }}>{currentPR}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: 'rgba(255,250,246,0.7)' }}>kg</Text>
                  {stats?.progressionPct !== null && stats?.progressionPct !== undefined && (
                    <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: (stats.progressionPct >= 0 ? theme.success : '#E53E3E') + '44' }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: stats.progressionPct >= 0 ? theme.success : '#E53E3E' }}>
                        {stats.progressionPct >= 0 ? '+' : ''}{stats.progressionPct}%
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.6)' }}>
                  {prHistory[0] ? formatDate(prHistory[0].date) : ''}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 16, color: 'rgba(255,250,246,0.5)' }}>Aucune donnée</Text>
            )}
          </View>

          {/* Range selector */}
          <View style={{ flexDirection: 'row', gap: 4, padding: 4, marginBottom: 14, backgroundColor: `${theme.text}0D`, borderRadius: 10 }}>
            {RANGES.map((r) => {
              const active = range === r.id;
              return (
                <TouchableOpacity key={r.id} onPress={() => setRange(r.id)} style={{ flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center', backgroundColor: active ? theme.surface : 'transparent' }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: active ? theme.text : theme.muted }}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Chart */}
          {chartData.length > 0 && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 14 }}>
              <MiniChart data={chartData} primaryColor={theme.primary} />
            </View>
          )}

          {/* Stats grid */}
          {stats && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {[
                {
                  label: 'Volume total',
                  value: stats.totalVolumeKg >= 1000 ? `${(stats.totalVolumeKg / 1000).toFixed(1)} t` : `${Math.round(stats.totalVolumeKg)} kg`,
                  sub: `Sur ${RANGES.find((r) => r.id === range)?.label ?? 'tout'}`,
                  icon: 'barbell-outline' as const,
                  color: '#FF5C1A',
                },
                {
                  label: 'Séances',
                  value: String(stats.sessionCount),
                  sub: `Sur ${RANGES.find((r) => r.id === range)?.label ?? 'tout'}`,
                  icon: 'calendar-outline' as const,
                  color: '#2E7BF6',
                },
                {
                  label: 'Progression',
                  value: stats.progressionPct !== null ? `${stats.progressionPct >= 0 ? '+' : ''}${stats.progressionPct}%` : '—',
                  sub: 'Sur la période',
                  icon: 'trending-up-outline' as const,
                  color: '#2E9E5B',
                },
                {
                  label: '1RM estimé',
                  value: `${stats.estimated1RM} kg`,
                  sub: 'Formule Epley',
                  icon: 'flash-outline' as const,
                  color: '#E8A33A',
                },
              ].map((s, i) => (
                <View key={i} style={{ width: '47.5%', backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${s.color}22`, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={s.icon} size={14} color={s.color} />
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 0.6, textTransform: 'uppercase', flex: 1 }} numberOfLines={1}>{s.label}</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, lineHeight: 20 }}>{s.value}</Text>
                  <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{s.sub}</Text>
                </View>
              ))}
            </View>
          )}

          {/* PR History */}
          <Text style={{ fontSize: 10, fontWeight: '800', color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>
            Records personnels
          </Text>
          {prHistory.length === 0 ? (
            <Text style={{ color: theme.muted, fontSize: 13, paddingLeft: 4 }}>Aucun PR enregistré pour cet exercice.</Text>
          ) : (
            <View style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
              {prHistory.map((h, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border, gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                      {h.maxWeight} kg{' '}
                      <Text style={{ color: theme.muted, fontWeight: '600' }}>· {h.bestReps > 1 ? `${h.bestReps} reps` : '1 rep'}</Text>
                    </Text>
                    <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 2 }}>{formatDate(h.date)}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: `${theme.primary}22` }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>PR</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

```bash
cd C:\ziko-platform && rtk tsc --noEmit -p apps/mobile/tsconfig.json
```

Attendu : 0 erreurs.

- [ ] **Step 3: Vérifier que le join `workout_sessions!inner` est supporté**

La syntaxe `workout_sessions!inner(started_at, user_id)` est du PostgREST. Si Supabase retourne une erreur (ex: "Could not embed resource"), utiliser à la place un `select` séparé sur `workout_sessions` par `session_id`. Mais cette syntaxe est standard dans Supabase JS client v2.

- [ ] **Step 4: Commit Partie B**

```bash
cd C:\ziko-platform
rtk git add apps/mobile/app/(app)/profile/index.tsx apps/mobile/app/(app)/profile/lift-detail.tsx
rtk git commit -m "feat(profile): lift-detail with real session data — remove MOCK_HISTORY and hardcoded STATS"
```

---

## PARTIE C — Test manuel (pas de tests automatiques disponibles)

### Task 9: Vérifier les 3 zones dans l'appli

- [ ] **Step 1: Démarrer l'appli**

```bash
cd C:\ziko-platform && npm run mobile
```

- [ ] **Step 2: Tester le feed communautaire**

1. Naviguer vers le plugin Communauté → onglet "Fil"
2. Si feed vide → normal si aucun post en base → créer un post via Supabase SQL Editor :
   ```sql
   -- Remplacer <votre-user-id> par l'UUID de l'utilisateur connecté
   INSERT INTO public.community_posts (user_id, content) VALUES ('<votre-user-id>', 'Test du feed réel 🔥');
   ```
3. Pull to refresh → le post apparaît
4. Tester le like → le compteur s'incrémente / décrémente
5. Appuyer sur un post → écran PostDetailScreen s'ouvre
6. Commenter → le commentaire s'ajoute en temps réel

- [ ] **Step 3: Tester le lift-detail**

1. Naviguer vers Profil → section PRs
2. Si aucun PR visible → faire une séance avec au moins un exercice et des séries lestées
3. Appuyer sur un PR → écran lift-detail s'ouvre avec les vraies données
4. Changer la plage (1M / 3M / 6M / 1A / Tout) → les stats et le chart se mettent à jour
5. Vérifier que les PRs sont marqués correctement (badge orange)

---

## Notes d'implémentation

### Cas edge : `workout_sessions!inner` join

Si l'embed PostgREST échoue sur `workout_sessions!inner(started_at)`, remplacer la query dans `loadLiftHistory` par :

```ts
// Étape 1 : récupérer les sets
const { data: sets } = await supabase
  .from('session_sets')
  .select('exercise_id, session_id, weight_kg, reps')
  .eq('exercise_id', exerciseId)
  .not('weight_kg', 'is', null)
  .limit(500);

// Étape 2 : récupérer les dates des sessions
const sessionIds = [...new Set((sets ?? []).map((s: any) => s.session_id))];
const { data: sessions } = await supabase
  .from('workout_sessions')
  .select('id, started_at')
  .in('id', sessionIds)
  .gte('started_at', rangeDays > 0 ? new Date(Date.now() - rangeDays * 86400000).toISOString() : '2020-01-01')
  .order('started_at', { ascending: true });

const dateMap = new Map((sessions ?? []).map((s: any) => [s.id, s.started_at]));
```

### Feed communautaire — portée

Actuellement le feed montre **tous les posts** (feed global public). Pour restreindre aux amis, modifier la query dans `loadFeed` en ajoutant un filtre sur les `user_id` des amis :

```ts
// Récupérer les amis d'abord
const friendIds = useCommunityStore.getState().friends.map((f) => f.id);
query = query.in('user_id', [user.id, ...friendIds]);
```

Cela nécessite d'appeler `loadFeed` **après** `loadCommunity`. C'est déjà le cas avec `Promise.all`.
