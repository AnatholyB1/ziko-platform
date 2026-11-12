// Phase 23 (v1.20) - D-01 : outils de l'atelier (AI SDK v6 : inputSchema / jsonSchema).
// Les schemas imbriques (programme, operations) ne tiennent pas dans `AITool` du registre
// (scalaires seulement) : l'atelier a donc son propre jeu d'outils, branche uniquement sur
// POST /ai/workshop/stream.
import { tool, jsonSchema } from 'ai';
import { applyOps, DraftError, type DraftOp, type DraftProgram } from './draft.js';
import { listSkills, getSkill } from './skills.js';
import { runWebSearch, type SearchRunner } from './webSearch.js';
import { loadDraft, saveDraftProgram, type DraftRecord } from './store.js';
import { renderContext, type WorkshopContext, type WorkshopDb } from './context.js';
import { WORKSHOP_WEB_SEARCH_PER_MESSAGE } from './limits.js';

export interface WorkshopToolDeps {
  db: WorkshopDb;
  userId: string;
  draftId: string;
  getContext: () => Promise<WorkshopContext>;
  emitDraft: (draft: DraftRecord) => void;
  searchRunner?: SearchRunner;
}

const PROGRAM_SCHEMA = {
  type: 'object',
  description: 'Full program. weeks[] has one entry per week (S1..Sn), each with sessions[].',
  properties: {
    name: { type: 'string' },
    goal: { type: 'string' },
    split_type: { type: 'string' },
    notes: { type: 'string' },
    weeks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'e.g. "Volume", "Deload", "Peak"' },
          sessions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                day_of_week: { type: 'integer', description: 'ISO, 1=Monday..7=Sunday, distinct within a week' },
                focus: { type: 'string' },
                exercises: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      sets: { type: 'integer' },
                      reps: { type: 'string', description: 'e.g. "5" or "8-12"' },
                      rest_seconds: { type: 'integer' },
                      pct_1rm: { type: 'number', description: 'percent of 1RM, 1-120' },
                      rpe: { type: 'number' },
                      tempo: { type: 'string' },
                      note: { type: 'string' },
                    },
                    required: ['name', 'sets', 'reps'],
                  },
                },
              },
              required: ['name', 'exercises'],
            },
          },
        },
        required: ['sessions'],
      },
    },
  },
  required: ['name', 'weeks'],
} as const;

const OPS_SCHEMA = {
  type: 'object',
  properties: {
    ops: {
      type: 'array',
      description:
        'Edits. week is 1-based or "all"; session and index are 0-based. ops: rename{name} | update_exercise{week,session,index,patch} | add_exercise{week,session,exercise,index?} | remove_exercise{week,session,index} | remove_session{week,session}',
      items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['rename', 'update_exercise', 'add_exercise', 'remove_exercise', 'remove_session'] },
          name: { type: 'string' },
          week: { type: ['integer', 'string'] },
          session: { type: 'integer' },
          index: { type: 'integer' },
          patch: { type: 'object' },
          exercise: { type: 'object' },
        },
        required: ['op'],
      },
    },
  },
  required: ['ops'],
} as const;

/** Chip label shown in the UI for each tool (A10 : "Recherche web", "Skill chargé"). */
export function toolLabel(name: string, input?: Record<string, unknown>): string {
  switch (name) {
    case 'workshop_web_search':
      return 'Recherche web';
    case 'workshop_load_skill': {
      const s = typeof input?.id === 'string' ? getSkill(input.id) : undefined;
      return s ? `Skill : ${s.title}` : 'Skill chargé';
    }
    case 'workshop_list_skills':
      return 'Bibliothèque de skills';
    case 'workshop_get_context':
      return 'Contexte athlète';
    case 'workshop_set_draft':
      return 'Brouillon mis à jour';
    case 'workshop_edit_draft':
      return 'Brouillon modifié';
    default:
      return name;
  }
}

