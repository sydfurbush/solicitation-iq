# AGENTS.md — Working rules for BidSense AI

These rules apply to every agent and person changing this codebase: the Lovable agent, Claude, and human developers. Read this file before making changes. If a rule here conflicts with a one-off request, ask before breaking it.

## The project

BidSense AI (repo `solicitation-iq`) helps consulting firms analyze RFPs, RFIs and RFQs and produce strategic reports and client deliverables.

- **Lovable project:** BidSense AI, ID `2e90255b-0daf-42f1-8522-298fa8ab3375`, workspace "Sydney's Lovable"
- **Repo:** https://github.com/sydfurbush/solicitation-iq (branch `main` syncs both ways with Lovable)
- **Live app:** https://solicitation-iq.lovable.app
- **Owner:** Sydney Furbush. Only the owner publishes, manages secrets, and changes GitHub or Lovable settings.

**Stack:** Vite + React + TypeScript, Tailwind + shadcn/ui, TanStack Query, React Hook Form + Zod, Zustand. Backend is Supabase (Postgres with row-level security, storage, and Deno edge functions in `supabase/functions/`).

## Who builds what

Work is split between Lovable and the repo. Each side does what it is best at.

**Send to Lovable** (as a prompt in the Lovable editor or through the Lovable connector):
- Screens, components, routes, layout, copy and styling
- Wiring server functions and hooks into screens
- Anything that must be checked in the preview
- Applying database changes (tables, columns, policies, SQL migrations). Lovable applies migrations and regenerates `src/integrations/supabase/types.ts`
- Secrets, publishing, and route regeneration

**Write in the repo** (on a branch, then merged to `main`):
- Server logic and validation as pure functions with tests
- Edge function logic in `supabase/functions/`, including calls to outside services (AI providers, SAM.gov, ElevenLabs)
- Security rules: caller checks in edge functions, and drafts of row-level security policies for Lovable to apply
- Bug fixes in server code
- Rules files such as this one

## Workflow for a feature

1. **Branch.** In the repo, create `claude/<topic>` (or `<name>/<topic>` for people). Never work directly on `main`.
2. **Build the logic.** Write the pure module, its tests, and the edge function that uses it.
3. **Check.** Run the type check, then the tests, as separate commands so a failure stops you:
   ```sh
   npx tsc --noEmit -p tsconfig.app.json
   npm test
   ```
   Do not chain these with `;`. Use `&&` or run them one at a time.
4. **Merge.** Merge to `main` with `git merge --no-ff`, then push. `main` must always build, because every commit on it syncs into the Lovable editor.
5. **Prompt Lovable.** Send ONE prompt per feature that says what the user sees, the exact wording, the name of the new server function or hook, that the build and tests must pass, that any new rule goes into this file, and for new pages, the final URL.
6. **Review.** Afterward, pull `main`, run the checks again, read Lovable's diff, and fix anything that is off.

## Git rules

- Never rewrite pushed history: no force push, rebase, amend or squash of commits that are already on GitHub.
- Keep commits focused, with messages that say what changed and why.
- Lovable commits to `main` directly. Pull before starting work, and again before merging.

## Secrets

