# AGENTS.md — supabase/functions

Read the root AGENTS.md first. These rules apply to edge functions and shared server logic.

## Edge function rules

The service-role key bypasses all row-level security, so any function that uses it is responsible for its own access checks.

1. **Verify the caller first.** Use `requireUser(req)` from `supabase/functions/_shared/callerAuth.ts`, which rejects with 401 if there is no valid user and returns a client that acts as the caller. `triage-onboarding-document` is the reference example.
2. **Confirm access to the requested record using the caller's own client** (so row-level security applies). For example, select the solicitation or outline node by ID with the user client. If it is not returned, reject with 403 or 404.
3. **Only then** use the service-role client, and only for the work that needs it.
4. Never trust IDs, organization IDs or roles sent in the request body. Derive them from the verified user.
5. Functions that are public on purpose (for example, accepting an invitation by token) must say so in a comment at the top and validate their token strictly.
6. Rate-limit or otherwise protect anything that spends money (AI calls, transcription, SAM.gov imports).

## AI calls

- All model calls go through `supabase/functions/_shared/aiClient.ts`. Choose the provider and model per function in `MODEL_CONFIG`, not inside individual functions.
- Prompts live next to their feature (for example `src/features/analysis/prompts/`) or at the top of the edge function. Changes to prompts are product changes: describe them in the commit message.
- AI output that is written to the database must be validated (shape and required fields) before insert.

## Compliance tracking (requirements, outline, citations)

- A requirement (`requirement_items`) is "placed" when its id is in exactly one `outline_nodes.linked_requirement_ids` of the active outline. Change links only through the `assign_requirement_to_section` and `unassign_requirement` database functions, never by editing the array directly from the browser.
- Drafts cite requirements with `[Req-<req_number>]` tags, for example `[Req-C-1.2.1]`. The compliance matrix, drafting sidebar and compile check all depend on them.
- All requirement matching, citation detection and tag stripping goes through `supabase/functions/_shared/requirementLinks.ts`. Do not write new string matching for requirement numbers or tags anywhere else; import from this module (the frontend imports it by relative path).
- `generate-outline` must include every requirement in its prompt and return `unplaced_requirements`. `draft-section` must return and store `uncited_requirements`. `compile-proposal` must strip `[Req-X]` and `[K#]` tags from submission documents.
- Changes to `requirementLinks.ts` or these three functions are made in the repo with tests, not through Lovable.

