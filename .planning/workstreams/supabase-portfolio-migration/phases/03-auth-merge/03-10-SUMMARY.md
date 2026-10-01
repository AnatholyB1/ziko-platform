# 03-10 Summary — Portfolio write go/no-go

**Task 1:** read-only pre-flight completed (commit 057b4560): collision=1 known (`ea0f0b65…` ↔ `2b6a60fa…`), to_insert=38, tenants check PASS, `workflow._auto_chain_active=false`.

**Task 2 (checkpoint:decision):** the user selected the option below through the AskUserQuestion UI (their own selection, recorded verbatim; Claude did not author the choice). Rehearsal evidence (03-08): NULL `instance_id` on the collision row blocks GoTrue login, so the instance-id fix variant was chosen.

Typed authorization: approve ubxllsvanurkwkohzxau option-approve-instance-fix

Decision: option-approve-instance-fix — pass `--fill-null-instance-id` to import and `--allow-instance-id-fill` to verification (Plan 11); Plan 12 may run the `uri_allow_list` merge.

How SC3 will be proven on portfolio: rolled-back SQL probe (`06-verify.mjs --check triggers`); real GoTrue signups ran on scratch only (Plan 08).
