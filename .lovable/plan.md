## Problem

The "+5 more in Analysis →" link points to `/solicitations/:id/analysis`, but that route does not exist. `SolicitationDetail` uses a `<Tabs>` component with an `analysis` tab value (uncontrolled `defaultValue="overview"`), so deep-linking via path 404s.

## Fix

Two small UI-only edits:

1. **`src/pages/SolicitationDetail.tsx`** — make Tabs URL-aware so other places can deep-link:
   - Read `?tab=` from `useSearchParams`.
   - Control `<Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>`.
   - Default to `"overview"` when no param present.

2. **`src/features/solicitations/components/SolicitationOverview.tsx`** — fix the "+N more" link:
   - Replace the `<a href="/solicitations/${s.id}/analysis">` with a `<Link to={`/solicitations/${s.id}?tab=analysis`}>` from `react-router-dom`.

No backend, no new routes.