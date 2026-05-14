## Plan to fix Service Preset deletion

1. **Fix the access rule mismatch**
   - The app currently “deletes” a preset by setting `deleted_at`, which is an update operation.
   - The database update rule requires the updated row to still satisfy the same rule after the change, but once `deleted_at` is set the row becomes hidden from normal preset visibility, causing the policy violation.
   - Add a focused database policy that allows owners/admins in the same organization to soft-delete non-built-in presets by setting `deleted_at`.

2. **Make the frontend deletion safer**
   - Keep the current soft-delete behavior so preset history/version records are preserved.
   - Update the delete mutation to confirm the row is a custom organization preset and only send the `deleted_at` change.
   - Keep the UI behavior the same: after successful deletion, refresh the Service Presets list and show “Preset deleted”.

3. **Verify the specific bad presets can be removed**
   - Confirm the two custom presets shown in the screenshot are organization-scoped, non-built-in presets.
   - After the migration is approved, verify the policy exists and the delete path no longer violates row-level security.

## Technical details

- A `DELETE` policy already exists, but the app is not using a real delete; it uses an `UPDATE` to set `deleted_at`.
- The fix should be a migration on `public.lens_presets`, not a change to generated integration files.
- The likely policy will allow authenticated owners/admins of the current organization to update `deleted_at` for `is_builtin = false` presets while preventing edits to built-in presets.