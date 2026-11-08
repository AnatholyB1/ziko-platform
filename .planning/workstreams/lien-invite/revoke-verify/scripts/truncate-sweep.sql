begin;
do $$
declare r record; role_name text; ok int; denied int; other int; tot int := 0;
begin
  foreach role_name in array array['anon','authenticated'] loop
    ok := 0; denied := 0; other := 0;
    for r in select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname like 'ziko\_%' order by 1 loop
      begin
        execute format('set local role %I', role_name);
        execute format('truncate table public.%I', r.relname);
        ok := ok + 1;
      exception when insufficient_privilege then denied := denied + 1;
                when others then other := other + 1;
      end;
      reset role;
    end loop;
    raise notice 'TRUNCATE as %: succeeded=% denied(42501)=% other_err=%', role_name, ok, denied, other;
  end loop;
end $$;
rollback;
