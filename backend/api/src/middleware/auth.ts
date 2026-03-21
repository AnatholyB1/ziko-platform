import { createClient } from '@supabase/supabase-js';
import type { Context, Next } from 'hono';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

const adminClient = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface AuthContext {
  userId: string;
  email: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  const token = authorization.slice(7);

  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('auth', { userId: data.user.id, email: data.user.email ?? '' });
  await next();
}
