# Auto-Derive Format Profile from Solicitation

Section L of nearly every federal RFP dictates document format (font, size, margins, line spacing, page limits per volume, file naming, pagination). Today these are configured manually in `buyer_format_profiles`. We'll add an AI extractor that drafts a profile from the solicitation, surface those rules on the Phase 3 outline as visible guidance, and let the existing Phase 5 compile step enforce them.

## Three connected pieces

### 1. Derive (new)
A new edge function reads Section L from the solicitation's processed documents and proposes a complete format profile with per-field citations. User reviews, edits, and saves — creating a new `buyer_format_profiles` row and setting `solicitations.format_profile_id`.

### 2. Reference on the outline (new)
The active profile becomes visible context on the Phase 3 outline so writers see the rules they're working against:
- A "Format Profile" panel at the top of the outline (font, size, margins, line spacing, page-number format, file-name pattern, per-volume page limits)
- Each volume header shows its page budget (e.g. *Volume I — Technical · 50 pages*) from `volume_page_limits`
- A per-section pill comparing the AI's `page_allocation` against the volume budget, flagging overruns
- Each derived field links to the L-clause snippet it came from
- The outline generator receives `volume_page_limits` so per-section `page_allocation` values **sum to the limit per volume** (today they're an independent AI guess)

### 3. Apply at compile (already works)
`compile-proposal` already reads `buyer_format_profiles` and applies font, size, margins, line spacing, page-number footer, file-name pattern, and enforces `volume_page_limits` in pre-flight. Once a derived profile is saved, **compile picks it up automatically** — no additional wiring.

## Flow

```text
[Solicitation docs]
        │
        ▼
extract-format-profile (new edge function)
  • Loads Section L chunks (same source as generate-outline)
  • Calls Lovable AI (google/gemini-2.5-flash) with strict JSON schema
  • Returns { profile, citations, confidence, unresolved[] }
        │
        ▼
[Review modal] → save → buyer_format_profiles row
                       solicitations.format_profile_id = new id
        │
        ├──► [Phase 3 outline] reads profile, renders panel + volume budgets
        │        • generate-outline now receives volume_page_limits and
        │          allocates pages within them
        │
        └──► [Phase 5 compile] applies typography + enforces page limits
```

## User experience

1. Phase 3 outline header gains a **"Derive format from solicitation"** button (also surfaced on the Format Profiles tab).
2. Clicking runs the extractor and opens a review modal: each field side-by-side with the L-clause snippet, low-confidence fields flagged, unresolved fields fall back to org default / `DEFAULT_PROFILE`.
3. User edits as needed → Save creates a profile named *"Auto — {solicitation number}"* and links it to the solicitation.
4. Outline immediately shows the Format Profile panel and per-volume page budgets. Re-running outline generation will respect those budgets.
5. At Phase 5, the existing compile button produces a DOCX in the derived format with pre-flight page-limit checks.

## Technical changes

**New edge function** — `supabase/functions/extract-format-profile/index.ts`
- Input: `{ solicitationId }`
- Loads Section L from `document_sections` (filtered by Section-L tags), same path `generate-outline` uses
- Strict JSON schema matching `buyer_format_profiles` columns + `citations` object keyed by field name
- Read-only: returns the proposal; the UI controls the save

**Outline generator update** — `supabase/functions/generate-outline/index.ts`
- Look up `format_profile_id` for the solicitation; pass `volume_page_limits` into the prompt
- Add a post-process step: if a volume's section `page_allocation` values exceed its limit, scale proportionally; if under, leave headroom
- Log per-volume totals vs limits

**Frontend**
- `src/features/formatProfiles/hooks/useDeriveFormatProfile.ts` — calls the new function, returns proposal + citations
- `src/features/formatProfiles/components/DeriveFormatDialog.tsx` — review/edit modal with citation tooltips
- `src/features/outline/components/FormatProfilePanel.tsx` — read-only summary panel at top of outline
- Update `SolicitationOutline.tsx` to render the panel and per-volume page-budget headers + per-section overrun pills
- Add the Derive button to `FormatProfilesTab.tsx` and the outline header

**No schema changes** — `buyer_format_profiles` already has every field needed; `solicitations.format_profile_id` already exists.

## Out of scope

- Auto-running extraction on document upload (kept user-initiated so they review before it drives compilation).
- Learning format rules from past proposals — Section L only for now.
- Auto-detecting format-related amendments after extraction (handled by re-running the extractor).
