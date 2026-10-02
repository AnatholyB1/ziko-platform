import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import {
  TARGET_BUCKET_RE,
  targetBucketId,
  assertTargetBucket,
  buildBucketMap,
  diffBucketConfig,
  rekeyObjectName,
  findMimeSizeViolations,
  rewritePolicy,
  renderPoliciesSql,
  findStalePolicyRefs,
  normalizePolicyExpr,
  evaluatePolicies,
  buildStorageUrlRegex,
  rewriteStorageUrls,
  buildUrlScanSql,
} from './lib-storage.mjs';

const PNG_GIF = ['image/png', 'image/gif'];
const LIVE_ROWS = [
  { id: 'ai-imports', public: false, file_size_limit: 26214400, allowed_mime_types: ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  { id: 'avatars', public: true, file_size_limit: null, allowed_mime_types: null },
  { id: 'coach-exercises', public: false, file_size_limit: null, allowed_mime_types: null },
  { id: 'coach-kyc', public: false, file_size_limit: null, allowed_mime_types: null },
  { id: 'coach-logos', public: true, file_size_limit: null, allowed_mime_types: null },
  { id: 'coach-videos', public: false, file_size_limit: null, allowed_mime_types: ['video/mp4', 'video/quicktime', 'video/x-m4v'] },
  { id: 'exercise-media', public: true, file_size_limit: 2097152, allowed_mime_types: ['image/png', 'image/gif'] },
  { id: 'exports', public: false, file_size_limit: null, allowed_mime_types: null },
  { id: 'profile-photos', public: false, file_size_limit: null, allowed_mime_types: null },
  { id: 'scan-photos', public: false, file_size_limit: null, allowed_mime_types: null },
];
const IDS = LIVE_ROWS.map((r) => r.id);

// --------------------------------------------------------------------------
// bucket naming
// --------------------------------------------------------------------------

test('targetBucketId prefixes and validates', () => {
  assert.equal(targetBucketId('coach-kyc'), 'ziko-coach-kyc');
  assert.throws(() => targetBucketId('ziko-x'));
  assert.throws(() => targetBucketId('Bad_Id'));
  assert.throws(() => targetBucketId(''));
  assert.ok(TARGET_BUCKET_RE.test('ziko-avatars'));
});

test('assertTargetBucket refuses anything not ziko-<id>', () => {
  assert.throws(() => assertTargetBucket('avatars'));
  assert.throws(() => assertTargetBucket('ziko-'));
  assert.throws(() => assertTargetBucket('ziko-Up'));
  assert.doesNotThrow(() => assertTargetBucket('ziko-avatars'));
});

test('buildBucketMap sorts, camelCases keys and sorts mime lists', () => {
  const shuffled = [...LIVE_ROWS].reverse();
  const m = buildBucketMap(shuffled, { sourceRef: 'srcref', generatedAt: '2026-10-02T00:00:00Z' });
  assert.equal(m.source_ref, 'srcref');
  assert.equal(m.generated_at, '2026-10-02T00:00:00Z');
  assert.equal(m.buckets.length, 10);
  assert.deepEqual(m.buckets.map((b) => b.id), [...IDS].sort());
  const em = m.buckets.find((b) => b.id === 'exercise-media');
  assert.equal(em.key, 'exerciseMedia');
  assert.equal(em.target_id, 'ziko-exercise-media');
  assert.equal(em.file_size_limit, 2097152);
  assert.deepEqual(em.allowed_mime_types, ['image/gif', 'image/png']);
  const av = m.buckets.find((b) => b.id === 'avatars');
  assert.equal(av.file_size_limit, null);
  assert.equal(av.allowed_mime_types, null);
  assert.equal(av.public, true);
});

test('diffBucketConfig', () => {
  const src = LIVE_ROWS;
  const tgt = LIVE_ROWS.map((r) => ({ ...r, id: `ziko-${r.id}`, allowed_mime_types: r.allowed_mime_types ? [...r.allowed_mime_types].reverse() : null }));
  assert.equal(diffBucketConfig(src, tgt).ok, true);

  const missing = diffBucketConfig(src, tgt.filter((r) => r.id !== 'ziko-exports'));
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.missing, ['exports']);

  const flipped = tgt.map((r) => (r.id === 'ziko-avatars' ? { ...r, public: false } : r));
  const d = diffBucketConfig(src, flipped);
  assert.equal(d.ok, false);
  assert.deepEqual(d.mismatched, [{ id: 'avatars', field: 'public' }]);

  const sized = tgt.map((r) => (r.id === 'ziko-exercise-media' ? { ...r, file_size_limit: 1 } : r));
  assert.deepEqual(diffBucketConfig(src, sized).mismatched, [{ id: 'exercise-media', field: 'file_size_limit' }]);

  const extra = diffBucketConfig(src, [...tgt, { id: 'ziko-stray', public: false, file_size_limit: null, allowed_mime_types: null }]);
  assert.deepEqual(extra.extraZiko, ['stray']);
});

