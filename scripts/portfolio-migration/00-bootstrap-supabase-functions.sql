-- Bootstrap for Database-Webhook-style triggers (supabase_functions.http_request).
-- ziko has this schema because Database Webhooks were enabled in the dashboard; scratch and portfolio do not.
-- Replicates the standard Supabase definition (read from ziko live; owner simplified to postgres).
-- Idempotent. Apply BEFORE supabase/portfolio-migrations/*_portfolio_ziko_functions.sql.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE SCHEMA IF NOT EXISTS supabase_functions;

CREATE TABLE IF NOT EXISTS supabase_functions.hooks (
  id bigserial PRIMARY KEY,
  hook_table_id integer NOT NULL,
  hook_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id bigint
);
CREATE INDEX IF NOT EXISTS supabase_functions_hooks_request_id_idx
  ON supabase_functions.hooks USING btree (request_id);
CREATE INDEX IF NOT EXISTS supabase_functions_hooks_h_table_id_h_name_idx
  ON supabase_functions.hooks USING btree (hook_table_id, hook_name);

CREATE OR REPLACE FUNCTION supabase_functions.http_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'supabase_functions'
AS $function$
    DECLARE
      request_id bigint;
      payload jsonb;
      url text := TG_ARGV[0]::text;
      method text := TG_ARGV[1]::text;
      headers jsonb DEFAULT '{}'::jsonb;
      params jsonb DEFAULT '{}'::jsonb;
      timeout_ms integer DEFAULT 1000;
    BEGIN
      IF url IS NULL OR url = 'null' THEN
        RAISE EXCEPTION 'url argument is missing';
      END IF;

      IF method IS NULL OR method = 'null' THEN
        RAISE EXCEPTION 'method argument is missing';
      END IF;

      IF TG_ARGV[2] IS NULL OR TG_ARGV[2] = 'null' THEN
        headers = '{"Content-Type": "application/json"}'::jsonb;
      ELSE
        headers = TG_ARGV[2]::jsonb;
      END IF;

      IF TG_ARGV[3] IS NULL OR TG_ARGV[3] = 'null' THEN
        params = '{}'::jsonb;
      ELSE
        params = TG_ARGV[3]::jsonb;
      END IF;

      IF TG_ARGV[4] IS NULL OR TG_ARGV[4] = 'null' THEN
        timeout_ms = 1000;
      ELSE
        timeout_ms = TG_ARGV[4]::integer;
      END IF;

      CASE
        WHEN method = 'GET' THEN
          SELECT http_get INTO request_id FROM net.http_get(
            url,
            params,
            headers,
            timeout_ms
          );
        WHEN method = 'POST' THEN
          payload = jsonb_build_object(
            'old_record', OLD,
            'record', NEW,
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA
          );

          SELECT http_post INTO request_id FROM net.http_post(
            url,
            payload,
            params,
            headers,
            timeout_ms
          );
        ELSE
          RAISE EXCEPTION 'method argument % is invalid', method;
      END CASE;

      INSERT INTO supabase_functions.hooks
        (hook_table_id, hook_name, request_id)
      VALUES
        (TG_RELID, TG_NAME, request_id);

      RETURN NEW;
    END
  $function$;

REVOKE ALL ON FUNCTION supabase_functions.http_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION supabase_functions.http_request() TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA supabase_functions TO postgres, anon, authenticated, service_role;
