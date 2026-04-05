import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { generateText, streamText, tool, jsonSchema, stepCountIs } from 'ai';
import { AGENT_MODEL } from '../config/models.js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';
import { createUserRateLimiter } from '../middleware/rateLimiter.js';
import { allToolSchemas, getToolExecutor } from '../tools/registry.js';
import { fetchUserContext, type UserContext } from '../context/user.js';
import {
  getOrCreateConversation,
  appendMessages,
  updateConversationTitle,
} from '../context/conversation.js';

const router = new Hono();

// Supabase client for storage signed download URLs
const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Zod schemas for input validation (SEC-03) ───────────────────

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
}).strict();

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1),
  conversation_id: z.string().optional(),
}).strict();

const toolExecuteSchema = z.object({
  tool_name: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional(),
}).strict();
router.use('*', authMiddleware);

// Per-user rate limiters (per D-02, D-03, D-04, D-06)
// These run AFTER authMiddleware (D-13) so c.get('auth').userId is available
const aiChatLimiter = createUserRateLimiter(20, '60 m', 'ai-chat');       // D-02: 20/60min
const aiToolsLimiter = createUserRateLimiter(30, '60 m', 'ai-tools');     // D-03: 30/60min
const barcodeScanLimiter = createUserRateLimiter(20, '60 m', 'barcode');  // D-04: 20/60min

// ─── Dynamic system prompt ────────────────────────────────────────

const BASE_SYSTEM = `You are Ziko, an expert AI fitness & wellness orchestrator agent.

## Role
You are the user's personal coach. You talk directly with them — empathetic, motivating, science-based.
You also orchestrate actions on their behalf using the tools at your disposal.

## Behaviour
- When the user asks about their habits, nutrition, or workouts, **always call the relevant tools first** before answering. Never guess data — fetch it.
- When the user tells you they ate something, log it immediately via nutrition_log_meal. Estimate macros if the user doesn't provide them.
- When the user asks to create a habit or log one, do it via the corresponding tool and confirm.
- You can chain multiple tool calls in a single turn (e.g. fetch habits + nutrition summary to give a daily recap).
- After executing tools, synthesise the results into a clear, personalised response.
- Be concise unless the user asks for detail. Use markdown sparingly.
- Always speak in the same language as the user (French, English, etc.).

## App Navigation
You can navigate the user directly to any screen in the app using the app_navigate tool.
**Always call app_navigate after performing an action** to take the user to the relevant screen.
Examples:
- User says "lance un chrono HIIT 4 rounds 20s/10s" → call timer_create_preset, then app_navigate to timer_dashboard with autoStartPresetId set to the created preset ID.
- User says "log 500ml d'eau" → call hydration_log, then app_navigate to hydration_dashboard.
- User says "montre mes stats" → app_navigate to stats_dashboard.
- User says "enregistre que j'ai dormi de 23h à 7h" → call sleep_log, then app_navigate to sleep_dashboard.
- User asks to create a workout program → call ai_programs_generate, then app_navigate to ai_programs_dashboard.
Only navigate when it makes sense (user requests action or wants to see something). Don't navigate for simple informational questions.`;

function buildSystemPrompt(userCtx: UserContext): string {
  const sections: string[] = [BASE_SYSTEM];

  // User profile
  if (userCtx.profile) {
    const p = userCtx.profile;
    sections.push(`## User Profile
- Name: ${p.name ?? 'Unknown'}
- Age: ${p.age ?? '?'} | Weight: ${p.weight_kg ?? '?'} kg | Height: ${p.height_cm ?? '?'} cm
- Goal: ${p.goal ?? 'Not set'}
- Units: ${p.units}`);
  }

  // Today's snapshot
  const n = userCtx.todayNutritionSummary;
  const h = userCtx.todayHabitsSummary;
  sections.push(`## Today's Snapshot
- Nutrition: ${n.total_calories} kcal | ${n.total_protein_g}g P / ${n.total_carbs_g}g C / ${n.total_fat_g}g F (${n.meal_count} meals logged)
- Habits: ${h.completed}/${h.total} completed`);

  // Recent workouts
  if (userCtx.recentWorkouts.length > 0) {
    const list = userCtx.recentWorkouts
      .map((w) => `  - ${w.name ?? 'Untitled'} (${new Date(w.started_at).toLocaleDateString()}) — ${w.total_volume_kg ?? 0} kg volume`)
      .join('\n');
    sections.push(`## Recent Workouts\n${list}`);
  }

  // Installed plugins
  if (userCtx.installedPlugins.length > 0) {
    sections.push(`## Active Plugins\n${userCtx.installedPlugins.join(', ')}`);
  }

  return sections.join('\n\n');
}

// ─── Tools ─────────────────────────────────────────────────────────

