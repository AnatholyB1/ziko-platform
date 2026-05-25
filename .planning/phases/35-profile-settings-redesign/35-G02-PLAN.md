---
phase: 35-profile-settings-redesign
plan: G02
type: gap-fix
depends_on: []
files_modified:
  - apps/mobile/app/(app)/profile/security.tsx
autonomous: true
gap_refs: [smoke-G02-password]
---

# 35-G02 — Password Change: Fix Infinite Spinner

## Problem

`security.tsx` `savePassword` calls `supabase.auth.updateUser({ password: newPwd })` but:
1. No timeout — if the network is slow or Supabase auth is unreachable, the spinner never stops
2. Error path sets `setLoading(false)` only inside `catch` — if Supabase returns `{ error }`
   without throwing (which it does), the loading state is never cleared
3. The success path does not clear the password fields, leaving the form in a confusing state

## Tasks

### Task 1 — Fix the save handler

Replace the current handler with a robust version:

```ts
const savePassword = async () => {
  if (!newPwd || newPwd.length < 8) {
    showAlert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères.');
    return;
  }
  if (newPwd !== confirmPwd) {
    showAlert('Erreur', 'Les mots de passe ne correspondent pas.');
    return;
  }
  setLoading(true);
  try {
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) throw error;
    setNewPwd('');
    setConfirmPwd('');
    showAlert('Succès', 'Mot de passe modifié.');
  } catch (err: any) {
    showAlert('Erreur', err.message ?? 'Impossible de modifier le mot de passe.');
  } finally {
    setLoading(false);
  }
};
```

Key fixes:
- `finally` block guarantees `setLoading(false)` regardless of success/error/throw
- Explicit `if (error) throw error` converts Supabase result-style error to thrown error
- Client-side validation (length ≥ 8, confirmation match) before any network call
- Clear fields on success

### Task 2 — Add minimum length indicator

Below the password input, show a short hint that updates dynamically:

```ts
{newPwd.length > 0 && newPwd.length < 8 && (
  <Text style={{ fontSize: 11, color: '#E94B3C', marginTop: 4 }}>
    Minimum 8 caractères ({newPwd.length}/8)
  </Text>
)}
```

## Success Criteria

- [ ] Enter password < 8 chars → validation error shown before network call
- [ ] Enter mismatched confirmation → validation error
- [ ] Valid password change → spinner stops, fields clear, success alert
- [ ] Network failure → spinner stops, error alert shown
- [ ] TypeScript: zero errors
