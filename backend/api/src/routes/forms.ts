import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
);

const router = new Hono();
router.use('*', authMiddleware);

// ─── Coach routes ──────────────────────────────────────────────────────────────

// GET /coach/forms — list coach's forms
router.get('/coach/forms', async (c) => {
  const { userId } = c.get('auth');
  try {
    const { data, error } = await supabase
      .from('coach_forms')
      .select('*')
      .eq('coach_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return c.json({ forms: data ?? [] });
  } catch (err) {
    console.error('[GET /coach/forms]', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /coach/forms — create a new form
router.post('/coach/forms', async (c) => {
  const { userId } = c.get('auth');
  try {
    const body = await c.req.json().catch(() => ({}));
    const { title, questions, trigger_config, status } = body as {
      title?: string;
      questions?: unknown[];
      trigger_config?: Record<string, unknown>;
      status?: string;
    };

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return c.json({ error: 'title is required' }, 400);
    }

    const { data, error } = await supabase
      .from('coach_forms')
      .insert({
        coach_id: userId,
        title: title.trim(),
        questions: questions ?? [],
        trigger_config: trigger_config ?? { type: 'manual' },
        status: status ?? 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return c.json({ form: data }, 201);
  } catch (err) {
    console.error('[POST /coach/forms]', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PATCH /coach/forms/:id — full rewrite of title, questions, trigger_config (D-03)
router.patch('/coach/forms/:id', async (c) => {
  const { userId } = c.get('auth');
  const { id } = c.req.param();
  try {
    const body = await c.req.json().catch(() => ({}));
    const { title, questions, trigger_config, status } = body as {
      title?: string;
      questions?: unknown[];
      trigger_config?: Record<string, unknown>;
      status?: string;
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (questions !== undefined) updates.questions = questions;
    if (trigger_config !== undefined) updates.trigger_config = trigger_config;
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabase
      .from('coach_forms')
      .update(updates)
      .eq('id', id)
      .eq('coach_id', userId)
      .select()
      .single();

    if (error) {
      // PGRST116 = no rows returned (not found or not owned)
      if (error.code === 'PGRST116') {
        return c.json({ error: 'form not found' }, 404);
      }
      throw error;
    }
    if (!data) return c.json({ error: 'form not found' }, 404);
    return c.json({ form: data });
  } catch (err) {
    console.error('[PATCH /coach/forms/:id]', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /coach/forms/:id/publish — set status to active
router.post('/coach/forms/:id/publish', async (c) => {
  const { userId } = c.get('auth');
  const { id } = c.req.param();
  try {
    const { data, error } = await supabase
      .from('coach_forms')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('coach_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'form not found' }, 404);
      }
      throw error;
    }
    if (!data) return c.json({ error: 'form not found' }, 404);
    return c.json({ form: data });
  } catch (err) {
    console.error('[POST /coach/forms/:id/publish]', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /coach/forms/:id/send — manually send form to one or more athletes (TRIGGER-04)
router.post('/coach/forms/:id/send', async (c) => {
  try {
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { athlete_ids } = body as { athlete_ids?: unknown };

    if (!Array.isArray(athlete_ids) || athlete_ids.length === 0) {
      return c.json({ error: 'athlete_ids must be a non-empty array of UUIDs' }, 400);
    }
    if (athlete_ids.length > 100) {
      return c.json({ error: 'athlete_ids must contain at most 100 entries' }, 400);
    }
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!(athlete_ids as unknown[]).every((aid) => typeof aid === 'string' && uuidRe.test(aid))) {
      return c.json({ error: 'athlete_ids must be a non-empty array of UUIDs' }, 400);
    }

    const { data: form, error: formErr } = await supabase
      .from('coach_forms')
      .select('id, status')
      .eq('id', id)
      .eq('coach_id', userId)
      .single();

    if (formErr?.code === 'PGRST116' || !form) {
      return c.json({ error: 'form not found' }, 404);
    }
    if (formErr) throw formErr;
    if (form.status !== 'active') {
      return c.json({ error: 'form must be active to send' }, 409);
    }

    let totalCount = 0;
    for (const athleteId of athlete_ids as string[]) {
      const { data, error } = await supabase.rpc('create_form_instances_for_trigger', {
        p_trigger_type: 'manual',
        p_athlete_id: athleteId,
        p_coach_id: userId,
      });
      if (error) console.warn('[POST /coach/forms/:id/send]', error.message);
      else totalCount += data ?? 0;
    }

    return c.json({ sent: totalCount, skipped: (athlete_ids as string[]).length - totalCount });
  } catch (err) {
    console.error('[POST /coach/forms/:id/send]', err);
    return c.json({ error: 'internal server error' }, 500);
  }
});

// ─── Athlete routes ────────────────────────────────────────────────────────────

// GET /athlete/forms/pending — list pending form instances for the athlete
router.get('/athlete/forms/pending', async (c) => {
  const { userId } = c.get('auth');
  try {
    const { data, error } = await supabase
      .from('form_instances')
      .select(`
        id,
        form_id,
        coach_forms!inner (
          title,
          questions
        )
      `)
      .eq('athlete_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    type PendingRow = {
      id: string;
      form_id: string;
      coach_forms: { title: string; questions: unknown[] } | { title: string; questions: unknown[] }[] | null;
    };

    const forms = (data ?? []).map((row: PendingRow) => {
      const cf = Array.isArray(row.coach_forms) ? row.coach_forms[0] : row.coach_forms;
      const questions = (cf?.questions as unknown[]) ?? [];
      return {
        instance_id: row.id,
        form_id: row.form_id,
        form_title: cf?.title ?? '',
        question_count: questions.length,
        questions,
      };
    });

    return c.json({ forms });
  } catch (err) {
    console.error('[GET /athlete/forms/pending]', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /athlete/forms/:instanceId/submit — submit answers for a form instance
router.post('/athlete/forms/:instanceId/submit', async (c) => {
  const { userId } = c.get('auth');
  const { instanceId } = c.req.param();
  try {
    const body = await c.req.json().catch(() => ({}));
    const { answers } = body as { answers?: unknown[] };

    // Fetch the instance and verify ownership
    const { data: instance, error: fetchError } = await supabase
      .from('form_instances')
      .select('id, status, form_id')
      .eq('id', instanceId)
      .eq('athlete_id', userId)
      .single();

    if (fetchError || !instance) {
      return c.json({ error: 'instance not found' }, 404);
    }

    if (instance.status === 'submitted') {
      return c.json({ error: 'already submitted' }, 409);
    }

    // Insert form_responses
    const { data: responseRow, error: insertError } = await supabase
      .from('form_responses')
      .insert({
        instance_id: instanceId,
        athlete_id: userId,
        answers: answers ?? [],
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update instance status
    const { error: updateError } = await supabase
      .from('form_instances')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', instanceId);

    if (updateError) throw updateError;

    return c.json({ response: responseRow }, 201);
  } catch (err) {
    console.error('[POST /athlete/forms/:instanceId/submit]', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { router as formsRouter };