function buildSDKTools(userId: string, userToken?: string) {
  return Object.fromEntries(
    allToolSchemas.map((s) => [
      s.name,
      tool({
        description: s.description,
        inputSchema: jsonSchema<Record<string, unknown>>(s.parameters as any),
        execute: async (input) => {
          const executor = getToolExecutor(s.name);
          if (!executor) throw new Error(`No executor for ${s.name}`);
          console.log(`[Tool] ${s.name} hasToken=${!!userToken}`);
          try {
            return await executor(input as Record<string, unknown>, userId, userToken);
          } catch (execErr) {
            const msg = execErr instanceof Error ? execErr.message : String(execErr);
            console.error(`[Tool Error] ${s.name}: ${msg}`);
            throw execErr;
          }
        },
      }),
    ]),
  );
}

// ─── Routes ────────────────────────────────────────────────────────

router.get('/tools', (c) => c.json({ tools: allToolSchemas }));

router.post('/tools/execute', aiToolsLimiter, zValidator('json', toolExecuteSchema), async (c) => {
  const auth = c.get('auth');
  const { tool_name, parameters = {} } = c.req.valid('json');
  const executor = getToolExecutor(tool_name);
  if (!executor) return c.json({ error: `Unknown tool: ${tool_name}` }, 404);
  try {
    const result = await executor(parameters, auth.userId);
    return c.json({ tool_name, result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Tool Error] ${tool_name}:`, msg);
    return c.json({ error: msg }, 500);
  }
});

// Streaming endpoint with context injection + conversation persistence
router.post('/chat/stream', aiChatLimiter, zValidator('json', chatSchema), async (c) => {
  const { messages, conversation_id: bodyConversationId } = c.req.valid('json');
  const auth = c.get('auth');
  const userId = auth.userId;
  const userToken = c.req.header('Authorization')?.slice(7);
  // Accept conversation_id from body or X-Conversation-Id header
  const conversation_id = bodyConversationId ?? c.req.header('X-Conversation-Id') ?? undefined;

  // Fetch user context + conversation history in parallel
  const [userCtx, convo] = await Promise.all([
    fetchUserContext(userId, userToken),
    getOrCreateConversation(userId, conversation_id, userToken),
  ]);

  const systemPrompt = buildSystemPrompt(userCtx);

  // Merge stored history with incoming messages
  const allMessages = [
    ...convo.history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ...messages,
  ];

  // Get last user message for persistence + title
  const userMsgs = messages.filter((m) => m.role === 'user');
  const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1] : undefined;

  // Auto-title on first user message
  if (convo.history.length === 0 && lastUserMsg) {
    updateConversationTitle(convo.conversationId, lastUserMsg.content, userToken);
  }

  const result = streamText({
    model: AGENT_MODEL,
    system: systemPrompt,
    messages: allMessages,
    tools: buildSDKTools(userId, userToken),
    stopWhen: stepCountIs(5),
  });

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (s) => {
    const chunks: string[] = [];
    const actions: unknown[] = [];
    try {
      // Send conversation_id first so client can track it
      await s.write(
        `data: ${JSON.stringify({ type: 'meta', conversation_id: convo.conversationId })}\n\n`,
      );

      for await (const part of result.fullStream) {
        if (part.type === 'tool-error') {
          const err = (part as any).error;
          const msg = err instanceof Error ? err.message : JSON.stringify(err) ?? String(err);
          console.error(`[Tool Error] ${(part as any).toolName}: ${msg}`);
        }
        if (part.type === 'text-delta') {
          const text = (part as any).textDelta ?? (part as any).text ?? '';
          // Filter out XML tool-call artifacts Claude sometimes emits after a tool-error
          if (text && !text.includes('<invoke') && !text.includes('</invoke>') && !text.includes('<parameter')) {
            chunks.push(text);
            await s.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
          }
        } else if (part.type === 'tool-result' && part.toolName === 'app_navigate') {
          const action = ((part as any).output ?? (part as any).result)?._action;
          if (action) actions.push(action);
        }
      }

      // Emit collected actions before DONE
      if (actions.length > 0) {
        await s.write(`data: ${JSON.stringify({ type: 'actions', actions })}\n\n`);
      }

      await s.write('data: [DONE]\n\n');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stream error';
      console.error('[AI Stream Error]', err);
      await s.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
      await s.write('data: [DONE]\n\n');
    }

    // Persist new messages (user + assistant) after stream finishes
    const toSave: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (lastUserMsg) toSave.push({ role: 'user', content: lastUserMsg.content });
    const fullResponse = chunks.join('');
    if (fullResponse) toSave.push({ role: 'assistant', content: fullResponse });
    appendMessages(convo.conversationId, toSave, userToken);
  });
});

// Non-streaming endpoint with context injection + conversation persistence
router.post('/chat', aiChatLimiter, zValidator('json', chatSchema), async (c) => {
  const { messages, conversation_id: bodyConversationId } = c.req.valid('json');
  const auth = c.get('auth');
  const userId = auth.userId;
  const userToken = c.req.header('Authorization')?.slice(7);
  const conversation_id = bodyConversationId ?? c.req.header('X-Conversation-Id') ?? undefined;
  const [userCtx, convo] = await Promise.all([
    fetchUserContext(userId, userToken),
    getOrCreateConversation(userId, conversation_id, userToken),
  ]);

  const systemPrompt = buildSystemPrompt(userCtx);

  const allMessages = [
    ...convo.history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ...messages,
  ];

  const userMsgs2 = messages.filter((m) => m.role === 'user');
  const lastUserMsg = userMsgs2.length > 0 ? userMsgs2[userMsgs2.length - 1] : undefined;
  if (convo.history.length === 0 && lastUserMsg) {
    updateConversationTitle(convo.conversationId, lastUserMsg.content, userToken);
  }

  const result = await generateText({
    model: AGENT_MODEL,
    system: systemPrompt,
    messages: allMessages,
    tools: buildSDKTools(userId, userToken),
    stopWhen: stepCountIs(5),
  });

  const { text } = result;

  // Extract navigation actions from tool results
  const actions: unknown[] = [];
  try {
    for (const step of result.steps ?? []) {
      for (const tr of step.toolResults ?? []) {
        if (tr.toolName === 'app_navigate') {
          const action = ((tr as any).output ?? (tr as any).result)?._action;
          if (action) actions.push(action);
        }
      }
    }
  } catch {
    // Actions extraction is best-effort
  }

  // Persist messages
  const toSave: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (lastUserMsg) toSave.push({ role: 'user', content: lastUserMsg.content });
  if (text) toSave.push({ role: 'assistant', content: text });
  await appendMessages(convo.conversationId, toSave, userToken);

  return c.json({ content: text, conversation_id: convo.conversationId, actions });
});

// ─── Vision: Food Nutrition Analysis ──────────────────────────────

router.post('/vision/nutrition', barcodeScanLimiter, async (c) => {
  const { image, storage_path, meal_context } = await c.req.json<{
    image?: string;        // base64 — backward compat (D-23)
    storage_path?: string; // new signed URL path (D-23)
    meal_context?: string;
  }>();

  // Require at least one image source (D-23)
  if (!image && !storage_path) {
    return c.json({ error: 'image or storage_path is required' }, 400);
  }

  const prompt = `Analyze this food image and estimate the nutritional content.

${meal_context ? `Context: ${meal_context}` : ''}

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "foods": [
    {
      "food_name": "name of the food item",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "serving_g": number,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "description": "brief description of what you see in the image"
}

Rules:
- Identify ALL distinct food items visible in the image
- Estimate realistic portion sizes based on visual cues
- Use standard nutritional databases as reference for macros
- If you cannot identify food in the image, return: {"foods": [], "description": "No food detected"}
- Numbers should be rounded to 1 decimal place`;

  try {
    // Build image content part for Claude
    let imageContent: { type: 'image'; image: string | URL; mediaType?: string };

    if (storage_path) {
      // New flow: generate signed download URL (D-24)
      const { data: readData, error: readError } = await supabase.storage
        .from('scan-photos')
        .createSignedUrl(storage_path, 300); // 300s TTL

      if (readError || !readData?.signedUrl) {
        console.error('[Vision] createSignedUrl error:', readError);
        return c.json({ error: 'Failed to retrieve image for analysis' }, 500);
      }

      // Pass URL to Claude — Vercel AI SDK v6 accepts URL objects (D-25)
      imageContent = { type: 'image', image: new URL(readData.signedUrl) };
    } else {
      // Legacy base64 flow — unchanged (D-23 backward compat)
      // Validate base64 size (max ~10MB raw)
      if (image!.length > 14_000_000) {
        return c.json({ error: 'Image too large (max 10MB)' }, 413);
      }

      let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
      let base64Data = image!;
      const dataUrlMatch = image!.match(/^data:(image\/(jpeg|png|webp|gif));base64,/);
      if (dataUrlMatch) {
        mediaType = dataUrlMatch[1] as typeof mediaType;
        base64Data = image!.slice(dataUrlMatch[0].length);
      }

      imageContent = { type: 'image', image: base64Data, mediaType };
    }

    const { text } = await generateText({
      model: AGENT_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    // Parse the JSON response
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleaned);

    return c.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Vision Error]', msg);
    return c.json({ error: 'Failed to analyze image' }, 500);
  }
});

export { router as aiRouter };
