---
phase: 35-profile-settings-redesign
plan: G03
type: gap-fix
depends_on: []
files_modified:
  - apps/mobile/app/(app)/profile/index.tsx
autonomous: true
gap_refs: [smoke-G03-photo-upload]
---

# 35-G03 — Progress Photo Upload: FormData Fix + Column Name

## Problem

Two bugs in `handleAddPhoto` inside the ProgressPhotoGallery component (profile/index.tsx):

**Bug 1 — `fetch(uri).blob()` fails on Android physical devices**
`avatar.tsx` already has this comment: *"FormData approach — fetch(localUri).blob() fails on
Android physical devices"*. The progress photo upload uses the same broken `blob()` pattern.

**Bug 2 — Wrong column name in body_measurements insert**
The insert uses `measured_at: new Date().toISOString()` but the `body_measurements` table
(migration 012) has a `date DATE` column, not `measured_at`. Supabase returns a column-not-
found error that is caught and shown as a generic "L'upload a échoué" alert — the photo
actually uploads to storage but the DB row is never created.

## Tasks

### Task 1 — Switch to FormData upload

Replace the `fetch(uri).blob()` pattern with FormData (mirrors avatar.tsx fix):

```ts
// BEFORE (broken on Android):
const response = await fetch(uri);
const blob = await response.blob();
const { error: uploadError } = await supabase.storage
  .from('profile-photos')
  .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

// AFTER:
const formData = new FormData();
formData.append('file', { uri, name: `${Date.now()}.jpg`, type: 'image/jpeg' } as any);
const { error: uploadError } = await supabase.storage
  .from('profile-photos')
  .upload(fileName, formData, { contentType: 'multipart/form-data', upsert: false });
```

### Task 2 — Fix column name in insert

```ts
// BEFORE:
const { error: insertError } = await supabase.from('body_measurements').insert({
  user_id: userId,
  photo_url: photoUrl,
  measured_at: new Date().toISOString(),   // ← wrong column
});

// AFTER:
const { error: insertError } = await supabase.from('body_measurements').insert({
  user_id: userId,
  photo_url: photoUrl,
  date: new Date().toISOString().split('T')[0],  // ← DATE column, YYYY-MM-DD
});
```

### Task 3 — Improve error message specificity

Split the catch block to surface distinct error messages:

```ts
} catch (err: any) {
  const msg = err.message ?? '';
  if (msg.includes('storage') || msg.includes('upload')) {
    showAlert('Erreur upload', "Impossible d'envoyer la photo. Vérifie ta connexion.");
  } else if (msg.includes('body_measurements') || msg.includes('column')) {
    showAlert('Erreur base de données', 'La photo a été uploadée mais non sauvegardée.');
  } else {
    showAlert('Erreur', msg || "L'upload a échoué. Réessaie.");
  }
}
```

## Success Criteria

- [ ] Upload progress photo on Android physical device → no network error
- [ ] Photo appears in gallery immediately after upload (query invalidated)
- [ ] DB row created with correct `date` column value
- [ ] TypeScript: zero errors
