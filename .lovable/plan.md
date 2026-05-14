## Problem

In the **New service preset** dialog, the "Key" field is empty (the `my_preset_key` text is just a placeholder). When you press Create, Zod rejects it with **"String must contain at least 2 characters"** because `key` is required (`z.string().min(2)`).

The toast surfaces only the raw Zod message, so it isn't obvious which field is wrong.

## Fix

Two small, frontend-only changes in `src/features/presets/components/PresetsTab.tsx`:

1. **Auto-derive the key from the label** in `CreateDialog`, the same way the AI-draft path already does via `slugify(label)`.
   - As the user types a Label, if they haven't manually edited the Key, set Key = `slugify(label)`.
   - Once the user edits the Key field directly, stop auto-syncing (track a `keyTouched` flag).
   - This also fixes the AI flow when the AI returns a label that slugs to <2 chars or invalid chars.

2. **Friendlier validation messages** on the schema so any remaining failure tells you which field:
   - `key`: "Key must be 2–64 characters (lowercase letters, digits, underscores)."
   - `label`: "Label must be at least 2 characters."
   - Pre-trim Label/Key before validating; if Key is still empty after auto-derive, surface "Add a label first" instead of the raw Zod message.

No schema, RLS, or backend changes. No behavior change for the AI-generated draft path beyond message clarity.

## Files touched

- `src/features/presets/components/PresetsTab.tsx` — `CreateDialog` state wiring, `presetSchema` messages, `submit()` error mapping.