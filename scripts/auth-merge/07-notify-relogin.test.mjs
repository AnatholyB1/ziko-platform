import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecipients, formatCutoverDate } from './07-notify-relogin.mjs';

const FUTURE = '2999-01-01T00:00:00Z';
const PAST = '2000-01-01T00:00:00Z';
const CONF = '2026-01-01T00:00:00Z';

const row = (id, email, over = {}) => ({
  id,
  email,
  email_confirmed_at: CONF,
  deleted_at: null,
  banned_until: null,
  full_name: null,
  ...over,
});

test('plain confirmed user goes to toSend with firstName from full_name', () => {
  const { toSend, excluded } = buildRecipients([row('1', 'a@example.com', { full_name: 'Jane  Doe' })], []);
  assert.deepEqual(toSend, [{ id: '1', email: 'a@example.com', firstName: 'Jane' }]);
  assert.equal(excluded.test_domain.length + excluded.unconfirmed.length, 0);
});

test('firstName undefined when full_name missing or blank', () => {
  const { toSend } = buildRecipients(
    [row('1', 'a@example.com'), row('2', 'b@example.com', { full_name: '   ' })],
    []
  );
  assert.equal(toSend[0].firstName, undefined);
  assert.equal(toSend[1].firstName, undefined);
});

test('test-domain (ziko-app.com) excluded', () => {
  const { toSend, excluded } = buildRecipients([row('1', 'qa@ziko-app.com')], []);
  assert.equal(toSend.length, 0);
  assert.equal(excluded.test_domain.length, 1);
});

test('unconfirmed excluded', () => {
  const { toSend, excluded } = buildRecipients([row('1', 'a@example.com', { email_confirmed_at: null })], []);
  assert.equal(toSend.length, 0);
  assert.equal(excluded.unconfirmed.length, 1);
});

test('deleted and future-banned excluded; past ban is not', () => {
  const { toSend, excluded } = buildRecipients(
    [
      row('1', 'a@example.com', { deleted_at: PAST }),
      row('2', 'b@example.com', { banned_until: FUTURE }),
      row('3', 'c@example.com', { banned_until: PAST }),
    ],
    []
  );
  assert.equal(excluded.deleted_or_banned.length, 2);
  assert.deepEqual(toSend.map((r) => r.id), ['3']);
});

test('ids in sentLog excluded as already_sent (array of entries or ids)', () => {
  const rows = [row('1', 'a@example.com'), row('2', 'b@example.com')];
  assert.equal(buildRecipients(rows, [{ user_id: '1' }]).excluded.already_sent.length, 1);
  assert.equal(buildRecipients(rows, new Set(['2'])).toSend[0].id, '1');
});

test('ziko-app.com AND unconfirmed row counts only in test_domain (precedence)', () => {
  const { excluded, toSend } = buildRecipients([row('1', 'qa@ziko-app.com', { email_confirmed_at: null })], []);
  assert.equal(excluded.test_domain.length, 1);
  assert.equal(excluded.unconfirmed.length, 0);
  assert.equal(toSend.length, 0);
});

test('buckets are disjoint and sum to input length (mixed fixture)', () => {
  const rows = [
    row('1', 'a@example.com'),
    row('2', 'qa@ziko-app.com', { email_confirmed_at: null }),
    row('3', 'c@example.com', { email_confirmed_at: null }),
    row('4', 'd@example.com', { deleted_at: PAST, email_confirmed_at: null }),
    row('5', 'e@example.com'),
    row('6', 'f@example.invalid', { banned_until: FUTURE }),
    row('7', 'g@example.com'),
  ];
  const { toSend, excluded } = buildRecipients(rows, ['5']);
  const sum = Object.values(excluded).reduce((n, l) => n + l.length, 0);
  assert.equal(toSend.length + sum, rows.length);
  assert.deepEqual(toSend.map((r) => r.id), ['1', '7']);
  assert.equal(excluded.deleted_or_banned.length, 2);
  assert.equal(excluded.unconfirmed.length, 1);
  assert.equal(excluded.already_sent.length, 1);
});

test('formatCutoverDate formats FR and EN', () => {
  assert.deepEqual(formatCutoverDate('2026-11-15'), { fr: '15 novembre 2026', en: 'November 15, 2026' });
});

test('formatCutoverDate rejects invalid or missing date', () => {
  assert.throws(() => formatCutoverDate('nope'));
  assert.throws(() => formatCutoverDate('2026-13-45'));
  assert.throws(() => formatCutoverDate(undefined));
  assert.throws(() => formatCutoverDate(null));
});
