Add SAM.gov URL support to solicitations in two layers: a simple link field everywhere, and a one-click importer that prefills a new solicitation from a SAM.gov notice URL.

## Part 1 — `sam_url` field (simple)

**Schema**
- Add `sam_url text` column to `public.solicitations` (nullable). No RLS changes (existing policies cover it).

**Validator**
- Add `sam_url: z.string().url().optional().or(z.literal("")).transform(v => v || undefined)` to `solicitationFullSchema` and the create/update inputs in `lib/validators/solicitation.ts`.

**UI**
- `SolicitationForm.tsx` (Basics step): new "SAM.gov URL" input next to "Solicitation number".
- `SolicitationOverview.tsx` Key Info card: show the URL as a clickable "Open on SAM.gov" link with an external-link icon when present; editable inline like other fields.
- `SolicitationDetail.tsx` header: small "View on SAM.gov" link button next to the title when `sam_url` is set.
- Hooks: include `sam_url` in `toInsert`/`toUpdate` in `useSolicitations.ts` and add it to `EditSolicitationDialog`'s `toFormDefaults`.

## Part 2 — SAM.gov importer (one-click prefill)

**Data source**
- Use the public **SAM.gov Opportunities API** (`https://api.sam.gov/opportunities/v2/search`) with the user's free SAM API key. (SAM URLs use the notice ID as `noticeid` query param, which the API accepts directly.) No web scraping needed → no Firecrawl dependency.
- Store the key as a Supabase secret: `SAM_GOV_API_KEY` (request via `add_secret` after plan approval).

**Edge function**
- New function `sam-import` (verify_jwt = true by default — staff-only).
  - Input: `{ url: string }`
  - Parses the SAM URL, extracts the notice ID (UUID after `/opp/` or `noticeid` query param).
  - Calls SAM API; returns a normalized payload mapping to our schema:
    - `title` ← `title`
    - `solicitation_number` ← `solicitationNumber`
    - `issuing_agency` ← `fullParentPathName` (top-level dept) or `organizationName`
    - `agency_type` ← inferred ("Federal" if dept matches federal list)
    - `set_aside` ← mapped from `typeOfSetAsideDescription` to our enum (SDVOSB / 8(a) / WOSB / SBA / Other)
    - `release_date` ← `postedDate`
    - `proposal_due_date` ← `responseDeadLine`
    - `period_of_performance_start/end` ← from `placeOfPerformance` if present (often null)
    - `sam_url` ← the original URL
    - `description` (truncated) → `notes` in metadata
    - `attachments[]` ← list of `{ name, url }` from `resourceLinks` (not downloaded yet — see below)
  - Returns 400 on invalid URL, 404 if notice not found, 502 on upstream errors.

**UI flow**
- `CreateSolicitationDialog`: new "Import from SAM.gov" tab/button at the top of the wizard.
  - User pastes URL → calls `sam-import` → fields in the wizard prefill → user reviews/edits → saves normally via existing create path.
  - Show a spinner + toast errors. Client must still be selected manually.
- `EditSolicitationDialog`: optional "Re-sync from SAM.gov" button when `sam_url` is set, which re-fetches and offers a diff to apply (out of scope for v1 — leave as a follow-up).

**Attachments (deferred)**
- v1 just lists discovered attachments with "Download from SAM" links shown after import. Auto-uploading them into the `solicitation-documents` bucket requires an authenticated server-side fetch + storage upload per file; we'll add this as Part 3 once Part 2 works.

## Files touched

- Migration: add `sam_url` column.
- `src/lib/validators/solicitation.ts` — add field.
- `src/features/solicitations/hooks/useSolicitations.ts` — map field.
- `src/features/solicitations/components/SolicitationForm.tsx` — input on Basics.
- `src/features/solicitations/components/SolicitationOverview.tsx` — display + inline edit.
- `src/features/solicitations/components/EditSolicitationDialog.tsx` — defaults.
- `src/features/solicitations/components/CreateSolicitationDialog.tsx` — import bar.
- `src/pages/SolicitationDetail.tsx` — header link.
- `supabase/functions/sam-import/index.ts` — new function.
- Secret: `SAM_GOV_API_KEY` (requested after approval).

## Out of scope (follow-ups)

- Auto-downloading SAM attachments into `solicitation-documents`.
- Re-sync diff UI on edit.
- Importing amendments / Q&A documents from SAM.

## Verification

1. Create migration → restart confirms `sam_url` typed in `types.ts`.
2. Edit existing solicitation → set SAM URL → Overview shows clickable link → header shows link.
3. Create new → paste SAM URL like `https://sam.gov/opp/<noticeId>/view` → fields prefill → save works.
4. Bad URL / unknown notice → toast with clear error.