// --------------------------------------------------------------------------
// re-key
// --------------------------------------------------------------------------

test('rekeyObjectName replaces only the first segment', () => {
  const sourceUuid = randomUUID();
  const targetUuid = randomUUID();
  const remap = { sourceUuid, targetUuid };
  assert.deepEqual(rekeyObjectName(`${sourceUuid}/a.png`, remap), { key: `${targetUuid}/a.png`, rekeyed: true });
  assert.deepEqual(rekeyObjectName('other/a.png', remap), { key: 'other/a.png', rekeyed: false });
  assert.throws(() => rekeyObjectName(`x/${sourceUuid}/a.png`, remap));
  assert.throws(() => rekeyObjectName(`${sourceUuid}/${sourceUuid}/a.png`, remap));
  assert.deepEqual(rekeyObjectName(`${sourceUuid}/a.png`, null), { key: `${sourceUuid}/a.png`, rekeyed: false });
  assert.deepEqual(
    rekeyObjectName(`${sourceUuid.toUpperCase()}/a.png`, remap),
    { key: `${targetUuid}/a.png`, rekeyed: true },
  );
});

test('findMimeSizeViolations reports bucket and count only', () => {
  const objects = [
    { bucket_id: 'exercise-media', size: 10, mimetype: 'image/jpeg' },
    { bucket_id: 'exercise-media', size: 10, mimetype: 'image/png' },
    { bucket_id: 'exercise-media', size: 3 * 1024 * 1024, mimetype: 'image/png' },
    { bucket_id: 'avatars', size: 99999999, mimetype: 'text/plain' },
  ];
  const v = findMimeSizeViolations(objects, LIVE_ROWS);
  assert.deepEqual(
    v.sort((a, b) => a.reason.localeCompare(b.reason)),
    [
      { bucket: 'exercise-media', reason: 'mime', count: 1 },
      { bucket: 'exercise-media', reason: 'size', count: 1 },
    ],
  );
  assert.deepEqual(findMimeSizeViolations([], LIVE_ROWS), []);
  void PNG_GIF;
});

// --------------------------------------------------------------------------
// policies
// --------------------------------------------------------------------------

const FN = { is_coach_of: 'ziko_is_coach_of' };

function liveRow(over = {}) {
  return {
    policyname: 'coach_videos_coach_read',
    cmd: 'SELECT',
    roles: '{public}',
    permissive: 'PERMISSIVE',
    qual: "((bucket_id = 'coach-videos'::text) AND is_coach_of(auth.uid(), ((storage.foldername(name))[1])::uuid))",
    with_check: null,
    ...over,
  };
}

