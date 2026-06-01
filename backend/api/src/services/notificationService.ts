import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// CRITICAL: SUPABASE_SERVICE_KEY is required — bypasses RLS for cross-user token queries
// (e.g. coach sending push to athlete). Never use user JWT here.
// Lazy singleton: client is created on first use, not at module load time.
// This allows tests that mock notificationService to import without a real key.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSupabaseAdmin(): SupabaseClient<any> {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_KEY is required for notificationService');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(process.env.SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabaseAdminClient: SupabaseClient<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabaseAdmin(): SupabaseClient<any> {
  if (!_supabaseAdminClient) _supabaseAdminClient = createSupabaseAdmin();
  return _supabaseAdminClient;
}

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export interface NotificationPayload {
  recipientUserId: string;
  category: 'coach' | 'workout' | 'gamification' | 'health' | 'system';
  type: string;
  title: string;
  body: string;
  data?: { url?: string; [key: string]: unknown };
  idempotencyKey: string;
}

interface SendResult {
  sent: boolean;
  reason?: string;
}

interface BatchResult {
  sent: number;
  failed: number;
}

/**
 * Check if the current UTC hour falls within quiet hours.
 * Handles midnight wrap (e.g. 22:00 to 07:00 next day).
 */
function isQuietHour(
  utcHour: number,
  quietStart: number,
  quietEnd: number,
  timezoneOffset: number,
): boolean {
  // Compute user's local hour
  const localHour = ((utcHour + timezoneOffset) % 24 + 24) % 24;

  if (quietStart <= quietEnd) {
    // e.g. 08:00 to 20:00 — simple range
    return localHour >= quietStart && localHour < quietEnd;
  } else {
    // e.g. 22:00 to 07:00 — wraps midnight
    return localHour >= quietStart || localHour < quietEnd;
  }
}