- Secrets live only in the Lovable / Supabase secrets settings, never in the repo, in prompts, or in logs.
- Secrets currently in use: `ANTHROPIC_API_KEY`, `LOVABLE_API_KEY`, `ELEVENLABS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (provided automatically by Supabase).
- `.env` holds only the Supabase URL, project ID and the public anon ("publishable") key. Those are safe to be public. Nothing else may be added to `.env`.
- Secret changes reach the live site only after the owner publishes.

## Data access and security

### Who can see what

- Every user belongs to one organization (`current_user_org()`).
- Staff roles (`app_role`): `owner`, `admin`, `analyst`, `viewer`. Check with `has_role()` and `is_org_staff()`.
- Client portal users are outside the firm. They see only items linked to their client (`is_client_user()`, `current_client_id()`).
- Solicitation-level access uses `is_solicitation_member()`.

### Database rules

- Every new table must have row-level security enabled in the same migration that creates it, with policies scoped by organization (and by client for portal-visible data). All 75 existing tables follow this; keep it that way.
- Grant pattern for new tables: `SELECT/INSERT/UPDATE/DELETE` to `authenticated`, `ALL` to `service_role`. The policies do the real scoping.
- Never give `anon` access to firm or client data.
- Migrations live in two places. The original 83 are in `supabase/migrations/`. Since October 2026 Lovable writes new ones to `drizzle/migrations/` (with `drizzle.config.ts` and `drizzle/schema.ts`). Never edit or move an applied migration; to change something, add a new migration through Lovable.
- When checking the live database, use read-only `SELECT` queries. Never write to the live database unless the owner asks.

### Edge function rules

The service-role key bypasses all row-level security, so any function that uses it is responsible for its own access checks.

1. **Verify the caller first.** Read the `Authorization` header, create a Supabase client with it, and call `auth.getUser()`. Reject with 401 if there is no valid user.
2. **Confirm access to the requested record using the caller's own client** (so row-level security applies). For example, select the solicitation or outline node by ID with the user client. If it is not returned, reject with 403 or 404.
3. **Only then** use the service-role client, and only for the work that needs it.
4. Never trust IDs, organization IDs or roles sent in the request body. Derive them from the verified user.
5. Functions that are public on purpose (for example, accepting an invitation by token) must say so in a comment at the top and validate their token strictly.
6. Rate-limit or otherwise protect anything that spends money (AI calls, transcription, SAM.gov imports).

### Other security rules

- The browser never handles service keys or third-party API keys.
- Nothing is sent to other people (invitations, emails, client-portal shares) without an explicit confirm step in the UI.
- Allowed sign-in redirect URLs and public routes are security settings. When a new domain or public page is added, update the allowlist and add a test.
- When testing, use throwaway data. Never send real invitations or messages to other people.

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

## Testing

- Tests use Vitest (`npm test`), with jsdom and Testing Library. Test files are `*.test.ts(x)` under `src/` and `*.test.ts` under `supabase/functions/_shared/`.
- Put logic in pure functions (no network, no Supabase client, no Deno globals) so it can be tested directly. Good homes: `src/lib/`, `src/lib/validators/`, and `utils/` folders inside features.
- Edge functions use Deno and remote imports, which Vitest cannot load. Put their testable logic in plain TypeScript modules in `supabase/functions/_shared/` with no imports from URLs, `npm:` or Deno globals, and import those from the function (with the `.ts` extension, as Deno requires). `requirementLinks.ts` is the model to follow.
- Every bug fix in server code gets a test that would have caught it.
- Coverage today is low (the requirement-linking module is the only tested server logic). Add tests for the code you touch; do not leave a file you changed less tested than you found it.

## TypeScript

- The project compiles with `strict: false`. Do not turn strict mode on project-wide without the owner agreeing; it would produce a large number of errors.
- New pure modules should still be written as if strict: explicit types, no `any`, null checks.

## Packages

- Lovable installs packages with Bun (`bun.lockb`). `package-lock.json` is out of date, so `npm ci` fails; use `npm install` locally if needed.
- If installing a package is blocked, add it to `package.json` by hand and let Lovable install it.

## Working with the owner

- Give plain-language, step-by-step instructions with the exact names to click or type.
- Agents do the code, merges, prompts and checks without asking. The owner does: publishing, secrets, payments, domains and DNS, connecting accounts, approving permissions, and anything in GitHub, Lovable, Supabase, Google or Microsoft settings.
- When something fails in a settings page, ask for the exact error text or a screenshot, look for the cause in the code first, and fix what is on the code side before asking the owner to change anything.

## Known issues

- **Edge functions without caller checks.** Most functions in `supabase/functions/` use the service-role key but do not verify the caller (see "Edge function rules"). The public anon key is enough to call them, so anyone who has a record ID could read or change that record's data through these functions or run up AI costs. `assistant-transcribe` has no check at all. Fixing these, one function at a time with tests, is the top priority.
- **Existing drafts have no citation tags.** Drafts written before October 2026 contain no `[Req-X]` tags, so they show as "Pending" or "Drafted, not cited" until redrafted or tagged by hand.
- **Lockfile drift.** `package-lock.json` does not match `package.json` (see "Packages").
