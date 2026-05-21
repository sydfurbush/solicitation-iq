# Teaming & Subcontractors — per-solicitation section

Add a dedicated **Teaming** tab inside Phase 2 (Deep Dive) so each solicitation can carry its own subcontractor roster, workshare, and agreement status — separate from the client-level Capabilities profile (which stays for prime-side defaults).

## What the user sees

A new tab in **Deep Dive** (next to RTM / Section analysis / Gaps): **Teaming**.

Inside it, a table of partners on this bid, with:

- **Partner name** (free text) + optional link to an existing Client record in the org
- **Role on this bid**: Prime · Subcontractor · Teaming partner · Mentor/Protégé
- **Set-aside / socioeconomic tags**: SDVOSB, WOSB, 8(a), HUBZone, SB, LB (multi-select)
- **NAICS code(s)** they’re covering
- **Workshare %** (numeric, 0–100)
- **Scope they perform** (short text — “Zero Trust engineering, ~30% LOE”)
- **Agreement status**: None · NDA · Teaming Agreement · LOI · Subcontract executed
- **POC name / email / phone**
- **Cleared staff / clearance level** (optional)
- **Notes** (free text)
- **Attachments**: 0..N files (TA, LOC, capability statement) stored in the existing `documents` bucket under this solicitation

Roll-up strip above the table: **Total workshare %**, **Small-business participation %**, **# of partners**, warning if workshare ≠ 100%.

Empty state explains the difference between this (per-bid team) and the client Capabilities → Teaming partners field (default partner pool).

## How it plugs into the AI

The roster is included in the prompt context for these existing functions, so downstream phases stop treating sub-covered scope as a gap and can speak to teaming in the narrative:

- `analyze-gaps` — mark requirements covered by a sub (no longer a gap, severity downgraded to "covered_by_sub")
- `identify-risks-opportunities` — flag workshare imbalance, missing TA, expired NDAs as risks; small-biz participation as an opportunity
- `generate-outline` — assign Management/Staffing sections to reference subs
- `generate-win-themes` — pull discriminators from sub capability statements
- `draft-section` (Management Volume, Subcontracting Plan, Small Business Participation) — uses roster + workshare directly

Same staleness pattern as Capabilities: roster `updated_at` vs analysis `updated_at` shows a "Roster changed — regenerate" banner on Gaps / Risks / Outline.

## Permissions

Same access model as other solicitation-scoped tables — staff assigned to the solicitation can read/write; client portal users on `full` access can read.

---

## Technical details

### New tables

```text
solicitation_teaming_partners
  id uuid pk
  solicitation_id uuid not null            -- scopes RLS via is_solicitation_member
  linked_client_id uuid null                -- optional ref to clients.id (other org records)
  name text not null
  role text not null                        -- prime|sub|teaming|mentor_protege
  set_asides text[] default '{}'            -- SDVOSB, WOSB, 8a, HUBZone, SB, LB
  naics_codes text[] default '{}'
  workshare_pct numeric(5,2) null           -- 0..100, trigger-validated
  scope_summary text null
  agreement_status text not null default 'none'  -- none|nda|ta|loi|subcontract
  poc_name text null
  poc_email text null
  poc_phone text null
  clearance_level text null
  cleared_staff_count integer null
  notes text null
  sort_order integer default 0
  created_by uuid null
  created_at timestamptz default now()
  updated_at timestamptz default now()

solicitation_teaming_attachments
  id uuid pk
  partner_id uuid not null   -- fk solicitation_teaming_partners
  solicitation_id uuid not null  -- denormalized for RLS
  file_path text not null     -- documents bucket
  file_name text not null
  mime_type text null
  byte_size integer null
  uploaded_by uuid null
  created_at timestamptz default now()
```

RLS on both: mirror existing solicitation-scoped policies (`is_solicitation_member(auth.uid(), solicitation_id)` for staff ALL; client portal SELECT when `access_level = 'full'`).

Validation trigger (not CHECK) on `workshare_pct` to enforce 0..100, and on `role` / `agreement_status` to enforce enum values (or use proper enums — preferred).

Updated-at trigger reusing `update_updated_at_column()`.

### Frontend

- `src/features/teaming/hooks/useTeamingPartners.ts` — list/create/update/delete + attachments
- `src/features/teaming/components/TeamingTable.tsx` — inline-editable rows, totals row
- `src/features/teaming/components/PartnerDrawer.tsx` — full edit form (long-form fields + attachments)
- `src/features/teaming/components/TeamingRollup.tsx` — workshare/SB % chips + warnings
- Mount as 4th tab in `src/pages/SolicitationDeepDive.tsx` ("Teaming")
- Reuse `ExportMenu` so the roster exports with the deep-dive PDF/DOCX

### Edge-function changes (prompt-only, no schema)

Update these to load the partner roster for the solicitation and include a compact JSON block in the prompt context:

- `supabase/functions/analyze-gaps/index.ts`
- `supabase/functions/identify-risks-opportunities/index.ts`
- `supabase/functions/generate-outline/index.ts`
- `supabase/functions/generate-win-themes/index.ts`
- `supabase/functions/draft-section/index.ts`

Add a small shared helper `supabase/functions/_shared/teaming.ts` to fetch + serialize the roster.

### Out of scope (can be follow-ups)

- Cross-solicitation partner library (re-using partners across bids without re-typing)
- Auto-generated Subcontracting Plan / Small Business Participation document
- E-signature workflow for TAs
- Reminders when agreements expire

## Rollout

1. Migration for the two tables + RLS + triggers (one approval step).
2. Frontend tab + CRUD.
3. Wire roster into the 5 edge functions and add the staleness banner.
