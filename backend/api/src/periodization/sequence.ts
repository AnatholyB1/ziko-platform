// Phase 24 (v1.20) - ATEL-07 : vue ordonnee d'une suite de programmes. Module PUR.
// Statuts calcules : done (completed_at), active (is_active), next (premier restant), planned (les autres).
// "Un seul actif" est garanti par P7 ; ici on ne fait qu'afficher (au plus un `active`).
import type { ProgramResults } from './results.js';

export interface SequenceProgramRow {
  id: string;
  name: string;
  goal: string | null;
  sequence_position: number;
  is_active: boolean;
  completed_at: string | null;
  started_at: string | null;
  results: ProgramResults | null;
  program_data?: { weeks_count?: number; weeks?: unknown[] } | null;
}

export type SequenceItemStatus = 'done' | 'active' | 'next' | 'planned';

export interface SequenceItem {
  id: string;
  position: number;
  name: string;
  goal: string | null;
  status: SequenceItemStatus;
  weeks: number | null;
  started_at: string | null;
  completed_at: string | null;
  results: ProgramResults | null;
}

export function buildSequenceItems(rows: SequenceProgramRow[]): SequenceItem[] {
  const sorted = [...rows].sort((a, b) => a.sequence_position - b.sequence_position);
  let nextAssigned = false;
  let activeAssigned = false;
  return sorted.map((r) => {
    let status: SequenceItemStatus;
    if (r.completed_at) status = 'done';
    else if (r.is_active && !activeAssigned) {
      status = 'active';
      activeAssigned = true;
    } else if (!nextAssigned) {
      status = 'next';
      nextAssigned = true;
    } else status = 'planned';
    const pd = r.program_data ?? {};
    const weeks = Array.isArray(pd.weeks) && pd.weeks.length > 0 ? pd.weeks.length : Number(pd.weeks_count) > 0 ? Number(pd.weeks_count) : null;
    return {
      id: r.id,
      position: r.sequence_position,
      name: r.name,
      goal: r.goal,
      status,
      weeks,
      started_at: r.started_at,
      completed_at: r.completed_at,
      results: r.results ?? null,
    };
  });
}
