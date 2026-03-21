import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { generateText, streamText, tool, jsonSchema, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { authMiddleware } from '../middleware/auth.js';
import { allToolSchemas, getToolExecutor } from '../tools/registry.js';
import { fetchUserContext, type UserContext } from '../context/user.js';
import {
  getOrCreateConversation,
  appendMessages,
  updateConversationTitle,
} from '../context/conversation.js';

const router = new Hono();
router.use('*', authMiddleware);

const AGENT_MODEL = anthropic('claude-sonnet-4-20250514');

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
- Always speak in the same language as the user (French, English, etc.).`;

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

function buildSDKTools(userId: string) {
  return Object.fromEntries(
    allToolSchemas.map((s) => [
      s.name,
      tool({
        description: s.description,
        inputSchema: jsonSchema<Record<string, unknown>>(s.parameters as any),
        execute: async (input) => {
          const executor = getToolExecutor(s.name);
          if (!executor) throw new Error(`No executor for ${s.name}`);
          return executor(input as Record<string, unknown>, userId);
        },
      }),
    ]),
  );
}

// ─── Routes ────────────────────────────────────────────────────────

router.get('/tools', (c) => c.json({ tools: allToolSchemas }));

router.post('/tools/execute', async (c) => {
  const auth = c.get('auth');
  const { tool_name, parameters = {} } = await c.req.json<{
    tool_name: string;
    parameters?: Record<string, unknown>;
  }>();
  if (!tool_name) return c.json({ error: 'tool_name is required' }, 400);
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
router.post('/chat/stream', async (c) => {
  const { messages = [], conversation_id } = await c.req.json<{
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    conversation_id?: string;
  }>();
  const auth = c.get('auth');
  const userId = auth.userId;

  // Fetch user context + conversation history in parallel
  const [userCtx, convo] = await Promise.all([
    fetchUserContext(userId),
    getOrCreateConversation(userId, conversation_id),
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
    updateConversationTitle(convo.conversationId, lastUserMsg.content);
  }

  const result = streamText({
    model: AGENT_MODEL,
    system: systemPrompt,
    messages: allMessages,
    tools: buildSDKTools(userId),
    stopWhen: stepCountIs(5),
  });

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (s) => {
    const chunks: string[] = [];
    try {
      // Send conversation_id first so client can track it
      await s.write(
        `data: ${JSON.stringify({ type: 'meta', conversation_id: convo.conversationId })}\n\n`,
      );

      for await (const text of result.textStream) {
        chunks.push(text);
        await s.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
      }
      await s.write('data: [DONE]\n\n');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stream error';
      await s.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
    }

    // Persist new messages (user + assistant) after stream finishes
    const toSave: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (lastUserMsg) toSave.push({ role: 'user', content: lastUserMsg.content });
    const fullResponse = chunks.join('');
    if (fullResponse) toSave.push({ role: 'assistant', content: fullResponse });
    appendMessages(convo.conversationId, toSave);
  });
});

// Non-streaming endpoint with context injection + conversation persistence
router.post('/chat', async (c) => {
  const { messages = [], conversation_id } = await c.req.json<{
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    conversation_id?: string;
  }>();
  const auth = c.get('auth');
  const userId = auth.userId;

  const [userCtx, convo] = await Promise.all([
    fetchUserContext(userId),
    getOrCreateConversation(userId, conversation_id),
  ]);

  const systemPrompt = buildSystemPrompt(userCtx);

  const allMessages = [
    ...convo.history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ...messages,
  ];

  const userMsgs2 = messages.filter((m) => m.role === 'user');
  const lastUserMsg = userMsgs2.length > 0 ? userMsgs2[userMsgs2.length - 1] : undefined;
  if (convo.history.length === 0 && lastUserMsg) {
    updateConversationTitle(convo.conversationId, lastUserMsg.content);
  }

  const { text } = await generateText({
    model: AGENT_MODEL,
    system: systemPrompt,
    messages: allMessages,
    tools: buildSDKTools(userId),
    stopWhen: stepCountIs(5),
  });

  // Persist messages
  const toSave: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (lastUserMsg) toSave.push({ role: 'user', content: lastUserMsg.content });
  if (text) toSave.push({ role: 'assistant', content: text });
  await appendMessages(convo.conversationId, toSave);

  return c.json({ content: text, conversation_id: convo.conversationId });
});

// ─── Vision: Food Nutrition Analysis ──────────────────────────────

router.post('/vision/nutrition', async (c) => {
  const { image, meal_context } = await c.req.json<{
    image: string; // base64 encoded image
    meal_context?: string;
  }>();

  if (!image) return c.json({ error: 'image (base64) is required' }, 400);

  // Validate base64 size (max ~10MB raw)
  if (image.length > 14_000_000) {
    return c.json({ error: 'Image too large (max 10MB)' }, 413);
  }

  // Detect media type from base64 header or default to jpeg
  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
  let base64Data = image;
  const dataUrlMatch = image.match(/^data:(image\/(jpeg|png|webp|gif));base64,/);
  if (dataUrlMatch) {
    mediaType = dataUrlMatch[1] as typeof mediaType;
    base64Data = image.slice(dataUrlMatch[0].length);
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
    const { text } = await generateText({
      model: AGENT_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: base64Data,
              mediaType,
            },
            {
              type: 'text',
              text: prompt,
            },
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
