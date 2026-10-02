import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCAN_ROOTS,
  FALSE_POSITIVES,
  surfaceOf,
  importSpecifierFor,
  classifyOccurrences,
  rewriteSource,
  renderConstantsModule,
  insertImport,
  camelKey,
} from './11-codemod-buckets.mjs';

const IDS = [
  'ai-imports',
  'avatars',
  'coach-exercises',
  'coach-kyc',
  'coach-logos',
  'coach-videos',
  'exercise-media',
  'exports',
  'profile-photos',
  'scan-photos',
];
const MAP = {
  generated_at: 'fixture',
  source_ref: 'fixture',
  buckets: IDS.map((id) => ({ id, target_id: `ziko-${id}`, key: camelKey(id) })),
};

const BACKEND = 'backend/api/src/routes/storage.ts';
const WEB = 'apps/web/src/components/coach/LogoUpload.tsx';
const MOBILE = 'apps/mobile/app/(app)/profile/index.tsx';
const PLUGIN = 'plugins/coach/src/screens/CoachScreen.tsx';
const SCRIPT = 'scripts/exercise-import/lib/merge-row.ts';

const kinds = (src, file) => classifyOccurrences(src, { file, map: MAP }).map((o) => o.kind);
const rw = (src, file) => rewriteSource(src, { file, map: MAP });

test('camelKey converts kebab ids', () => {
  assert.equal(camelKey('ai-imports'), 'aiImports');
  assert.equal(camelKey('avatars'), 'avatars');
  assert.equal(camelKey('coach-kyc'), 'coachKyc');
});

test('SCAN_ROOTS and FALSE_POSITIVES are exported arrays', () => {
  assert.ok(SCAN_ROOTS.includes('backend/api/src'));
  assert.ok(SCAN_ROOTS.some((r) => r.includes('plugins')));
  assert.ok(FALSE_POSITIVES.some((f) => f.file.endsWith('VideoListScreen.tsx')));
});

test('surfaceOf maps files to deployable surfaces', () => {
  assert.equal(surfaceOf('backend/api/src/routes/storage.ts'), 'backend');
  assert.equal(surfaceOf('apps/web/src/app/api/photo/route.ts'), 'web');
  assert.equal(surfaceOf('apps/mobile/app/(app)/profile/index.tsx'), 'mobile');
  assert.equal(surfaceOf('apps/mobile/src/components/ExercisePicker.tsx'), 'mobile');
  assert.equal(surfaceOf('plugins/coach/src/screens/CoachScreen.tsx'), 'mobile');
  assert.equal(surfaceOf('scripts/exercise-import/lib/merge-row.ts'), 'scripts');
  assert.equal(surfaceOf('backend/api/test/coach/imports.spec.ts'), 'tests');
  assert.equal(surfaceOf('scripts/exercise-import/lib/merge-row.test.ts'), 'tests');
});

test('backend .js specifier is relative', () => {
  assert.equal(importSpecifierFor('backend/api/src/routes/storage.ts'), '../config/buckets.js');
  assert.equal(importSpecifierFor('backend/api/src/coach/exercises/db.ts'), '../../config/buckets.js');
  assert.equal(importSpecifierFor('backend/api/src/config/models.ts'), './buckets.js');
});

test('web alias specifier and plugin-sdk specifier', () => {
  assert.equal(importSpecifierFor('apps/web/src/components/coach/LogoUpload.tsx'), '@/lib/buckets');
  assert.equal(importSpecifierFor('apps/mobile/app/(app)/profile/index.tsx'), '@ziko/plugin-sdk');
  assert.equal(importSpecifierFor('plugins/coach/src/screens/CoachScreen.tsx'), '@ziko/plugin-sdk');
  assert.equal(importSpecifierFor('scripts/exercise-import/lib/merge-row.ts'), null);
  assert.equal(importSpecifierFor('backend/api/test/x.spec.ts'), null);
});

test('multi-line storage from is classified storage-from and rewritten', () => {
  const src = [
    "import { x } from './y.js';",
    'const r = await db.storage',
    "      .from('coach-exercises')",
    '      .remove([p]);',
    '',
  ].join('\n');
  assert.deepEqual(kinds(src, 'backend/api/src/coach/exercises/db.ts'), ['storage-from']);
  const out = rw(src, 'backend/api/src/coach/exercises/db.ts');
  assert.match(out, /\.from\(STORAGE_BUCKETS\.coachExercises\)/);
  assert.match(out, /import \{ STORAGE_BUCKETS \} from '\.\.\/\.\.\/config\/buckets\.js';/);
});

test('db from untouched', () => {
  const src = [
    "import { x } from './y.js';",
    "const a = db.from('coach_client_links').select('*');",
    "const b = db.from('coach_exercises').select('*');",
    '',
  ].join('\n');
  assert.deepEqual(kinds(src, BACKEND), []);
  assert.equal(rw(src, BACKEND), src);
});

