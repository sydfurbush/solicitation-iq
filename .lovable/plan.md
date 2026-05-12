## Fix

The "cannot add `postgres_changes` callbacks ... after `subscribe()`" error happens because the realtime channel is named with only the solicitation id (`phase-approvals-${id}`). In React StrictMode (dev) and on remounts, the Supabase client reuses the existing channel of the same topic, so the second mount calls `.on()` on a channel that has already been subscribed.

**Change:** in `src/features/phases/hooks/usePhaseApprovals.ts`, give each effect run a unique channel topic (append a random suffix), and keep the existing cleanup that calls `removeChannel`. No behavior changes — invalidation on phase_approvals updates still works.

No other files need changes.