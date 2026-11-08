select 'anon_write_priv' k, count(*) filter (where has_table_privilege('anon',c.oid,'INSERT') or has_table_privilege('anon',c.oid,'UPDATE') or has_table_privilege('anon',c.oid,'DELETE')) n,
  string_agg(c.relname, ',') filter (where has_table_privilege('anon',c.oid,'INSERT') or has_table_privilege('anon',c.oid,'UPDATE') or has_table_privilege('anon',c.oid,'DELETE')) tables
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname like 'ziko\_%'
union all
select 'any_client_TRUNCATE_REFERENCES_TRIGGER', count(*) filter (where has_table_privilege('anon',c.oid,'TRUNCATE') or has_table_privilege('anon',c.oid,'REFERENCES') or has_table_privilege('anon',c.oid,'TRIGGER') or has_table_privilege('authenticated',c.oid,'TRUNCATE') or has_table_privilege('authenticated',c.oid,'REFERENCES') or has_table_privilege('authenticated',c.oid,'TRIGGER')), ''
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname like 'ziko\_%'
union all
select 'service_role_full_dml_tables', count(*) filter (where has_table_privilege('service_role',c.oid,'SELECT') and has_table_privilege('service_role',c.oid,'INSERT') and has_table_privilege('service_role',c.oid,'UPDATE') and has_table_privilege('service_role',c.oid,'DELETE')), ''
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname like 'ziko\_%'
union all
select 'non_ziko_tables_touched(grants differ from role default? count of non-ziko tables)', count(*), ''
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname not like 'ziko\_%';
