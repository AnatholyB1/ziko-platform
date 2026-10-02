# 04-07 Summary — Real load into portfolio (ubxllsvanurkwkohzxau)

Executed inline by the orchestrator (the typed authorization was the user's own message in the main session; sub-agents correctly refused a relayed approval).

- **Step 0 gate:** `grep -qx "Typed authorization: approve ubxllsvanurkwkohzxau option-load-data" 04-06-SUMMARY.md` -> GATE_PASS.
- **Probe:** source role supabase_read_only_user (bypassrls=true), target role postgres (bypassrls=true), replica_ok=true, TRUNCATE privilege 99/99, trigger mode `replica` (same as scratch).
- **Apply:** guarded 99-table TRUNCATE (no CASCADE), per-table COPY with in-flight collision-UUID remap. 20,897 rows across 99 tables. Sequence ziko_waitlist_founder_seq 87 -> 87 (no regression). 18 triggers inspected, 0 not in enabled-origin state.
- **Verification (`06-verify-data --check all --baseline`, exit 0):** [PASS] counts 99/99 exact; [PASS] rls 99/99; [PASS] triggers (18 table triggers + 2 on auth.users enabled); [PASS] fk 144 validated, 97 auth.users FK columns; [PASS] orphans 0 across 144; [PASS] sequence (1 compared, 0 sequence-backed columns); [PASS] remap (source UUID absent on target, target occurrences match source); [PASS] tenants (39 tables, 0 row-count deltas).
- **Reports:** scripts/portfolio-migration/reports/portfolio-load.json, portfolio-verify.json (PII grep: 0 hits for `@` and full UUIDs).
- **Success criteria:** SC1 load report + triggers check; SC2 sequence check; SC3 counts 99/99; SC4 fk + orphans; SC5 committed re-runnable suite (`06-verify-data.mjs`) + this run.
- **Token retirement:** scripts/auth-merge/.access-token and .tmp-* files deleted. User must revoke `ziko-data-copy-phase4` (and the Phase 3 temp tokens) in the Supabase dashboard.
- **Hand-off:** Phase 6 reuses 05-load-data.mjs for the final truncate-and-reload in the write-freeze (run the auth delta first). Three rows store ziko-project storage URLs (Phase 5/6).
