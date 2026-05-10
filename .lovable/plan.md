## Goal
Make every field on the solicitation detail page editable. Today the header **Edit** button is a dead control and the Overview cards (Key dates, Financials, Incumbent, Tags, AI summary, etc.) are read-only.

## 1. Wire the header "Edit" button to the wizard

- Reuse the existing `SolicitationForm` (4 steps: Basics, Dates, Financials, Tags & Notes) inside a new `EditSolicitationDialog`, modeled on `CreateSolicitationDialog`.
- On open, prefill `defaultValues` from the loaded solicitation (mapping DB fields back into the form input shape, including `set_aside`, dates, tags, and `metadata.notes`).
- On submit, call `useUpdateSolicitation({ id, input })`. Toast success, close, invalidate `["solicitation", id]` + `["solicitations"]` (the hook already does this).
- Add unsaved-changes guard using the form's existing `onDirtyChange` callback + a confirm dialog before close, matching the create flow.

Mount it on `SolicitationDetail.tsx` and replace the dead header `<Button>Edit</Button>` with this dialog's trigger.

## 2. Inline edits on the Overview tab

Add a small pencil button to each card in `SolicitationOverview.tsx`. Clicking it swaps the card body into an editable form with **Save / Cancel** (mirrors the Notes pattern in `ClientDetail.tsx`).

Cards and fields:

- **Key dates** — release_date, questions_due_date, proposal_due_date, expected_award_date, period_of_performance_start, period_of_performance_end. Use the shadcn date picker (Popover + Calendar with `pointer-events-auto`).
- **Financials** — estimated_value_low, estimated_value_high, contract_type, agency_type, set_aside (Selects reuse the constants from `validators/solicitation.ts`).
- **Incumbent** — has_incumbent toggle, incumbent_name, incumbent_contract_number, incumbent_contract_value, incumbent_performance_notes. When `has_incumbent=false`, sub-fields collapse.
- **Tags** — tag chips with add/remove input (same UX as the wizard step).
- **AI summary** — pencil reveals a `Textarea` so users can hand-write/override the summary when AI hasn't run.

Each card uses its slice of `solicitationFullSchema` for client-side validation (the schemas are already split: `solicitationDatesSchema`, `solicitationFinancialsSchema`, `solicitationTagsSchema`, plus a small inline schema for `ai_summary`). Save calls `useUpdateSolicitation` with only the changed slice.

## 3. Hook + types

- `useUpdateSolicitation` already accepts `Partial<SolicitationFullInput>` and routes through `toInsert`. Verify `toInsert` preserves partial updates — it does, but `metadata: { notes }` overwrites the full metadata object. Patch it to merge: only set `metadata` when `notes` is part of the partial input.
- `ai_summary` isn't in `SolicitationFullInput`. Either extend the input type or pass it as a separate update path on the hook (preferred: add an optional `ai_summary` to the update payload only — keep the create schema unchanged).

## 4. Permissions / RLS

No changes needed. `staff manage solicitations` already permits update. Client portal users are unaffected (they don't see this page).

## Files touched

- `src/features/solicitations/components/EditSolicitationDialog.tsx` (new) — wizard in dialog, prefilled.
- `src/features/solicitations/components/SolicitationOverview.tsx` — per-card edit modes with Save/Cancel.
- `src/features/solicitations/hooks/useSolicitations.ts` — fix `toInsert` metadata merge; allow optional `ai_summary` on update.
- `src/pages/SolicitationDetail.tsx` — replace dead Edit button with `EditSolicitationDialog` trigger.

## Out of scope

- Editing key requirements / evaluation factors lists (those are AI-generated structured data — separate UX).
- Bulk edits, history/audit UI (activity log already records changes via existing triggers).
