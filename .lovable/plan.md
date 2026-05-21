# Fix "Cannot read properties of undefined (reading 'rest')" when creating Final Solicitation

## Problem

Clicking **Create & open** in the "Create next-stage solicitation" dialog snapshots the Pre-Solicitation successfully, then fails with a red toast: *"Cannot read properties of undefined (reading 'rest')"*. The new Final solicitation is never created.

## Root cause

`src/features/solicitations/hooks/useFinalFromPreSol.ts` detaches `supabase.rpc` from the client before calling it:

```ts
const rpc = supabase.rpc as unknown as (fn, args) => Promise<...>;
const { data: newId, error } = await rpc("clone_solicitation_for_stage", {...});
```

`supabase.rpc` is a method that relies on its `this` binding to reach the internal PostgREST client (`this.rest`). Calling it as a standalone function (`rpc(...)`) leaves `this` undefined, so the very first line inside the method throws on `this.rest`. The RPC request never reaches the network — confirmed by the absence of any `/rest/v1/rpc/clone_solicitation_for_stage` request in the network log (only the preceding snapshot `INSERT` succeeds).

## Fix

Call `supabase.rpc(...)` directly so `this` stays bound. Drop the manual cast and rely on the generated types. If the typed `Database` doesn't yet include `clone_solicitation_for_stage`, narrow with a single local cast on the args object rather than reassigning the method.

Change in `src/features/solicitations/hooks/useFinalFromPreSol.ts`:

```ts
const { data: newId, error } = await supabase.rpc(
  "clone_solicitation_for_stage" as never,
  {
    p_source_id: input.sourceSolicitationId,
    p_new_stage: input.newStage,
    p_stage_label: input.stageLabel ?? null,
    p_new_title: input.newTitle ?? null,
  } as never,
);
if (error) throw new Error(error.message);
if (!newId) throw new Error("Clone failed");
```

No other files need to change. RLS / RPC / snapshot logic are all correct — the only bug is the detached method call.

## Verify

1. Open a Pre-Solicitation, click **Add Final Solicitation**, keep snapshot checked, click **Create & open**.
2. Expect: success toast, navigation to the new Final solicitation, and a `POST /rest/v1/rpc/clone_solicitation_for_stage` request returning 200 in the network log.
3. The original Pre-Sol now shows a snapshot in its history and a child Final solicitation linked via `parent_solicitation_id`.
