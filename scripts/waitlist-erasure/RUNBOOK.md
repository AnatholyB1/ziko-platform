# Waitlist Erasure — RUNBOOK

**Audience:** the support agent who receives an erasure request and is about to run a real,
credential-gated command against production. Read this file before running anything.

---

## 1. The request

A request arrives at **support@ziko-app.com**. The registrant asks to have their email address
removed from the founder waitlist, exercising their right to erasure under Article 17 GDPR.

---

## 2. Before running anything: verify the requester owns the address

**Confirm the requesting address matches the address to be erased before running anything.**
Nothing in this tooling can verify ownership — this is the one control against a third party
erasing someone else's waitlist entry. If the request arrives from a different address than the
one to be erased (e.g. "please erase my friend's address"), do not proceed without independently
confirming the actual registrant's intent (reply to the address on file and ask for confirmation
before running the command).

---

## 3. What the erasure does

`scripts/waitlist-erasure/erase.mjs` calls `anonymize_waitlist_signup(p_email)` — the
`SECURITY DEFINER`, `service_role`-only RPC Phase 1 already built and proved
(`supabase/migrations/20260812_waitlist_founder_offer.sql` lines 217-241). It blanks the stored
email and identifying fields and sets `anonymized_at`. It **intentionally preserves `founder_rank`
and `is_founder`** (Phase 1's D-07) — an erasure never renumbers other registrants, and the
displayed founder count never moves because of an erasure. What happens to a *claimed* founder
spot after erasure — whether it survives as an accepted contractual offer — is an open legal
question routed to counsel by `03-COUNSEL-BRIEFING.md` (Q3), not settled by this script or this
runbook.

---

## 4. Environment

```
node --env-file=apps/web/.env.local scripts/waitlist-erasure/erase.mjs --email <address> --confirm
```

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | project URL, e.g. `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server-only — never expose to a client, never commit it |

The script never falls back to a publishable or anon key. If either variable is absent it exits
non-zero, naming the missing variable, and touches nothing.

---

## 5. The invocation

```
node --env-file=apps/web/.env.local scripts/waitlist-erasure/erase.mjs --email <address> --confirm [--log <path>]
```

- `--email <address>` — **required.** The exact address to erase, passed through to the RPC
  verbatim (the RPC normalizes internally; this script does not).
- `--confirm` — **required.** Without it, the script refuses to run at all — this is the
  deliberate safety gate, not an accidental omission.
- `--log <path>` — optional. Defaults to a file under the OS temp directory. Never point this at a
  path inside the repository: a real registrant's address must never be committed.

---

## 6. Reading the outcome

The script reports exactly one of three outcomes:

| Outcome | Meaning |
|---|---|
| **Erased** | The RPC returned `true`. The address was anonymized. Reply to the registrant confirming completion. |
| **No matching active row** | The RPC returned `false` — either the address was never on the waitlist, or it was already anonymized previously. This is a legitimate outcome, not a failure; double-check the address for typos before replying. |
| **Error** | The RPC call itself failed (network, credentials, or a database error). Nothing was changed. Re-check the environment variables and retry. |

---

## 7. The one-month deadline

Article 12 GDPR requires a response within **one month at most** of the request. The
point-of-collection notice and the privacy policy both commit to this ceiling
(`ERASURE_REQUEST_STATEMENT` in `apps/web/src/content/legal/founder-offer.ts`) — treat it as a
hard operational deadline, not a target.

---

## 8. Scope: what this procedure does not do

No self-service erasure UI or confirmation-email flow exists this milestone (deferred to v2 per
`REQUIREMENTS.md` ENG-01–05). Every erasure this milestone is a manual, human-initiated action
performed by a support agent following this runbook — nothing in this directory is invoked
automatically, on a schedule, or as part of any deploy.
