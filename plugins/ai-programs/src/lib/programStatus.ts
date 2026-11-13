// Nom et statut d'affichage d'un programme IA (run4 P7). Pur.
//  - le nom vient de la colonne `name` (NOT NULL), puis de program_data.name, puis d'un libelle date ;
//  - "Termine" n'est affiche que si `completed_at` est renseigne : un programme jamais demarre n'est PAS
//    "Termine 100 %".

import { getProgramSessionList } from './programShape';

export interface ProgramLike {
  name?: string | null;
  is_active: boolean;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  program_data: Record<string, any> | null;
}

export type ProgramStatusKind = 'active' | 'completed' | 'paused' | 'unstarted';

export function getProgramDisplayName(p: ProgramLike, formatDate: (d: Date) => string): string {
  const col = typeof p.name === 'string' ? p.name.trim() : '';
  if (col) return col;
  const data = typeof p.program_data?.name === 'string' ? p.program_data.name.trim() : '';
  if (data) return data;
  return `Programme ${formatDate(new Date(p.created_at))}`;
}

/** Avancement 0-100 : termine = 100 ; sinon part des seances marquees faites ; sinon 0 (jamais invente). */
export function getProgramProgressPct(p: ProgramLike): number {
  if (p.completed_at) return 100;
  const sessions = getProgramSessionList(p.program_data);
  if (Array.isArray(sessions) && sessions.length > 0) {
    const done = sessions.filter((s: any) => s?.completed).length;
    return Math.round((done / sessions.length) * 100);
  }
  return 0;
}

export function getProgramStatus(p: ProgramLike): { kind: ProgramStatusKind; label: string; progress: number } {
  const progress = getProgramProgressPct(p);
  // Un programme reactive est actif meme s'il porte encore un ancien completed_at (la RPC le remet a NULL).
  if (p.is_active) return { kind: 'active', label: 'En cours', progress: p.completed_at ? 0 : progress };
  if (p.completed_at) return { kind: 'completed', label: 'Terminé', progress: 100 };
  // `started_at` est pose des la 1re activation (trigger P24) : un programme active puis desactive sans aucune
  // seance faite n'est PAS "en pause 0 %" mais "Pas encore demarre" (run5 P7).
  if (p.started_at && progress > 0) return { kind: 'paused', label: 'En pause', progress };
  return { kind: 'unstarted', label: 'Pas encore démarré', progress: 0 };
}
