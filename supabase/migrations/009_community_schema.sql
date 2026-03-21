-- ============================================================
-- 009 — Community & Social Plugin
-- Adds: friendships, chat, challenges, teams, gifts, shared
-- programs, group workouts, habit encouragements, stats
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. FRIENDSHIPS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.friendships (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id, status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friendships_select" ON public.friendships;
CREATE POLICY "friendships_select" ON public.friendships
  FOR SELECT USING (auth.uid() IN (requester_id, addressee_id));
DROP POLICY IF EXISTS "friendships_insert" ON public.friendships;
CREATE POLICY "friendships_insert" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
DROP POLICY IF EXISTS "friendships_update" ON public.friendships;
CREATE POLICY "friendships_update" ON public.friendships
  FOR UPDATE USING (auth.uid() IN (requester_id, addressee_id))
  WITH CHECK (auth.uid() IN (requester_id, addressee_id));
DROP POLICY IF EXISTS "friendships_delete" ON public.friendships;
CREATE POLICY "friendships_delete" ON public.friendships
  FOR DELETE USING (auth.uid() IN (requester_id, addressee_id));

-- ────────────────────────────────────────────────────────────
-- 2. APP INVITES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_invites (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inviter_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code   TEXT NOT NULL UNIQUE,
  used_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_invites_inviter ON public.app_invites(inviter_id);
CREATE INDEX IF NOT EXISTS idx_app_invites_code ON public.app_invites(invite_code);

ALTER TABLE public.app_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_invites_own" ON public.app_invites;
CREATE POLICY "app_invites_own" ON public.app_invites
  FOR SELECT USING (auth.uid() = inviter_id);
DROP POLICY IF EXISTS "app_invites_insert" ON public.app_invites;
CREATE POLICY "app_invites_insert" ON public.app_invites
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);
-- Anyone can read by code (for accepting)
DROP POLICY IF EXISTS "app_invites_read_code" ON public.app_invites;
CREATE POLICY "app_invites_read_code" ON public.app_invites
  FOR SELECT USING (true);

-- ────────────────────────────────────────────────────────────
-- 3. CONVERSATIONS (DM & Group chat)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name          TEXT,
  image_url     TEXT,
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.community_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members(user_id);

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conv_members_own" ON public.conversation_members;
CREATE POLICY "conv_members_own" ON public.conversation_members
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "conv_members_insert" ON public.conversation_members;
CREATE POLICY "conv_members_insert" ON public.conversation_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "conv_members_delete" ON public.conversation_members;
CREATE POLICY "conv_members_delete" ON public.conversation_members
  FOR DELETE USING (auth.uid() = user_id);

-- Conversations visible to members only
DROP POLICY IF EXISTS "conversations_member" ON public.community_conversations;
CREATE POLICY "conversations_member" ON public.community_conversations
  FOR SELECT USING (id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "conversations_insert" ON public.community_conversations;
CREATE POLICY "conversations_insert" ON public.community_conversations
  FOR INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "conversations_update" ON public.community_conversations;
CREATE POLICY "conversations_update" ON public.community_conversations
  FOR UPDATE USING (id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 4. MESSAGES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID NOT NULL REFERENCES public.community_conversations(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'gif', 'emoji', 'image', 'system')),
  content           TEXT NOT NULL,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.community_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.community_messages(sender_id);

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
-- Messages visible to conversation members
DROP POLICY IF EXISTS "messages_member" ON public.community_messages;
CREATE POLICY "messages_member" ON public.community_messages
  FOR SELECT USING (conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "messages_insert" ON public.community_messages;
CREATE POLICY "messages_insert" ON public.community_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id AND conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 5. SCREEN REACTIONS (emoji/gif overlay on friend's screen)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.screen_reactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('emoji', 'gif')),
  content       TEXT NOT NULL,
  seen          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screen_reactions_receiver ON public.screen_reactions(receiver_id, seen, created_at DESC);

ALTER TABLE public.screen_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "screen_reactions_select" ON public.screen_reactions;
CREATE POLICY "screen_reactions_select" ON public.screen_reactions
  FOR SELECT USING (auth.uid() IN (sender_id, receiver_id));
DROP POLICY IF EXISTS "screen_reactions_insert" ON public.screen_reactions;
CREATE POLICY "screen_reactions_insert" ON public.screen_reactions
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "screen_reactions_update" ON public.screen_reactions;
CREATE POLICY "screen_reactions_update" ON public.screen_reactions
  FOR UPDATE USING (auth.uid() = receiver_id);

-- ────────────────────────────────────────────────────────────
-- 6. SHARED PROGRAMS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shared_programs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id    UUID NOT NULL REFERENCES public.workout_programs(id) ON DELETE CASCADE,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_programs_receiver ON public.shared_programs(receiver_id, status);

ALTER TABLE public.shared_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shared_programs_select" ON public.shared_programs;
CREATE POLICY "shared_programs_select" ON public.shared_programs
  FOR SELECT USING (auth.uid() IN (sender_id, receiver_id));
DROP POLICY IF EXISTS "shared_programs_insert" ON public.shared_programs;
CREATE POLICY "shared_programs_insert" ON public.shared_programs
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "shared_programs_update" ON public.shared_programs;
CREATE POLICY "shared_programs_update" ON public.shared_programs
  FOR UPDATE USING (auth.uid() = receiver_id);

-- ────────────────────────────────────────────────────────────
-- 7. GROUP WORKOUTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.group_workouts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  program_id      UUID REFERENCES public.workout_programs(id) ON DELETE SET NULL,
  scheduled_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  max_participants INTEGER DEFAULT 10,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_workouts_creator ON public.group_workouts(creator_id);
CREATE INDEX IF NOT EXISTS idx_group_workouts_status ON public.group_workouts(status, scheduled_at);

ALTER TABLE public.group_workouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_workouts_read" ON public.group_workouts;
CREATE POLICY "group_workouts_read" ON public.group_workouts
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "group_workouts_insert" ON public.group_workouts;
CREATE POLICY "group_workouts_insert" ON public.group_workouts
  FOR INSERT WITH CHECK (auth.uid() = creator_id);
DROP POLICY IF EXISTS "group_workouts_update" ON public.group_workouts;
CREATE POLICY "group_workouts_update" ON public.group_workouts
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE TABLE IF NOT EXISTS public.group_workout_participants (
  group_workout_id  UUID NOT NULL REFERENCES public.group_workouts(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('invited', 'joined', 'completed', 'declined')),
  session_id        UUID REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_workout_id, user_id)
);

ALTER TABLE public.group_workout_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gwp_select" ON public.group_workout_participants;
CREATE POLICY "gwp_select" ON public.group_workout_participants
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "gwp_insert" ON public.group_workout_participants;
CREATE POLICY "gwp_insert" ON public.group_workout_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "gwp_update" ON public.group_workout_participants;
CREATE POLICY "gwp_update" ON public.group_workout_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 8. CHALLENGES (1v1 & team)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.challenges (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK (type IN ('1v1', 'team')),
  program_id      UUID REFERENCES public.workout_programs(id) ON DELETE SET NULL,
  scoring         TEXT NOT NULL DEFAULT 'volume' CHECK (scoring IN ('volume', 'sessions', 'xp', 'habits', 'custom')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  prize_coins     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status, start_date);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON public.challenges(creator_id);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "challenges_read" ON public.challenges;
CREATE POLICY "challenges_read" ON public.challenges
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "challenges_insert" ON public.challenges;
CREATE POLICY "challenges_insert" ON public.challenges
  FOR INSERT WITH CHECK (auth.uid() = creator_id);
DROP POLICY IF EXISTS "challenges_update" ON public.challenges;
CREATE POLICY "challenges_update" ON public.challenges
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE TABLE IF NOT EXISTS public.challenge_teams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id  UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  emoji         TEXT DEFAULT '⚔️',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_teams ON public.challenge_teams(challenge_id);

ALTER TABLE public.challenge_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "challenge_teams_read" ON public.challenge_teams;
CREATE POLICY "challenge_teams_read" ON public.challenge_teams
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "challenge_teams_insert" ON public.challenge_teams;
CREATE POLICY "challenge_teams_insert" ON public.challenge_teams
  FOR INSERT WITH CHECK (challenge_id IN (SELECT id FROM public.challenges WHERE creator_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id    UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id         UUID REFERENCES public.challenge_teams(id) ON DELETE SET NULL,
  score           NUMERIC NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('invited', 'joined', 'completed')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants ON public.challenge_participants(challenge_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON public.challenge_participants(user_id);

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cp_read" ON public.challenge_participants;
CREATE POLICY "cp_read" ON public.challenge_participants
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "cp_insert" ON public.challenge_participants;
CREATE POLICY "cp_insert" ON public.challenge_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cp_update" ON public.challenge_participants;
CREATE POLICY "cp_update" ON public.challenge_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 9. XP & COIN GIFTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.xp_gifts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  message       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_gifts_receiver ON public.xp_gifts(receiver_id);
CREATE INDEX IF NOT EXISTS idx_xp_gifts_sender ON public.xp_gifts(sender_id);

ALTER TABLE public.xp_gifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "xp_gifts_select" ON public.xp_gifts;
CREATE POLICY "xp_gifts_select" ON public.xp_gifts
  FOR SELECT USING (auth.uid() IN (sender_id, receiver_id));
DROP POLICY IF EXISTS "xp_gifts_insert" ON public.xp_gifts;
CREATE POLICY "xp_gifts_insert" ON public.xp_gifts
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE TABLE IF NOT EXISTS public.coin_gifts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  message       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_gifts_receiver ON public.coin_gifts(receiver_id);
CREATE INDEX IF NOT EXISTS idx_coin_gifts_sender ON public.coin_gifts(sender_id);

ALTER TABLE public.coin_gifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coin_gifts_select" ON public.coin_gifts;
CREATE POLICY "coin_gifts_select" ON public.coin_gifts
  FOR SELECT USING (auth.uid() IN (sender_id, receiver_id));
DROP POLICY IF EXISTS "coin_gifts_insert" ON public.coin_gifts;
CREATE POLICY "coin_gifts_insert" ON public.coin_gifts
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ────────────────────────────────────────────────────────────
-- 10. HABIT ENCOURAGEMENTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.habit_encouragements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id      UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  emoji         TEXT DEFAULT '💪',
  message       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encouragements_receiver ON public.habit_encouragements(receiver_id);

ALTER TABLE public.habit_encouragements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encouragements_select" ON public.habit_encouragements;
CREATE POLICY "encouragements_select" ON public.habit_encouragements
  FOR SELECT USING (auth.uid() IN (sender_id, receiver_id));
DROP POLICY IF EXISTS "encouragements_insert" ON public.habit_encouragements;
CREATE POLICY "encouragements_insert" ON public.habit_encouragements
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ────────────────────────────────────────────────────────────
-- 11. COMMUNITY USER STATS (aggregated counters)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_user_stats (
  user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  messages_sent           INTEGER NOT NULL DEFAULT 0,
  gifs_sent               INTEGER NOT NULL DEFAULT 0,
  reactions_sent          INTEGER NOT NULL DEFAULT 0,
  challenges_won          INTEGER NOT NULL DEFAULT 0,
  challenges_lost         INTEGER NOT NULL DEFAULT 0,
  challenges_tied         INTEGER NOT NULL DEFAULT 0,
  xp_gifted               INTEGER NOT NULL DEFAULT 0,
  xp_received             INTEGER NOT NULL DEFAULT 0,
  coins_gifted            INTEGER NOT NULL DEFAULT 0,
  coins_received          INTEGER NOT NULL DEFAULT 0,
  programs_shared         INTEGER NOT NULL DEFAULT 0,
  group_workouts_done     INTEGER NOT NULL DEFAULT 0,
  encouragements_sent     INTEGER NOT NULL DEFAULT 0,
  encouragements_received INTEGER NOT NULL DEFAULT 0,
  invites_sent            INTEGER NOT NULL DEFAULT 0,
  invites_accepted        INTEGER NOT NULL DEFAULT 0,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_stats_read" ON public.community_user_stats;
CREATE POLICY "community_stats_read" ON public.community_user_stats
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "community_stats_own" ON public.community_user_stats;
CREATE POLICY "community_stats_own" ON public.community_user_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "community_stats_update" ON public.community_user_stats;
CREATE POLICY "community_stats_update" ON public.community_user_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 12. AUTO-CREATE COMMUNITY STATS ROW ON FIRST USE
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_community_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.community_user_stats (user_id)
  VALUES (NEW.requester_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.community_user_stats (user_id)
  VALUES (NEW.addressee_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ensure_community_stats ON public.friendships;
CREATE TRIGGER trg_ensure_community_stats
  AFTER INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION ensure_community_stats();

-- ────────────────────────────────────────────────────────────
-- 13. REGISTER COMMUNITY PLUGIN
-- ────────────────────────────────────────────────────────────

INSERT INTO public.plugins_registry (plugin_id, manifest, bundle_url, is_active, version)
VALUES (
  'community',
  '{
    "id": "community",
    "name": "Communauté",
    "version": "1.0.0",
    "description": "Invite tes amis, discute en chat, partage des programmes, lance des défis 1v1 ou en équipe, encourage les habitudes de tes potes et envoie-leur de l''XP ou des pièces !",
    "icon": "people",
    "category": "social",
    "price": "free",
    "requiredPermissions": ["read_profile", "read_workout_history", "read_community", "write_community", "notifications"],
    "userDataKeys": ["community"],
    "aiSkills": [
      {"name": "community_info", "description": "Answer questions about friends, challenges, and community stats", "triggerKeywords": ["ami","friend","communauté","community","défi","challenge","équipe","team","1v1","classement","leaderboard"]}
    ],
    "routes": [
      {"path": "/(plugins)/community/dashboard", "title": "Communauté", "icon": "people", "showInTabBar": true},
      {"path": "/(plugins)/community/friends", "title": "Amis", "icon": "person-add", "showInTabBar": false},
      {"path": "/(plugins)/community/chat", "title": "Messages", "icon": "chatbubbles", "showInTabBar": false},
      {"path": "/(plugins)/community/conversation", "title": "Chat", "icon": "chatbubble", "showInTabBar": false},
      {"path": "/(plugins)/community/challenges", "title": "Défis", "icon": "trophy", "showInTabBar": false},
      {"path": "/(plugins)/community/challenge-detail", "title": "Défi", "icon": "trophy", "showInTabBar": false},
      {"path": "/(plugins)/community/create-challenge", "title": "Nouveau Défi", "icon": "add-circle", "showInTabBar": false},
      {"path": "/(plugins)/community/compare", "title": "Comparer", "icon": "stats-chart", "showInTabBar": false},
      {"path": "/(plugins)/community/invite", "title": "Inviter", "icon": "share", "showInTabBar": false}
    ]
  }'::jsonb,
  NULL,
  TRUE,
  '1.0.0'
)
ON CONFLICT (plugin_id) DO UPDATE
  SET manifest = EXCLUDED.manifest,
      version  = EXCLUDED.version;
