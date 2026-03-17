import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { authMiddleware } from '../middleware/auth.js';

const AI_AGENT_URL = process.env.AI_AGENT_URL!;
const AI_AGENT_API_KEY = process.env.AI_AGENT_API_KEY!;

const router = new Hono();
router.use('*', authMiddleware);

/** POST /ai/chat/stream — SSE streaming proxy to the AI agent */
router.post('/chat/stream', async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth');

  // Inject server-side user context
  const payload = {
    ...body,
    user_context: {
      ...(body.user_context ?? {}),
      authenticated_user_id: auth.userId,
    },
  };

  const upstreamRes = await fetch(`${AI_AGENT_URL}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_AGENT_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!upstreamRes.ok) {
    const text = await upstreamRes.text();
    return c.json({ error: 'AI agent error', detail: text }, 502);
  }

  // Pipe SSE stream back to client
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (s) => {
    const reader = upstreamRes.body!.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await s.write(decoder.decode(value, { stream: true }));
      }
    } finally {
      reader.releaseLock();
    }
  });
});

/** POST /ai/chat — Non-streaming fallback */
router.post('/chat', async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth');

  const payload = {
    ...body,
    user_context: {
      ...(body.user_context ?? {}),
      authenticated_user_id: auth.userId,
    },
  };

  const upstreamRes = await fetch(`${AI_AGENT_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_AGENT_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!upstreamRes.ok) {
    return c.json({ error: 'AI agent error' }, 502);
  }

  const data = await upstreamRes.json();
  return c.json(data);
});

export { router as aiRouter };
