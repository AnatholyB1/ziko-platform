import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
}

export interface FriendProfile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  goal: string | null;
}

export interface AppInvite {
  id: string;
  inviter_id: string;
  invite_code: string;
  used_by: string | null;
  created_at: string;
  used_at: string | null;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message?: Message | null;
  members?: ConversationMember[];
  unread_count?: number;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  profile?: FriendProfile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: 'text' | 'gif' | 'emoji' | 'image' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ScreenReaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  type: 'emoji' | 'gif';
  content: string;
  seen: boolean;
  created_at: string;
}

export interface SharedProgram {
  id: string;
  sender_id: string;
  receiver_id: string;
  program_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface GroupWorkout {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  program_id: string | null;
  scheduled_at: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  max_participants: number;
  created_at: string;
  participants?: GroupWorkoutParticipant[];
}

export interface GroupWorkoutParticipant {
  group_workout_id: string;
  user_id: string;
  status: 'invited' | 'joined' | 'completed' | 'declined';
  session_id: string | null;
  joined_at: string;
  profile?: FriendProfile;
}

export interface Challenge {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  type: '1v1' | 'team';
  program_id: string | null;
  scoring: 'volume' | 'sessions' | 'xp' | 'habits' | 'custom';
  start_date: string;
  end_date: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  prize_coins: number;
  created_at: string;
  participants?: ChallengeParticipant[];
  teams?: ChallengeTeam[];
}

export interface ChallengeTeam {
  id: string;
  challenge_id: string;
  name: string;
  emoji: string;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  team_id: string | null;
  score: number;
  status: 'invited' | 'joined' | 'completed';
  joined_at: string;
  profile?: FriendProfile;
}

export interface XpGift {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  message: string | null;
  created_at: string;
}

export interface CoinGift {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  message: string | null;
  created_at: string;
}

export interface HabitEncouragement {
  id: string;
  sender_id: string;
  receiver_id: string;
  habit_id: string | null;
  emoji: string;
  message: string | null;
  created_at: string;
}

export interface CommunityStats {
  user_id: string;
  messages_sent: number;
  gifs_sent: number;
  reactions_sent: number;
  challenges_won: number;
  challenges_lost: number;
  challenges_tied: number;
  xp_gifted: number;
  xp_received: number;
  coins_gifted: number;
  coins_received: number;
  programs_shared: number;
  group_workouts_done: number;
  encouragements_sent: number;
  encouragements_received: number;
  invites_sent: number;
  invites_accepted: number;
}

// ── Store ────────────────────────────────────────────────

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
  isLoading: boolean;

  setData: (d: Partial<CommunityState>) => void;
  setLoading: (v: boolean) => void;
}

export const useCommunityStore = create<CommunityState>()((set) => ({
  friends: [],
  pendingRequests: [],
  conversations: [],
  activeMessages: [],
  activeConversationId: null,
  challenges: [],
  activeChallenges: [],
  groupWorkouts: [],
  invites: [],
  stats: null,
  recentEncouragements: [],
  recentGiftsReceived: [],
  screenReactions: [],
  isLoading: false,

  setData: (data) => set(data),
  setLoading: (isLoading) => set({ isLoading }),
}));

// ── Helpers ─────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── Loaders ─────────────────────────────────────────────

