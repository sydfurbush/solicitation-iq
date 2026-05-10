# Fix inflated Documents count (22 vs 11)

## Root cause

`src/features/solicitations/hooks/useSolicitations.ts` builds the stat tiles (Documents, Questions, Risks, Opportunities) by embedding child rows and using `.length`:

```ts
.select(`*, documents(id), strategic_questions(id), risks(id), opportunities(id)`)
...
documents_count: r.documents?.length ?? 0,
```

The embedded selects do not filter out soft-deleted rows. For this solicitation the `documents` table has 22 rows: 11 active and 11 with `deleted_at` set (failed earlier upload attempts). The Documents tab uses `useDocuments`, which already filters `deleted_at IS NULL`, so it correctly shows 11 — but the header tile shows 22.

## Fix

In both `useSolicitationsList` and `useSolicitation` queries:

1. Add embedded filters so soft-deleted children are excluded from the counts:
   - `.is("documents.deleted_at", null)`
   - `.is("strategic_questions.deleted_at", null)` (only if the column exists on that table — verify; otherwise skip)
   - `.is("risks.deleted_at", null)` (same caveat)
   - `.is("opportunities.deleted_at", null)` (same caveat)

2. Keep the embed shape the same (`documents(id)` etc.) so `.length` math is unchanged — PostgREST applies the `.is(...)` as an embedded filter, not on the parent row.

3. No UI/component changes needed; tiles will immediately reflect active rows only.

## Verification

- Reload `/solicitations/0d2c19f3-...` → Documents tile should show 11.
- Confirm Questions tile (currently 11) still matches the Questions tab list.
- Spot-check a solicitation with no deleted children to ensure counts are unchanged.

## Out of scope

- No backend/edge function changes.
- No schema changes; soft-deleted rows remain in the table for restore/history.
