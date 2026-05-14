# Fix: AI generation never runs when creating a preset

## Root cause

In `src/features/presets/components/PresetsTab.tsx`, the header button is a plain "New preset" button that only opens the blank `CreateDialog`:

```tsx
<Button onClick={() => setCreating(true)}>
  <Plus /> New preset
</Button>
```

The `AIGenerateDialog` is imported but never rendered, and `CreateDialog` is never given an `initialDraft`. So clicking **New preset** always opens the empty form — no AI call is ever made. That matches the screenshot: the new custom preset has only the label/description the user typed and no NAICS/agencies/etc.

The earlier intended split-button (Blank vs. Generate with AI) was lost.

## Fix

Edit only `src/features/presets/components/PresetsTab.tsx` — frontend wiring only, no schema/backend/edge-function changes.

1. **Add state** for the AI dialog and the generated draft:
   - `aiOpen: boolean`
   - `aiDraft: GeneratedPresetDraft | null`

2. **Replace the single header button with a split button** using the existing `DropdownMenu` (already imported):
   - Primary action "New preset" (blank) → `setCreating(true)`
   - Caret dropdown with two items:
     - "Blank preset" → `setCreating(true)`
     - "Generate with AI ✨" → `setAiOpen(true)`

3. **Render `<AIGenerateDialog>`** when `aiOpen`. On `onGenerated(draft)`:
   - `setAiDraft(draft)`
   - `setCreating(true)`
   - close the AI dialog

4. **Pass `initialDraft={aiDraft}` to `<CreateDialog>`** and clear `aiDraft` in its `onClose`.

## Verification

- Click the caret → "Generate with AI" → fill category → confirm the edge function `generate-preset` is invoked (network tab) and the editor opens pre-filled with NAICS, agencies, vehicles, compliance, discriminators, keywords, plus the Info hint icons next to section labels.
- Click "New preset" (primary) → opens empty form as before.
- Save → custom preset appears with full content (not just label/description).