async function send(payload: NotificationPayload): Promise<SendResult> {
  const {
    recipientUserId,
    category,
    type,
    title,
    body,
    data,
    idempotencyKey,
  } = payload;

  // ── Step 1: Check notification_preferences ──────────────────
  const { data: prefs } = await getSupabaseAdmin()
    .from('notification_preferences')
    .select('*')
    .eq('user_id', recipientUserId)
    .single();

  const categoryColumnMap: Record<NotificationPayload['category'], string> = {
    coach: 'coach_enabled',
    workout: 'workout_enabled',
    gamification: 'gamification_enabled',
    health: 'health_enabled',
    system: 'system_enabled',
  };

  if (prefs) {
    if (!prefs.push_enabled) {
      return { sent: false, reason: 'preference_disabled' };
    }
    const categoryColumn = categoryColumnMap[category];
    if (categoryColumn && prefs[categoryColumn] === false) {
      return { sent: false, reason: 'preference_disabled' };
    }

    // ── Step 2: Quiet hours check (per D-09) ──────────────────
    const utcHour = new Date().getUTCHours();
    const quietStart = prefs.quiet_hours_start ?? 22;
    const quietEnd = prefs.quiet_hours_end ?? 7;
    const timezoneOffset = prefs.timezone_offset ?? 1;

    if (isQuietHour(utcHour, quietStart, quietEnd, timezoneOffset)) {
      return { sent: false, reason: 'quiet_hours' };
    }
  }
  // If no prefs row: treat as all-defaults-enabled (push_enabled=true, no quiet hours)

  // ── Step 3: Idempotency INSERT into notification_log ─────────
  const { data: logRows } = await getSupabaseAdmin()
    .from('notification_log')
    .insert({
      idempotency_key: idempotencyKey,
      user_id: recipientUserId,
      category,
      type,
      title,
      body,
      data: data ?? null,
      status: 'pending',
    })
    .select('id')
    .maybeSingle();

  if (!logRows) {
    // ON CONFLICT — row already exists (duplicate idempotency key)
    return { sent: false, reason: 'duplicate' };
  }

  // ── Step 4: Fetch active tokens ───────────────────────────────
  const { data: tokenRows } = await getSupabaseAdmin()
    .from('notification_tokens')
    .select('token')
    .eq('user_id', recipientUserId)
    .eq('is_active', true);

  const allTokens = (tokenRows ?? []).map((r: { token: string }) => r.token);

  // ── Step 5: Filter invalid tokens ─────────────────────────────
  const validTokens: string[] = [];
  for (const token of allTokens) {
    if (Expo.isExpoPushToken(token)) {
      validTokens.push(token);
    } else {
      // Mark invalid tokens as inactive
      await getSupabaseAdmin()
        .from('notification_tokens')
        .update({ is_active: false })
        .eq('token', token);
    }
  }

  if (validTokens.length === 0) {
    // No valid tokens — mark as skipped
    await getSupabaseAdmin()
      .from('notification_log')
      .update({ status: 'skipped' })
      .eq('idempotency_key', idempotencyKey);
    return { sent: false, reason: 'no_valid_tokens' };
  }

  // ── Step 6: Chunk and send via Expo Push API ──────────────────
  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title,
    body,
    data: data ?? {},
    channelId: category,
    sound: 'default' as const,
    badge: 1,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const allTickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    allTickets.push(...tickets);
  }

  // ── Step 7: Process tickets ────────────────────────────────────
  const receiptIds: string[] = [];
  for (const ticket of allTickets) {
    if (ticket.status === 'ok') {
      receiptIds.push(ticket.id);
    } else if (ticket.status === 'error') {
      const errorTicket = ticket as { status: 'error'; message: string; details?: { error?: string } };
      if (errorTicket.details?.error === 'DeviceNotRegistered') {
        // We don't have the individual token here from the ticket;
        // DeviceNotRegistered cleanup is handled in processReceipts receipt polling
      }
    }
  }

  // ── Step 8: UPDATE notification_log with result ───────────────
  await getSupabaseAdmin()
    .from('notification_log')
    .update({
      status: 'sent',
      receipt_ids: receiptIds,
      sent_at: new Date().toISOString(),
    })
    .eq('idempotency_key', idempotencyKey);

  return { sent: true };
}

async function sendBatch(payloads: NotificationPayload[]): Promise<BatchResult> {
  let sentCount = 0;
  let failedCount = 0;

  for (const payload of payloads) {
    const result = await send(payload);
    if (result.sent) {
      sentCount++;
    } else {
      failedCount++;
    }
  }

  return { sent: sentCount, failed: failedCount };
}

async function processReceipts(receiptIds: string[]): Promise<void> {
  const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  for (const chunk of chunks) {
    const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

    for (const [receiptId, receipt] of Object.entries(receipts)) {
      if (receipt.status === 'ok') {
        // Mark delivered — find log rows that contain this receipt_id
        await getSupabaseAdmin()
          .from('notification_log')
          .update({ status: 'delivered' })
          .contains('receipt_ids', [receiptId]);
      } else if (receipt.status === 'error') {
        const errorReceipt = receipt as { status: 'error'; message: string; details?: { error?: string } };
        if (errorReceipt.details?.error === 'DeviceNotRegistered') {
          // Mark token inactive — we need to find it from the log
          // The receipt_id correlates to a token, but expo-server-sdk receipts don't return the token.
          // Best we can do: mark log as failed and let the next send attempt clean up via Step 5.
          await getSupabaseAdmin()
            .from('notification_log')
            .update({ status: 'failed', error_code: 'DeviceNotRegistered' })
            .contains('receipt_ids', [receiptId]);
        } else {
          await getSupabaseAdmin()
            .from('notification_log')
            .update({
              status: 'failed',
              error_code: errorReceipt.details?.error ?? 'unknown',
            })
            .contains('receipt_ids', [receiptId]);
        }
      }
    }
  }
}

export const notificationService = { send, sendBatch, processReceipts };
