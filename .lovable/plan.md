## AI Models Settings editor (expand existing)

The editor already exists at **Settings → AI Models** and writes to `ai_model_settings`. It works — but its function list and model catalog are stale. This expands it without changing the data model.

### Changes (single file: `src/features/settings/components/AIModelsTab.tsx`)

1. **Expand the function list** to cover every AI function in `aiClient.ts` (currently 9 → 21), grouped for readability:
   - **Assistant**: `solicitation-assistant` (the AI Assistant chat), `generate-assistant-starters`
   - **Analysis**: `analyze-solicitation`, `analyze-sections`, `analyze-gaps`, `identify-risks-opportunities`, `suggest-risk-mitigation`, `compare-solicitations`
   - **Extraction**: `extract-entities`, `extract-requirements`, `extract-capabilities`, `reconcile-solicitation-overview`
   - **Questions & Reports**: `generate-questions`, `draft-clarification-request`, `generate-report`
   - **Proposal**: `generate-outline`, `generate-win-themes`, `draft-section`, `polish-section`, `generate-preset`

2. **Refresh the model catalog** so the Model dropdown matches the current Lovable AI catalog:
   - Lovable: gemini-2.5-pro / flash / flash-lite, gemini-3-flash-preview, gemini-3.1-flash-lite-preview, gemini-3.1-pro-preview, gemini-3.5-flash, gpt-5 / mini / nano, gpt-5.2, gpt-5.4 / mini / pro, gpt-5.5 / pro
   - Anthropic: claude-sonnet-4-5, opus-4-5, haiku-4-5

3. **Group rows** under section headings (Assistant / Analysis / Extraction / Questions & Reports / Proposal) so the long list stays scannable.

4. **Bump `defaultMax` per function** to match the hardcoded defaults in `aiClient.ts` (e.g., `analyze-solicitation` 8192 → 16000, `generate-questions` 8192 → 32000, `generate-report` 16384 → 32000). The "dirty" check already compares against the hardcoded default, so this also fixes spurious "Save" enablement.

5. **Raise the Max-tokens input cap** from 32000 → 200000 (current models support far larger windows).

6. **Add a "Reset to default" link per row** that restores provider/model/maxTokens to the hardcoded `MODEL_CONFIG` value (deletes the override row).

### Out of scope
- No schema changes — `ai_model_settings` already has all columns needed.
- No edge function changes — `aiClient.ts` already reads overrides with a 60s cache.
- No new RLS — existing 7 policies on `ai_model_settings` already gate by org admin.