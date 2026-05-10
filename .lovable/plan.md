## Goal

Add an admin-only "AI Models" tab on the Settings page where owners/admins can pick the provider and model for each AI function. The 6 edge functions read these overrides at runtime, falling back to the defaults already in `MODEL_CONFIG`.

## Database

New table `ai_model_settings` (one row per function, global scope — single source of truth for the deployment):

| Column | Type | Notes |
|---|---|---|
| `function_name` | text | Primary key. One of the 6 function names. |
| `provider` | text | `'anthropic'` or `'lovable'`. |
| `model` | text | Model identifier string. |
| `max_tokens` | int | Optional override. |
| `updated_at` | timestamptz | default now() |
| `updated_by` | uuid | nullable |

RLS:
- SELECT: any authenticated org staff (`is_org_staff(auth.uid())`).
- INSERT/UPDATE: only `owner` or `admin` roles (`has_role`).
- No deletes.

Seed the 6 rows with current Claude defaults so the UI shows the live values immediately.

## Edge function changes

In `supabase/functions/_shared/aiClient.ts`:
- Add a 60-second in-memory cache of overrides per function name.
- Before each call, fetch `ai_model_settings` row for that function via service role; if found, use it; otherwise use the hardcoded `MODEL_CONFIG` default.
- Same call shape, providers, and error handling — no other behavior changes.

Result: changing a model in the UI takes effect within ~60s for all 6 functions; no redeploy needed.

## UI: Settings → "AI Models" tab

- New `TabsTrigger value="ai-models"` labeled "AI Models" in `src/pages/Settings.tsx`, visible only when current user is `owner` or `admin` (use existing role hook).
- New component `src/features/settings/components/AIModelsTab.tsx`:
  - Table with one row per function: `Function`, `Provider` (select: Anthropic / Lovable Gateway), `Model` (select with curated options per provider + free-text), `Max Tokens` (number input), `Save` (per row) + `Reset to default` link.
  - Curated model options:
    - Anthropic: `claude-sonnet-4-5`, `claude-opus-4-5`, `claude-haiku-4-5`
    - Lovable Gateway: `google/gemini-2.5-pro`, `google/gemini-2.5-flash`, `google/gemini-3-flash-preview`, `openai/gpt-5`, `openai/gpt-5-mini`, `openai/gpt-5.2`
  - Show small description of each function (analysis, risks/opps, questions, report, comparison, entity extraction).
  - On save, upsert into `ai_model_settings` and toast success.
- New hook `src/features/settings/hooks/useAiModelSettings.ts` for fetching + upserting via supabase client.

## Non-changes

- No prompts, schemas, parsing, or DB writes touched in any edge function.
- "Activities" continues to be derived from DB triggers; no AI call.
- The hardcoded `MODEL_CONFIG` map stays as the safety fallback if the DB row is missing.

## Acceptance

1. As an `owner`/`admin`, the "AI Models" tab is visible on `/settings`. As an `analyst` it is hidden.
2. Changing a model row and saving it persists to `ai_model_settings`.
3. Within ~60s, the next call to that edge function uses the new provider/model (verifiable in edge function logs).
4. Clearing/resetting a row falls back to the hardcoded default.