export async function loadCommunity(supabase: any) {
  const store = useCommunityStore.getState();
  store.setLoading(true);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userId = user.id;

    const [friendshipsRes, conversationsRes, challengesRes, groupRes, invitesRes, statsRes, encourageRes] =
      await Promise.all([
        supabase.from('friendships').select('*').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
        supabase.from('conversation_members').select('conversation_id').eq('user_id', userId),
        supabase.from('challenges').select('*, challenge_participants(*), challenge_teams(*)').order('created_at', { ascending: false }).limit(20),
        supabase.from('group_workouts').select('*, group_workout_participants(*)').order('created_at', { ascending: false }).limit(10),
        supabase.from('app_invites').select('*').eq('inviter_id', userId),
        supabase.from('community_user_stats').select('*').eq('user_id', userId).single(),
        supabase.from('habit_encouragements').select('*').eq('receiver_id', userId).order('created_at', { ascending: false }).limit(20),
      ]);

    // Parse friends
    const friendships: Friendship[] = friendshipsRes.data ?? [];
    const accepted = friendships.filter((f) => f.status === 'accepted');
    const pending = friendships.filter((f) => f.status === 'pending' && f.addressee_id === userId);

    const friendIds = accepted.map((f) =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    );

    let friends: FriendProfile[] = [];
    if (friendIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name, avatar_url, goal')
        .in('id', friendIds);
      friends = profiles ?? [];
    }

    // Load conversations with last message
    const convIds = (conversationsRes.data ?? []).map((m: any) => m.conversation_id);
    let conversations: Conversation[] = [];
    if (convIds.length > 0) {
      const { data: convs } = await supabase
        .from('community_conversations')
        .select('*, conversation_members(user_id, last_read_at)')
        .in('id', convIds)
        .order('updated_at', { ascending: false });
      conversations = convs ?? [];
    }

    // Active challenges
    const allChallenges: Challenge[] = challengesRes.data ?? [];
    const activeChallenges = allChallenges.filter((c) =>
      c.status === 'active' || c.status === 'pending'
    );

    store.setData({
      friends,
      pendingRequests: pending,
      conversations,
      challenges: allChallenges,
      activeChallenges,
      groupWorkouts: groupRes.data ?? [],
      invites: invitesRes.data ?? [],
      stats: statsRes.data ?? null,
      recentEncouragements: encourageRes.data ?? [],
    });
  } finally {
    store.setLoading(false);
  }
}

// ── Friends ─────────────────────────────────────────────

export async function sendFriendRequest(supabase: any, addresseeId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('friendships').insert({
    requester_id: user.id,
    addressee_id: addresseeId,
  });
}

export async function acceptFriendRequest(supabase: any, friendshipId: string) {
  await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
}

export async function declineFriendRequest(supabase: any, friendshipId: string) {
  await supabase.from('friendships').delete().eq('id', friendshipId);
}

export async function removeFriend(supabase: any, friendshipId: string) {
  await supabase.from('friendships').delete().eq('id', friendshipId);
}

// ── Chat ────────────────────────────────────────────────

export async function getOrCreateDMConversation(supabase: any, friendId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if a DM already exists between these two users
  const { data: myConvs } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', user.id);

  const myConvIds = (myConvs ?? []).map((c: any) => c.conversation_id);

  if (myConvIds.length > 0) {
    const { data: shared } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', friendId)
      .in('conversation_id', myConvIds);

    if (shared && shared.length > 0) {
      // Check if it's a direct conversation
      const { data: conv } = await supabase
        .from('community_conversations')
        .select('*')
        .eq('id', shared[0].conversation_id)
        .eq('type', 'direct')
        .single();
      if (conv) return conv.id;
    }
  }

  // Create new DM
  const { data: newConv } = await supabase
    .from('community_conversations')
    .insert({ type: 'direct', created_by: user.id })
    .select()
    .single();

  await supabase.from('conversation_members').insert([
    { conversation_id: newConv.id, user_id: user.id },
    { conversation_id: newConv.id, user_id: friendId },
  ]);

  return newConv.id;
}

export async function loadMessages(supabase: any, conversationId: string, limit = 50) {
  const { data } = await supabase
    .from('community_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  useCommunityStore.getState().setData({
    activeMessages: data ?? [],
    activeConversationId: conversationId,
  });
}

