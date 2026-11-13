-- P25 (MCOA-02) etape 3/3 : un plugin marque `mandatory` dans le registre ne peut pas etre
-- desinstalle ni desactive PAR SON PROPRIETAIRE (le garde UI seul se contourne via l'API).
-- Ne bloque ni service_role, ni la suppression de compte (cascade) : auth.uid() NULL ou != proprietaire.
-- Idempotent. Non appliquee par l'agent.
CREATE OR REPLACE FUNCTION public.ziko_mandatory_plugin_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mandatory boolean;
BEGIN
  IF v_uid IS NULL OR v_uid <> OLD.user_id THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE((manifest ->> 'mandatory')::boolean, false)
    INTO v_mandatory
    FROM public.ziko_plugins_registry
   WHERE plugin_id = OLD.plugin_id
   LIMIT 1;

  IF NOT COALESCE(v_mandatory, false) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'mandatory plugin cannot be uninstalled' USING ERRCODE = '42501';
  END IF;

  IF NEW.is_enabled = false
     OR NEW.plugin_id IS DISTINCT FROM OLD.plugin_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'mandatory plugin cannot be disabled' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ziko_mandatory_plugin_guard_del ON public.ziko_user_plugins;
CREATE TRIGGER ziko_mandatory_plugin_guard_del
  BEFORE DELETE ON public.ziko_user_plugins
  FOR EACH ROW EXECUTE FUNCTION public.ziko_mandatory_plugin_guard();

DROP TRIGGER IF EXISTS ziko_mandatory_plugin_guard_upd ON public.ziko_user_plugins;
CREATE TRIGGER ziko_mandatory_plugin_guard_upd
  BEFORE UPDATE ON public.ziko_user_plugins
  FOR EACH ROW EXECUTE FUNCTION public.ziko_mandatory_plugin_guard();