async function mutate(
  deps: WorkshopToolDeps,
  compute: (current: DraftProgram | null) => DraftProgram,
): Promise<{ ok: true; revision: number; program: DraftProgram } | { ok: false; error: string }> {
  // One retry: the user may have edited the draft by hand while the model was working (D-03).
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await loadDraft(deps.db, deps.userId, deps.draftId);
    if (!cur) return { ok: false, error: 'draft not found' };
    if (cur.status === 'saved') return { ok: false, error: 'draft already saved' };
    let next: DraftProgram;
    try {
      next = compute(cur.program);
    } catch (e) {
      return { ok: false, error: e instanceof DraftError || e instanceof Error ? e.message : 'invalid edit' };
    }
    const res = await saveDraftProgram(deps.db, deps.userId, deps.draftId, next, cur.revision);
    if (res.ok) {
      deps.emitDraft(res.draft);
      return { ok: true, revision: res.draft.revision, program: res.draft.program ?? next };
    }
    if (res.reason !== 'conflict') return { ok: false, error: res.reason };
  }
  return { ok: false, error: 'draft changed concurrently, re-read it and retry' };
}

export function createWorkshopTools(deps: WorkshopToolDeps) {
  let searches = 0;
  return {
    workshop_get_context: tool({
      description:
        "Read the athlete's full context (profile, strength records, recent sessions, previous programs, measurements). Optionally filter sessions by exercise name.",
      inputSchema: jsonSchema<{ exercise?: string }>({
        type: 'object',
        properties: { exercise: { type: 'string', description: 'optional exercise name filter' } },
      }),
      execute: async (input) => {
        const ctx = await deps.getContext();
        const q = input?.exercise?.toLowerCase();
        if (!q) return { context: renderContext(ctx, 6000) };
        return {
          records: ctx.records.filter((r) => r.exercise.toLowerCase().includes(q)),
          sessions: ctx.recentSessions
            .map((s) => ({ ...s, top_sets: s.top_sets.filter((t) => t.exercise.toLowerCase().includes(q)) }))
            .filter((s) => s.top_sets.length > 0),
        };
      },
    }),
    workshop_list_skills: tool({
      description: 'List the training-skill library (ids and one-line summaries).',
      inputSchema: jsonSchema<Record<string, never>>({ type: 'object', properties: {} }),
      execute: async () => ({ skills: listSkills() }),
    }),
    workshop_load_skill: tool({
      description: 'Load the full methodology of one training skill by id. Load the relevant skill BEFORE writing a specialised program.',
      inputSchema: jsonSchema<{ id: string }>({ type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }),
      execute: async ({ id }) => {
        const s = getSkill(id);
        return s ? { id: s.id, title: s.title, body: s.body } : { error: 'unknown skill', available: listSkills().map((x) => x.id) };
      },
    }),
    workshop_web_search: tool({
      description:
        'Search the web for current training-science facts (e.g. a federation rule, a protocol). Use sparingly: max 2 per message. Cite the source names in your answer.',
      inputSchema: jsonSchema<{ query: string }>({ type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }),
      execute: async ({ query }) => {
        if (searches >= WORKSHOP_WEB_SEARCH_PER_MESSAGE) {
          return { ok: false, summary: 'Per-message web search limit reached. Answer with what you have.', sources: [] };
        }
        searches += 1;
        return runWebSearch(deps.db, deps.userId, query, deps.searchRunner);
      },
    }),
    workshop_set_draft: tool({
      description: 'Create or fully replace the program draft. Send the COMPLETE program (all weeks). Use workshop_edit_draft for small changes.',
      inputSchema: jsonSchema<{ program: unknown }>({
        type: 'object',
        properties: { program: PROGRAM_SCHEMA as any },
        required: ['program'],
      }),
      execute: async ({ program }) => {
        const op: DraftOp = { op: 'set_program', program };
        const res = await mutate(deps, (cur) => applyOps(cur as DraftProgram, [op]));
        return res.ok ? { ok: true, revision: res.revision, weeks: res.program.weeks_count, days_per_week: res.program.days_per_week } : res;
      },
    }),
    workshop_edit_draft: tool({
      description: 'Apply small typed edits to the current draft (change sets/reps/%1RM, add/remove an exercise, rename). Indices are 0-based, week is 1-based or "all".',
      inputSchema: jsonSchema<{ ops: DraftOp[] }>(OPS_SCHEMA as any),
      execute: async ({ ops }) => {
        const res = await mutate(deps, (cur) => {
          if (!cur) throw new DraftError('no draft yet: call workshop_set_draft first');
          return applyOps(cur, ops);
        });
        return res.ok ? { ok: true, revision: res.revision } : res;
      },
    }),
  };
}
