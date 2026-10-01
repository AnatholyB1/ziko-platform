/**
 * Phase 3 collision gate (read-only). Compares email fingerprints computed inside each database.
 * Exit 0 only when every collision is the known one (D-01), there is no id conflict, and each known
 * collision is matched (or --allow-unmatched-known-collision). Never prints an email or a digest.
 */

import {
  KNOWN_COLLISION_SOURCE_IDS,
  parseCliArgs,
  requireRef,
  fetchEmailFingerprints,
  matchCollisions,
  redactPii,
  isMain,
} from './lib.mjs';

const HELP = `Usage: node scripts/auth-merge/01-collision-check.mjs --source-ref <ref> --project-ref <ref> [--allow-unmatched-known-collision]`;

async function main() {
  const args = parseCliArgs(process.argv.slice(2), {
    'source-ref': 'string',
    'project-ref': 'string',
    'allow-unmatched-known-collision': 'boolean',
  });
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  const sourceRef = requireRef(args, 'sourceRef');
  const targetRef = requireRef(args, 'projectRef');

  const src = await fetchEmailFingerprints(sourceRef);
  const tgt = await fetchEmailFingerprints(targetRef);
  const { collisions, idConflicts, alreadyImported } = matchCollisions(src, tgt);

  console.log(`source_users=${src.length}`);
  console.log(`target_users=${tgt.length}`);
  console.log(`already_imported=${alreadyImported.length}`);
  console.log(`collisions=${collisions.length}`);
  let blocking = false;
  for (const c of collisions) {
    const known = KNOWN_COLLISION_SOURCE_IDS.includes(c.sourceId);
    if (!known) blocking = true;
    console.log(
      `source=${c.sourceId} target=${c.targetId} known=${known} target_has_password=${c.targetHasPassword} target_has_email_identity=${c.targetHasEmailIdentity} target_instance_id_null=${c.targetInstanceIdNull}`
    );
  }
  for (const id of idConflicts) {
    blocking = true;
    console.log(`id_conflict=${id}`);
  }
  const matched = new Set(collisions.map((c) => c.sourceId));
  for (const id of KNOWN_COLLISION_SOURCE_IDS) {
    const inSource = src.some((s) => s.id === id);
    if (inSource && !matched.has(id) && !alreadyImported.includes(id) && !args.allowUnmatchedKnownCollision) {
      blocking = true;
      console.log(`known_collision_unmatched=${id}`);
    }
  }
  if (blocking) {
    console.error('BLOCKING (D-04): human checkpoint required');
    return 1;
  }
  return 0;
}

if (isMain(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`ERROR: ${redactPii(err.message)}`);
      process.exit(2);
    }
  );
}
