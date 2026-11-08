-- SECURITY INVOKER trigger functions / functions that write ziko_* tables (would run with the caller's privileges)
select p.proname, p.prosecdef as secdef,
  (select string_agg(distinct m[1], ',') from regexp_matches(p.prosrc, '(?:insert\s+into|update|delete\s+from)\s+(?:public\.)?(ziko_[a-z0-9_]+)', 'gi') m) as writes,
  exists(select 1 from pg_trigger t where t.tgfoid=p.oid and not t.tgisinternal) as is_trigger,
  (select string_agg(distinct c.relname, ',') from pg_trigger t join pg_class c on c.oid=t.tgrelid where t.tgfoid=p.oid and not t.tgisinternal) as on_tables,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' and not p.prosecdef
  and p.prosrc ~* '(insert\s+into|update|delete\s+from)\s+(public\.)?ziko_'
order by 1;
