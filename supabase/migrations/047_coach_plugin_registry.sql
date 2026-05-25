-- Migration 047: Add coach plugin to plugins_registry
-- GAP-01 fix: store/[id].tsx fetches manifest from plugins_registry; missing row
-- causes infinite loading spinner and blocks the mandatory trash gate (COACH-04).

INSERT INTO public.plugins_registry (plugin_id, manifest, bundle_url, is_active, version)
VALUES (
  'coach',
  '{
    "id": "coach",
    "name": "Mon coach",
    "version": "1.0.0",
    "description": "Connecte-toi à ton coach personnel.",
    "icon": "person-outline",
    "category": "coaching",
    "price": "free",
    "requiredPermissions": ["read_profile"],
    "userDataKeys": ["coach_link"],
    "mandatory": true,
    "aiSkills": [],
    "aiTools": [
      {
        "name": "coach_get_link",
        "description": "Check coach link status. Returns coach name, specialties, KYC verification, and link date when linked.",
        "parameters": {"type": "object", "properties": {}}
      },
      {
        "name": "coach_revoke_link",
        "description": "Unlink current coach. IMPORTANT: Always ask for explicit user confirmation before calling with confirmed: true.",
        "parameters": {
          "type": "object",
          "properties": {
            "confirmed": {"type": "boolean", "description": "Must be true after user explicitly agrees"}
          },
          "required": ["confirmed"]
        }
      }
    ],
    "routes": [
      {
        "path": "/(plugins)/coach/dashboard",
        "title": "Mon coach",
        "icon": "person-outline",
        "showInTabBar": false
      }
    ]
  }'::jsonb,
  NULL,
  TRUE,
  '1.0.0'
)
ON CONFLICT (plugin_id) DO UPDATE
  SET manifest    = EXCLUDED.manifest,
      is_active   = TRUE,
      version     = EXCLUDED.version;
