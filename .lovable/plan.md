## Why the SAM.gov attachment isn't being included

When you linked the prior via the **External reference** tab, all the app saved was the string `W9124D26RA001` (and optionally a URL) into `prior_solicitations.external_reference`. There is **no code path that fetches SAM.gov for an external reference, creates a shadow solicitation, or imports the attachment**.

Today only two ingestion paths exist, and neither runs from the "Link prior" dialog:
- `sam-import` edge function — looks up a SAM notice and returns prefill metadata + `resourceLinks` (only used by Create Solicitation).
- `sam-import-attachments` edge function + `useSamPullAttachments` hook — downloads attachments into `documents` rows (only available on the Documents tab of an existing solicitation, via the "Pull attachments from SAM.gov" button).

So the comparison run sees an empty PRIOR side (just the reference string), the AI has nothing to diff against, and the requirement-changes list is essentially fabricated from the current solicitation alone. This is the same root cause behind the "very few requirement changes" issue.

## Recommendation

Make the External reference path actually ingest the prior so comparisons have real content to diff.

### Plan

1. **Auto-create a shadow prior solicitation when linking by SAM URL/number.**
   In `LinkPriorSolicitationDialog → handleLink (external tab)`:
   - If the entered reference looks like a SAM URL (or the URL field is filled), call the existing `sam-import` function to fetch notice metadata + `resourceLinks`.
   - Create a new `solicitations` row (same `client_id`, status `archived`/`prior`, tag `prior`, prefilled with returned metadata, `sam_url` set).
   - Insert the `prior_solicitations` link with `prior_solicitation_id` set to that new row (instead of leaving it null), and also keep `external_reference` for traceability.
   - Immediately call `sam-import-attachments` with the returned `resourceLinks`, scoped to the new shadow solicitation, so its documents get pulled.
   - Wait for documents to finish processing (poll `documents.status` until `parsed`/`analyzed`) before kicking off `compare-solicitations`. Show progress in the dialog ("Importing 3 attachments… Parsing… Comparing…").

2. **Resolve numeric SAM references too.**
   If the user only enters a solicitation number like `W9124D26RA001` with no URL, hit `sam-import` with a constructed search (or use the existing search endpoint of SAM API) to find the matching `noticeId` and proceed as above. If nothing matches, fall back to today's behaviour and show a clear "No SAM notice found — comparison will be limited" message.

3. **Comparison-tab banner for legacy/external-only links.**
   In `ComparisonOverview`, when `prior_solicitation_id IS NULL`, render an alert: "Prior is referenced but not imported — comparison results are limited. Import prior documents." with a one-click "Import from SAM" button that runs steps 1–2 retroactively for the existing link.

4. **Repair the existing row for `0d2c19f3-…` (the Army TAP solicitation).**
   - Trigger the new import flow against `W9124D26RA001` so the prior gets a shadow solicitation with attachments.
   - Re-run `compare-solicitations` against the now-populated prior. Requirement changes should jump significantly.

5. **Out of scope for this change** (acknowledged but tracked separately):
   - The `compare-solicitations` sampling cap (60 sections, 1800 chars). Even with prior content loaded, a 742-section solicitation will still be undersampled. We should follow up with per-document quotas, requirement-priority sampling, and a dedicated requirements-only second pass.

### Files that would change
- `src/features/comparison/components/LinkPriorSolicitationDialog.tsx` — orchestrate fetch → create shadow → import attachments → poll → compare.
- `src/features/comparison/hooks/usePriorSolicitation.ts` — extend `useLinkPriorSolicitation` to accept a `priorSolicitationId` produced server-side.
- `src/features/comparison/components/ComparisonOverview.tsx` — add the "external-only" warning + "Import from SAM" CTA.
- (Optional) New helper hook `useImportPriorFromSam(currentSolicitationId)` to keep the orchestration testable.

### What I'd do first
Just step 1+4 (auto-import on the external tab, then re-run for your current solicitation). That alone should resolve the immediate "missing requirement changes" complaint. Banner + sampling improvements can follow.

Approve and I'll implement.