export async function sendMessage(
  supabase: any,
  conversationId: string,
  content: string,
  type: 'text' | 'gif' | 'emoji' | 'image' = 'text',
  metadata: Record<string, unknown> = {}
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: msg } = await supabase
    .from('community_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      type,
      content,
      metadata,
    })
    .select()
    .single();

  // Update conversation timestamp
  await supabase
    .from('community_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  // Increment stats
  await incrementStat(supabase, user.id, type === 'gif' ? 'gifs_sent' : 'messages_sent');

  // Append locally
  if (msg) {
    const store = useCommunityStore.getState();
    if (store.activeConversationId === conversationId) {
      store.setData({ activeMessages: [...store.activeMessages, msg] });
    }
  }
}

// ── Screen Reactions ────────────────────────────────────

export async function sendScreenReaction(
  supabase: any,
  receiverId: string,
  type: 'emoji' | 'gif',
  content: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('screen_reactions').insert({
    sender_id: user.id,
    receiver_id: receiverId,
    type,
    content,
  });

  await incrementStat(supabase, user.id, 'reactions_sent');
}

export async function loadScreenReactions(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from('screen_reactions')
    .select('*')
    .eq('receiver_id', user.id)
    .eq('seen', false)
    .order('created_at', { ascending: false });

  useCommunityStore.getState().setData({ screenReactions: data ?? [] });
}

export async function markReactionSeen(supabase: any, reactionId: string) {
  await supabase.from('screen_reactions').update({ seen: true }).eq('id', reactionId);
}

// ── Shared Programs ─────────────────────────────────────

export async function shareProgram(
  supabase: any,
  receiverId: string,
  programId: string,
  message?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('shared_programs').insert({
    sender_id: user.id,
    receiver_id: receiverId,
    program_id: programId,
    message,
  });

  await incrementStat(supabase, user.id, 'programs_shared');
}

// ── Group Workouts ──────────────────────────────────────

export async function createGroupWorkout(
  supabase: any,
  data: { title: string; description?: string; programId?: string; scheduledAt?: string; maxParticipants?: number }
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: gw } = await supabase
    .from('group_workouts')
    .insert({
      creator_id: user.id,
      title: data.title,
      description: data.description,
      program_id: data.programId,
      scheduled_at: data.scheduledAt,
      max_participants: data.maxParticipants ?? 10,
    })
    .select()
    .single();

  if (gw) {
    // Creator auto-joins
    await supabase.from('group_workout_participants').insert({
      group_workout_id: gw.id,
      user_id: user.id,
      status: 'joined',
    });
  }

  return gw;
}

export async function joinGroupWorkout(supabase: any, groupWorkoutId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('group_workout_participants').insert({
    group_workout_id: groupWorkoutId,
    user_id: user.id,
    status: 'joined',
  });
}

// ── Challenges ──────────────────────────────────────────

export async function createChallenge(
  supabase: any,
  data: {
    title: string;
    description?: string;
    type: '1v1' | 'team';
    programId?: string;
    scoring: string;
    startDate: string;
    endDate: string;
    prizeCoins?: number;
    teams?: { name: string; emoji?: string }[];
    invitedUserIds?: string[];
  }
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: challenge } = await supabase
    .from('challenges')
    .insert({
      creator_id: user.id,
      title: data.title,
      description: data.description,
      type: data.type,
      program_id: data.programId,
      scoring: data.scoring,
      start_date: data.startDate,
      end_date: data.endDate,
      prize_coins: data.prizeCoins ?? 0,
    })
    .select()
    .single();

  if (!challenge) return null;

  // Create teams if team challenge
  if (data.type === 'team' && data.teams) {
    for (const team of data.teams) {
      await supabase.from('challenge_teams').insert({
        challenge_id: challenge.id,
        name: team.name,
        emoji: team.emoji ?? '⚔️',
      });
    }
  }

  // Creator auto-joins
  await supabase.from('challenge_participants').insert({
    challenge_id: challenge.id,
    user_id: user.id,
    status: 'joined',
  });

  // Invite others
  if (data.invitedUserIds) {
    const invites = data.invitedUserIds.map((uid) => ({
      challenge_id: challenge.id,
      user_id: uid,
      status: 'invited',
    }));
    await supabase.from('challenge_participants').insert(invites);
  }

  return challenge;
}