test('unclassified exports: .from without .storage is never rewritten', () => {
  const src = "import a from 'a';\nconst x = thing.from('exports');\n";
  assert.deepEqual(kinds(src, BACKEND), ['unclassified']);
  assert.throws(() => rw(src, BACKEND), /unclassified/);
  assert.throws(() => rw(src, BACKEND), /storage\.ts:2/);
});

test('array members and const decls and call args use the constant (backend)', () => {
  const src = [
    "import { Hono } from 'hono';",
    "const ALLOWED_BUCKETS = ['profile-photos', 'scan-photos', 'exports'] as const;",
    "const COACH_PHOTO_BUCKET = 'coach-kyc';",
    "await cleanupBucket('scan-photos', 5);",
    '',
  ].join('\n');
  assert.deepEqual(kinds(src, BACKEND), ['array-member', 'array-member', 'array-member', 'const-decl', 'call-arg']);
  const out = rw(src, BACKEND);
  assert.match(
    out,
    /ALLOWED_BUCKETS = \[STORAGE_BUCKETS\.profilePhotos, STORAGE_BUCKETS\.scanPhotos, STORAGE_BUCKETS\.exports\] as const;/,
  );
  assert.match(out, /COACH_PHOTO_BUCKET = STORAGE_BUCKETS\.coachKyc;/);
  assert.match(out, /cleanupBucket\(STORAGE_BUCKETS\.scanPhotos, 5\)/);
  assert.match(out, /import \{ STORAGE_BUCKETS \} from '\.\.\/config\/buckets\.js';/);
  assert.doesNotMatch(out, /'scan-photos'/);
});

test('web alias import', () => {
  const src = [
    "'use client';",
    "import { createClientSupabase } from '@/lib/supabase';",
    "const u = createClientSupabase().storage.from('coach-logos').getPublicUrl(p);",
    '',
  ].join('\n');
  const out = rw(src, WEB);
  assert.match(out, /\.from\(STORAGE_BUCKETS\.coachLogos\)/);
  assert.match(out, /import \{ STORAGE_BUCKETS \} from '@\/lib\/buckets';/);
  assert.ok(out.indexOf('@/lib/buckets') > out.indexOf('@/lib/supabase'));
});

test('plugin-sdk import merge into existing import', () => {
  const src = [
    "import { showAlert, useTranslation } from '@ziko/plugin-sdk';",
    "const u = supabase.storage.from('coach-logos').getPublicUrl(p);",
    '',
  ].join('\n');
  const out = rw(src, PLUGIN);
  assert.match(out, /import \{ showAlert, useTranslation, STORAGE_BUCKETS \} from '@ziko\/plugin-sdk';/);
  assert.equal((out.match(/@ziko\/plugin-sdk/g) ?? []).length, 1);
});

test('plugin-sdk new import line when none exists', () => {
  const src = [
    "import React from 'react';",
    "import { View } from 'react-native';",
    "const u = supabase.storage.from('avatars').getPublicUrl(p);",
    '',
  ].join('\n');
  const out = rw(src, MOBILE);
  assert.match(out, /import \{ View \} from 'react-native';\nimport \{ STORAGE_BUCKETS \} from '@ziko\/plugin-sdk';/);
});

test('multi-line existing import keeps compiling', () => {
  const src = [
    'import {',
    '  showAlert,',
    '  useTranslation,',
    "} from '@ziko/plugin-sdk';",
    "const u = supabase.storage.from('avatars').getPublicUrl(p);",
    '',
  ].join('\n');
  const out = rw(src, MOBILE);
  assert.match(out, /useTranslation, STORAGE_BUCKETS\n\} from '@ziko\/plugin-sdk';/);
});

