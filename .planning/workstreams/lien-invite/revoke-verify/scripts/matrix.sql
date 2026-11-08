-- privilege matrix for ziko_* tables: one row per table, string of granted DML for anon / authenticated
select c.relname,
  (select string_agg(p, ',' order by p) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p where has_table_privilege('anon', c.oid, p)) as anon,
  (select string_agg(p, ',' order by p) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p where has_table_privilege('authenticated', c.oid, p)) as authenticated,
  (select string_agg(p, ',' order by p) from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p where has_table_privilege('service_role', c.oid, p)) as service_role
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p') and c.relname like 'ziko\_%' order by 1;
