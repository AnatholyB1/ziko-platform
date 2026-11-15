// Double de test : mini client Supabase en memoire (select/insert/update/eq/in/gte/order/limit/head count).
// Ne prouve PAS la semantique PostgREST reelle (RLS, types, contraintes).
type Row = Record<string, any>;

export function createFakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }));
  let seq = 0;
  const calls: Array<{ table: string; op: string; payload?: any }> = [];

  function from(table: string) {
    tables[table] ??= [];
    const filters: Array<(r: Row) => boolean> = [];
    let op: 'select' | 'insert' | 'update' = 'select';
    let payload: any;
    let head = false;
    let wantCount = false;
    let limit = Infinity;
    let order: { col: string; asc: boolean } | null = null;
    let single: 'single' | 'maybe' | null = null;
    let returning = false;

    const run = () => {
      const all = tables[table];
      if (op === 'insert') {
        // Cle primaire explicite deja prise : comme PostgreSQL (23505), l'INSERT echoue et n'ecrit rien.
        const ids = (Array.isArray(payload) ? payload : [payload]).map((p: Row) => p.id).filter((x: unknown) => x !== undefined);
        if (ids.some((i: unknown) => all.some((r) => r.id === i))) {
          return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        }
        const rows = (Array.isArray(payload) ? payload : [payload]).map((p: Row) => ({
          id: p.id ?? `${table}-${++seq}`,
          revision: 0,
          created_at: new Date(1700000000000 + seq * 1000).toISOString(),
          updated_at: new Date(1700000000000 + seq * 1000).toISOString(),
          ...p,
        }));
        all.push(...rows);
        calls.push({ table, op, payload });
        const data = single ? rows[0] : rows;
        return { data: returning || single ? data : null, error: null };
      }
      let matched = all.filter((r) => filters.every((f) => f(r)));
      if (op === 'update') {
        matched.forEach((r) => Object.assign(r, payload));
        calls.push({ table, op, payload });
        const data = single ? matched[0] ?? null : matched;
        return { data: returning || single ? data : null, error: null };
      }
      if (order) matched = [...matched].sort((a, b) => (a[order!.col] < b[order!.col] ? -1 : 1) * (order!.asc ? 1 : -1));
      matched = matched.slice(0, limit);
      const count = wantCount ? matched.length : null;
      if (head) return { data: null, count, error: null };
      if (single === 'single') return { data: matched[0] ?? null, error: matched[0] ? null : { message: 'no rows' }, count };
      if (single === 'maybe') return { data: matched[0] ?? null, error: null, count };
      return { data: matched, error: null, count };
    };

    const b: any = {
      select(_c?: string, opts?: { count?: string; head?: boolean }) {
        if (op !== 'select') returning = true;
        if (opts?.count) wantCount = true;
        if (opts?.head) head = true;
        return b;
      },
      insert(p: any) { op = 'insert'; payload = p; return b; },
      update(p: any) { op = 'update'; payload = p; return b; },
      eq(c: string, v: any) { filters.push((r) => r[c] === v); return b; },
      in(c: string, v: any[]) { filters.push((r) => v.includes(r[c])); return b; },
      gte(c: string, v: any) { filters.push((r) => r[c] >= v); return b; },
      order(col: string, o?: { ascending?: boolean }) { order = { col, asc: o?.ascending !== false }; return b; },
      limit(n: number) { limit = n; return b; },
      single() { single = 'single'; return b; },
      maybeSingle() { single = 'maybe'; return b; },
      then(res: any, rej: any) {
        try { return Promise.resolve(run()).then(res, rej); } catch (e) { return Promise.reject(e).then(res, rej); }
      },
    };
    return b;
  }
  return { from, tables, calls };
}