export async function joinChallenge(supabase: any, challengeId: string, teamId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('challenge_participants').upsert({
    challenge_id: challengeId,
    user_id: user.id,
    team_id: teamId ?? null,
    status: 'joined',
  });
}

export async function updateChallengeScore(supabase: any, challengeId: string, score: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('challenge_participants')
    .update({ score })
    .eq('challenge_id', challengeId)
    .eq('user_id', user.id);
}

// ── XP & Coin Gifts ────────────────────────────────────

export async function sendXpGift(supabase: any, receiverId: string, amount: number, message?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('xp_gifts').insert({
    sender_id: user.id,
    receiver_id: receiverId,
    amount,
    message,
  });

  await incrementStat(supabase, user.id, 'xp_gifted', amount);
  await incrementStat(supabase, receiverId, 'xp_received', amount);
}

export async function sendCoinGift(supabase: any, receiverId: string, amount: number, message?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Deduct from sender
  const { data: senderProfile } = await supabase
    .from('user_gamification')
    .select('coins')
    .eq('user_id', user.id)
    .single();

  if (!senderProfile || senderProfile.coins < amount) {
    throw new Error('Pas assez de pièces');
  }

  await supabase
    .from('user_gamification')
    .update({ coins: senderProfile.coins - amount })
    .eq('user_id', user.id);

  // Add to receiver
  await supabase.rpc('increment_coins', { target_user: receiverId, coin_amount: amount }).catch(async () => {
    // Fallback: manual increment
    const { data: rp } = await supabase
      .from('user_gamification')
      .select('coins')
      .eq('user_id', receiverId)
      .single();
    if (rp) {
      await supabase.from('user_gamification').update({ coins: rp.coins + amount }).eq('user_id', receiverId);
    }
  });

  await supabase.from('coin_gifts').insert({
    sender_id: user.id,
    receiver_id: receiverId,
    amount,
    message,
  });

  await incrementStat(supabase, user.id, 'coins_gifted', amount);
  await incrementStat(supabase, receiverId, 'coins_received', amount);
}

// ── Habit Encouragements ────────────────────────────────

export async function sendEncouragement(
  supabase: any,
  receiverId: string,
  habitId?: string,
  emoji = '💪',
  message?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('habit_encouragements').insert({
    sender_id: user.id,
    receiver_id: receiverId,
    habit_id: habitId ?? null,
    emoji,
    message,
  });

  await incrementStat(supabase, user.id, 'encouragements_sent');
  await incrementStat(supabase, receiverId, 'encouragements_received');
}

// ── Invites ─────────────────────────────────────────────

export async function createInvite(supabase: any): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const code = generateInviteCode();
  await supabase.from('app_invites').insert({
    inviter_id: user.id,
    invite_code: code,
  });

  await incrementStat(supabase, user.id, 'invites_sent');
  return code;
}

// ── Stats helper ────────────────────────────────────────

async function incrementStat(supabase: any, userId: string, field: string, amount = 1) {
  // Ensure row exists
  await supabase
    .from('community_user_stats')
    .upsert({ user_id: userId }, { onConflict: 'user_id' });

  const { data } = await supabase
    .from('community_user_stats')
    .select(field)
    .eq('user_id', userId)
    .single();

  if (data) {
    await supabase
      .from('community_user_stats')
      .update({ [field]: (data[field] ?? 0) + amount, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }
}

// ── Search users (for adding friends) ───────────────────

export async function searchUsers(supabase: any, query: string): Promise<FriendProfile[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('user_profiles')
    .select('id, name, avatar_url, goal')
    .neq('id', user.id)
    .ilike('name', `%${query}%`)
    .limit(20);

  return data ?? [];
}