test('rewritePolicy renames policy, bucket ids and function', () => {
  const p = rewritePolicy(liveRow(), { bucketIds: IDS, functionRenames: FN });
  assert.equal(p.name, 'ziko_coach_videos_coach_read');
  assert.equal(p.cmd, 'SELECT');
  assert.deepEqual(p.roles, ['public']);
  assert.equal(p.permissive, 'PERMISSIVE');
  assert.match(p.qual, /bucket_id = 'ziko-coach-videos'::text/);
  assert.match(p.qual, /public\.ziko_is_coach_of\(/);
  assert.doesNotMatch(p.qual, /[^_.]is_coach_of\(/);
  assert.equal(p.with_check, null);
});

test('rewritePolicy accepts array roles and handles with_check', () => {
  const p = rewritePolicy(
    liveRow({ policyname: 'x_up', cmd: 'INSERT', roles: ['authenticated'], qual: null, with_check: "(bucket_id = 'avatars'::text)" }),
    { bucketIds: IDS, functionRenames: FN },
  );
  assert.deepEqual(p.roles, ['authenticated']);
  assert.equal(p.with_check, "(bucket_id = 'ziko-avatars'::text)");
  assert.equal(p.qual, null);
});

test('rewritePolicy does not partially rewrite substring bucket ids', () => {
  const p = rewritePolicy(
    liveRow({ qual: "(bucket_id = 'exports-x'::text)" }),
    { bucketIds: ['exports', 'exports-x'], functionRenames: FN },
  );
  assert.equal(p.qual, "(bucket_id = 'ziko-exports-x'::text)");
  const q = rewritePolicy(liveRow({ qual: "(bucket_id = 'exports'::text)" }), { bucketIds: ['exports', 'exports-x'], functionRenames: FN });
  assert.equal(q.qual, "(bucket_id = 'ziko-exports'::text)");
});

test('rewritePolicy throws on unknown bucket literal in bucket_id comparison', () => {
  assert.throws(
    () => rewritePolicy(liveRow({ qual: "(bucket_id = 'mystery'::text)" }), { bucketIds: IDS, functionRenames: FN }),
    /mystery/,
  );
});

test('renderPoliciesSql shapes USING / WITH CHECK per command', () => {
  const mk = (cmd, qual, wc, roles = ['authenticated']) => ({ name: `ziko_${cmd.toLowerCase()}`, cmd, roles, permissive: 'PERMISSIVE', qual, with_check: wc });
  const sql = renderPoliciesSql(
    [
      mk('INSERT', null, '(a = 1)'),
      mk('SELECT', '(b = 2)', null, ['public']),
      mk('DELETE', '(c = 3)', null),
      mk('UPDATE', '(d = 4)', '(e = 5)'),
      mk('ALL', '(f = 6)', null),
    ],
    { header: 'test header' },
  );
  assert.match(sql, /^-- .*generated/im);
  assert.match(sql, /test header/);
  assert.equal((sql.match(/DROP POLICY IF EXISTS/g) || []).length, 5);
  const stmt = (name) => sql.split(';').find((s) => s.includes(`CREATE POLICY "${name}"`));
  assert.doesNotMatch(stmt('ziko_insert'), /USING/);
  assert.match(stmt('ziko_insert'), /WITH CHECK \(\(a = 1\)\)|WITH CHECK \(a = 1\)/);
  assert.doesNotMatch(stmt('ziko_select'), /WITH CHECK/);
  assert.match(stmt('ziko_select'), /TO public/);
  assert.match(stmt('ziko_delete'), /TO authenticated/);
  assert.doesNotMatch(stmt('ziko_delete'), /WITH CHECK/);
  assert.match(stmt('ziko_update'), /USING/);
  assert.match(stmt('ziko_update'), /WITH CHECK/);
  assert.match(stmt('ziko_all'), /FOR ALL/);
  assert.doesNotMatch(stmt('ziko_all'), /WITH CHECK/);
  assert.match(stmt('ziko_insert'), /ON storage\.objects/);
  // DROP precedes its CREATE
  assert.ok(sql.indexOf('DROP POLICY IF EXISTS "ziko_insert"') < sql.indexOf('CREATE POLICY "ziko_insert"'));
});

test('renderPoliciesSql rejects hostile names and roles', () => {
  const base = { cmd: 'SELECT', permissive: 'PERMISSIVE', qual: '(true)', with_check: null };
  assert.throws(() => renderPoliciesSql([{ ...base, name: 'a"b', roles: ['public'] }], { header: 'h' }));
  assert.throws(() => renderPoliciesSql([{ ...base, name: 'ok', roles: ['pub lic'] }], { header: 'h' }));
});

test('findStalePolicyRefs flags bare bucket ids and unqualified functions', () => {
  const good = { name: 'ziko_a', qual: "((bucket_id = 'ziko-avatars'::text) AND public.ziko_is_coach_of(x, y))", with_check: null };
  const badBucket = { name: 'ziko_b', qual: null, with_check: "(bucket_id = 'avatars'::text)" };
  const badFn = { name: 'ziko_c', qual: '(is_coach_of(x, y))', with_check: null };
  const badQualified = { name: 'ziko_d', qual: '(public.is_coach_of(x, y))', with_check: null };
  const out = findStalePolicyRefs([good, badBucket, badFn, badQualified], { bucketIds: IDS, functionNames: ['is_coach_of'] });
  assert.deepEqual(out.sort(), ['ziko_b', 'ziko_c', 'ziko_d']);
});

test('normalizePolicyExpr collapses whitespace only', () => {
  assert.equal(normalizePolicyExpr('(a  =\n 1 )'), normalizePolicyExpr('(a = 1)'));
  assert.equal(normalizePolicyExpr(null), '');
  assert.notEqual(normalizePolicyExpr('(a = 1)'), normalizePolicyExpr('(a = 2)'));
});

function mkPolicies(n) {
  return Array.from({ length: n }, (_, i) => ({
    name: `ziko_p${i}`,
    cmd: 'SELECT',
    roles: ['authenticated'],
    permissive: 'PERMISSIVE',
    qual: `(bucket_id = 'ziko-b${i}'::text)`,
    with_check: null,
  }));
}

test('evaluatePolicies', () => {
  const expected = mkPolicies(25);
  const others = ['alb_read', 'alb_write'];
  const ok = evaluatePolicies({ expected, actual: mkPolicies(25).map((p) => ({ ...p, qual: p.qual.replace('= ', '=  ') })), baselineOther: others, currentOther: others });
  assert.equal(ok.ok, true);

  const roles = mkPolicies(25);
  roles[3] = { ...roles[3], roles: ['public'] };
  const r = evaluatePolicies({ expected, actual: roles, baselineOther: others, currentOther: others });
  assert.equal(r.ok, false);
  assert.deepEqual(r.mismatched, ['ziko_p3']);

  const miss = evaluatePolicies({ expected, actual: mkPolicies(24), baselineOther: others, currentOther: others });
  assert.deepEqual(miss.missing, ['ziko_p24']);
  assert.equal(miss.ok, false);

  const extra = evaluatePolicies({ expected, actual: [...mkPolicies(25), { ...mkPolicies(1)[0], name: 'ziko_zz' }], baselineOther: others, currentOther: others });
  assert.deepEqual(extra.unexpected, ['ziko_zz']);

  const changed = evaluatePolicies({ expected, actual: mkPolicies(25), baselineOther: others, currentOther: ['alb_read'] });
  assert.equal(changed.ok, false);
  assert.deepEqual(changed.otherChanged, ['alb_write']);
});

// --------------------------------------------------------------------------
// URLs
// --------------------------------------------------------------------------

const SRC = 'abcdefghijklmnopqrst';
const TGT = 'zyxwvutsrqponmlkjihg';
const OPTS = { sourceRef: SRC, targetRef: TGT, buckets: IDS };

test('rewriteStorageUrls maps host and bucket', () => {
  const url = `https://${SRC}.supabase.co/storage/v1/object/public/profile-photos/x.jpg`;
  const r = rewriteStorageUrls(url, OPTS);
  assert.equal(r.text, `https://${TGT}.supabase.co/storage/v1/object/public/ziko-profile-photos/x.jpg`);
  assert.equal(r.count, 1);
  for (const kind of ['object/sign', 'object/authenticated', 'render/image/public', 'render/image/sign']) {
    const u = `https://${SRC}.supabase.co/storage/v1/${kind}/avatars/u/a.png?token=1`;
    assert.equal(rewriteStorageUrls(u, OPTS).text, `https://${TGT}.supabase.co/storage/v1/${kind}/ziko-avatars/u/a.png?token=1`);
  }
});

test('rewriteStorageUrls leaves foreign, prefixed and unknown untouched', () => {
  const already = `https://${TGT}.supabase.co/storage/v1/object/public/ziko-avatars/a.png`;
  const alreadyOnSource = `https://${SRC}.supabase.co/storage/v1/object/public/ziko-avatars/a.png`;
  const foreign = 'https://other.supabase.co/storage/v1/object/public/avatars/a.png';
  const unknown = `https://${SRC}.supabase.co/storage/v1/object/public/mystery/a.png`;
  const partial = `https://${SRC}.supabase.co/storage/v1/object/public/avatars-old/a.png`;
  for (const t of [already, alreadyOnSource, foreign, unknown, partial]) {
    const r = rewriteStorageUrls(t, OPTS);
    assert.equal(r.text, t);
    assert.equal(r.count, 0);
  }
});

test('rewriteStorageUrls handles several URLs and is idempotent', () => {
  const a = `https://${SRC}.supabase.co/storage/v1/object/public/avatars/1.png`;
  const b = `https://${SRC}.supabase.co/storage/v1/object/sign/coach-kyc/2.pdf?token=t`;
  const line = `{"a":"${a}","b":"${b}"}\tplain`;
  const r = rewriteStorageUrls(line, OPTS);
  assert.equal(r.count, 2);
  const again = rewriteStorageUrls(r.text, OPTS);
  assert.equal(again.count, 0);
  assert.equal(again.text, r.text);
  assert.ok(buildStorageUrlRegex({ sourceRef: SRC, buckets: IDS }).global);
});

test('buildUrlScanSql builds guarded scan queries', () => {
  const left = buildUrlScanSql(['ziko_user_profiles', 'ziko_body_measurements'], { ref: SRC, buckets: IDS, mode: 'leftover' });
  assert.match(left, /FROM public\."ziko_user_profiles" r WHERE r::text ~ '/);
  assert.match(left, /UNION ALL/);
  assert.ok(left.includes(SRC));
  assert.match(left, /public\|sign\|authenticated/);
  assert.ok(left.includes('coach-kyc'));
  const rew = buildUrlScanSql(['ziko_user_profiles'], { ref: TGT, buckets: IDS, mode: 'rewritten' });
  assert.ok(rew.includes(TGT));
  assert.ok(rew.includes('ziko-'));
  assert.throws(() => buildUrlScanSql(['user_profiles'], { ref: SRC, buckets: IDS, mode: 'leftover' }));
  assert.throws(() => buildUrlScanSql(['ziko_x'], { ref: SRC, buckets: IDS, mode: 'nope' }));
  assert.throws(() => buildUrlScanSql(['ziko_x'], { ref: "a'b", buckets: IDS, mode: 'leftover' }));
  assert.throws(() => buildUrlScanSql(['ziko_x; drop'], { ref: SRC, buckets: IDS, mode: 'leftover' }));
});
