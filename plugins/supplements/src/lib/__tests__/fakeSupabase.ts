// Faux client Supabase : enregistre la chaine d'appels et renvoie un resultat fixe.
// Ne prouve PAS le comportement de PostgREST/RLS : uniquement que la bonne requete est construite.
export interface Call {
  method: string;
  args: any[];
}

export function fakeSupabase(resultFor: (table: string, calls: Call[]) => { data?: any; error?: any; count?: number | null }) {
  const log: Array<{ table: string; calls: Call[] }> = [];
  const client = {
    from(table: string) {
      const calls: Call[] = [];
      log.push({ table, calls });
      const builder: any = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === 'then') {
              const res = resultFor(table, calls);
              return (resolve: any) => resolve({ data: null, error: null, count: null, ...res });
            }
            return (...args: any[]) => {
              calls.push({ method: prop, args });
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };
  return { client, log };
}

export const callsOf = (calls: Call[], method: string) => calls.filter((c) => c.method === method);
