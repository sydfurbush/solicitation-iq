## Diagnosis

The analysis job for the current solicitation is not stuck in the backend:

- Latest job `76285236-f2a9-4035-8276-e4f8a89e4ed1` is `completed`
- It completed at `15:29:50 UTC`
- Results were saved: summary present, 10 requirements, 3 evaluation factors, confidence `0.85`
- The solicitation status is now `phase_1_complete`

The visible problem is the frontend remains on the progress screen at `persisting` instead of reliably transitioning to the completed dashboard.

## Plan

1. **Make job completion state robust**
   - Update the analysis job hook so polling/realtime completion always invalidates and refetches the solicitation insights.
   - Avoid relying only on the local `job` state timing, which can miss the final transition.

2. **Clear stale local progress state**
   - Update the analysis page so if insights already exist and the saved job is completed or missing, it clears the stored `analysis-job:<solicitationId>` key.
   - This prevents users from being trapped in an old progress UI after refresh/navigation.

3. **Show completed results immediately**
   - When the backend says the job is completed, remove the active job id and render `AnalysisDashboard` after invalidating/refetching insights.
   - If the current job row cannot be found but analysis results exist, treat it as finished instead of continuing to show progress.

4. **Optional small UI polish**
   - Adjust the progress component so the final stage does not sit indefinitely at “~0s remaining”; it can show “Finishing up” while the backend persists results.

## Files to change

- `src/features/analysis/hooks/useAnalysis.ts`
- `src/pages/SolicitationAnalysis.tsx`
- `src/features/analysis/components/AnalysisProgress.tsx` only if needed for the “Finishing up” label

## Validation

- Confirm the current completed job no longer leaves the UI stuck.
- Confirm existing saved analysis renders for solicitation `c98a2376-4947-46c0-b9ec-bcb7123f392e`.
- Confirm a new queued job still shows progress while active and transitions when completed.