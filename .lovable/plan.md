## Problem

On the Solicitation Overview page, the **Key requirements** card renders each requirement as `r.title ?? JSON.stringify(r)`. The actual analysis schema (`AnalysisRequirement`) has no `title` field — it uses `text`, `priority`, `category`, `id`, `source`, `compliance_status`. So users see ugly raw JSON dumps for every row.

The Evaluation factors card next to it has the same risk (uses `f.name`, which does exist, so it mostly works, but no description/weight formatting consistency).

## Fix (UI only, in `src/features/solicitations/components/SolicitationOverview.tsx`)

Update the **Key requirements** list (lines ~681–700) to render the real shape:

- Use `r.text` as the main line (fallback to `r.title` for legacy rows, then `Requirement {i+1}`).
- Show a small priority `Badge` (critical/high/medium/low) using the same color mapping as `KeyRequirementsCard` (destructive / amber / primary / muted).
- Show a tiny capitalized category chip when present.
- Optional source citation as muted footnote (`source.section` / `source.page`) when available.
- Cap the visible list at the first 5 items with a "+N more" muted line linking to the Analysis tab (route already exists at `/solicitations/:id/analysis`), so the overview stays compact.
- Keep the empty state copy unchanged.

No data-model, hook, or backend changes. No edits to `KeyRequirementsCard` (full view stays as-is on the Analysis tab).

## Out of scope

- Evaluation factors card (renders fine today; can revisit if you want matching styling).
- Inline editing of requirements from the overview.