test('query string occurrences are renamed in place', () => {
  const src = "const url = `/api/storage/upload-url?bucket=scan-photos&path=${p}`;\nconst b = 'upload-url?bucket=coach-kyc';\n";
  assert.deepEqual(kinds(src, WEB), ['in-string', 'in-string']);
  const out = rw(src, WEB);
  assert.match(out, /bucket=ziko-scan-photos&path=/);
  assert.match(out, /bucket=ziko-coach-kyc'/);
  assert.doesNotMatch(out, /import/);
});

test('split path segment and URL-format comment are renamed in place', () => {
  const src = [
    '// URL format: .../storage/v1/object/public/profile-photos/{userId}/{timestamp}.jpg',
    "const urlParts = photoUrl.split('/profile-photos/');",
    '',
  ].join('\n');
  assert.deepEqual(kinds(src, MOBILE), ['comment', 'in-string']);
  const out = rw(src, MOBILE);
  assert.match(out, /public\/ziko-profile-photos\/\{userId\}/);
  assert.match(out, /split\('\/ziko-profile-photos\/'\)/);
});

test('import paths containing an id segment are unclassified', () => {
  const src = "import x from '../exports/thing';\n";
  assert.deepEqual(kinds(src, BACKEND), ['unclassified']);
});

test('false positive react-query key untouched', () => {
  const src = [
    "const q = useQuery({ queryKey: ['coach-videos', user?.id] });",
    "queryClient.invalidateQueries({ queryKey: ['coach-videos'] });",
    '',
  ].join('\n');
  const f = 'plugins/coach/src/screens/VideoListScreen.tsx';
  assert.deepEqual(kinds(src, f), ['false-positive', 'false-positive']);
  assert.equal(rw(src, f), src);
  // same text in another file is NOT allowlisted
  assert.deepEqual(kinds(src, 'plugins/coach/src/screens/Other.tsx'), ['unclassified', 'unclassified']);
});

test('test-file literal renamed in place with no import', () => {
  const src = "expect(EXERCISE_MEDIA_BUCKET).toBe('exercise-media');\nconst s = 'https://x.co/storage/v1/object/sign/ai-imports/signed';\n";
  const f = 'scripts/exercise-import/lib/merge-row.test.ts';
  assert.deepEqual(kinds(src, f), ['test-literal', 'test-literal']);
  const out = rw(src, f);
  assert.match(out, /toBe\('ziko-exercise-media'\)/);
  assert.match(out, /sign\/ziko-ai-imports\/signed/);
  assert.doesNotMatch(out, /STORAGE_BUCKETS/);
  const spec = rw("it('x', () => db.storage.from('coach-videos'));\n", 'backend/api/test/a.spec.ts');
  assert.match(spec, /from\('ziko-coach-videos'\)/);
});

test('scripts surface renames const literal in place', () => {
  const src = "export const EXERCISE_MEDIA_BUCKET = 'exercise-media';\n/**\n * writes the `exercise-media` Storage bucket\n */\n";
  const out = rw(src, SCRIPT);
  assert.match(out, /EXERCISE_MEDIA_BUCKET = 'ziko-exercise-media';/);
  assert.match(out, /`ziko-exercise-media` Storage/);
  assert.doesNotMatch(out, /STORAGE_BUCKETS/);
});

test('idempotency', () => {
  const src = [
    "import { Hono } from 'hono';",
    "const ALLOWED_BUCKETS = ['profile-photos', 'exports'] as const;",
    "const r = await db.storage.from('coach-exercises').remove([a]);",
    "const q = '/storage/upload-url?bucket=scan-photos&path=1';",
    '',
  ].join('\n');
  const once = rw(src, BACKEND);
  const twice = rw(once, BACKEND);
  assert.equal(twice, once);
  assert.deepEqual(kinds(once, BACKEND), []);
  const t = rw("x('exercise-media');\n", 'a/b.test.ts');
  assert.equal(rw(t, 'a/b.test.ts'), t);
});

test('already-converted ziko- ids are never matched', () => {
  const src = "const a = 'ziko-avatars'; const b = '/ziko-avatars/x'; const c = 'u?bucket=ziko-avatars&p=1';\n";
  assert.deepEqual(kinds(src, BACKEND), []);
});

test('CRLF files keep CRLF on import insertion', () => {
  const src = "import a from 'a';\r\nconst u = db.storage.from('avatars').x;\r\n";
  const out = rw(src, BACKEND);
  assert.ok(!/[^\r]\n/.test(out));
});

test('renderConstantsModule emits all keys with ziko- values', () => {
  const out = renderConstantsModule(MAP);
  for (const id of IDS) assert.ok(out.includes(`'ziko-${id}'`), id);
  assert.ok(out.includes('aiImports:'));
  assert.ok(out.includes('as const'));
  assert.ok(out.includes('export type StorageBucket'));
  assert.match(out, /do not edit by hand/i);
  assert.equal((out.match(/'ziko-/g) ?? []).length, 10);
});

test('insertImport is a no-op when already imported', () => {
  const src = "import { STORAGE_BUCKETS } from '@ziko/plugin-sdk';\nx;\n";
  assert.equal(insertImport(src, { file: MOBILE }), src);
});

test('bucket ids come only from the map', () => {
  const small = { buckets: [{ id: 'foo-bar', target_id: 'ziko-foo-bar', key: 'fooBar' }] };
  const out = rewriteSource("import a from 'a';\nconst B = db.storage.from('foo-bar');\nconst C = db.storage.from('avatars');\n", {
    file: BACKEND,
    map: small,
  });
  assert.match(out, /STORAGE_BUCKETS\.fooBar/);
  assert.match(out, /from\('avatars'\)/);
});
