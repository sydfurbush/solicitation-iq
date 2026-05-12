## Goal

Switch every Phase 1 and Phase 2 AI call to **Lovable AI / Gemini** and right-size `max_tokens` per function so we stop hitting the truncation failure ("AI did not return structured tool call") that broke the two PDFs.

## Phase → function map

**Phase 1 (Initial)**
- `process-document` — no AI call (text extraction only)
- `extract-entities` — currently Anthropic Haiku 4096 ⟵ this is what's failing today
- `analyze-solicitation` — currently Anthropic Sonnet 8192
- `generate-questions` — already Gemini 2.5 Pro 32000 (keep)
- `identify-risks-opportunities` — currently Anthropic Sonnet 8192

**Phase 2 (Deep Dive)**
- `extract-requirements` — already Gemini 2.5 Flash 16000 (re-tune)
- `analyze-sections` — currently Anthropic Sonnet 8192
- `analyze-gaps` — currently Anthropic Sonnet 4096

## Token sizing — how we arrive at the numbers

Each function builds a structured tool call. Output token need ≈ rows × ~80–120 tokens per row (entity / requirement / section finding) + JSON overhead. Inputs are already truncated server-side (sizes shown below). Recommendations leave 30–50% headroom over observed worst case so a 16-page RFQ + 7-page PWS finishes cleanly.

| Function | Input cap (existing) | Typical output | Recommended `maxTokens` | Model |
|---|---|---|---|---|
| `extract-entities` | 60k chars (~15k tok) | up to ~150 entities × ~100 tok | **16000** | `google/gemini-2.5-flash` |
| `analyze-solicitation` | 40 sections × 4k chars | summary + scoring + ~30 items | **16000** | `google/gemini-2.5-pro` |
| `identify-risks-opportunities` | 30 sections × 3k chars/doc | ~30–60 risk/opp items | **12000** | `google/gemini-2.5-pro` |
| `generate-questions` | full sections | ~50–100 questions | **32000** (keep) | `google/gemini-2.5-pro` |
| `extract-requirements` | 180k chars | hundreds of "shall" rows | **24000** (raise from 16000) | `google/gemini-2.5-pro` |
| `analyze-sections` | 30 sections × 1.5k chars | per-section findings | **16000** | `google/gemini-2.5-pro` |
| `analyze-gaps` | 250 reqs × 280 chars | gap list per capability | **12000** (raise from 4096) | `google/gemini-2.5-pro` |

**Rationale for model choice:** Gemini 2.5 Pro has a 1M-token input window and ~65k output cap, handles structured tool calls reliably, and is what `generate-questions` already uses successfully on this project. Use Flash only for `extract-entities` because the task is mechanical (named-entity tagging) and Flash is materially cheaper for the high-volume case.

## Changes

1. **`supabase/functions/_shared/aiClient.ts`** — update `MODEL_CONFIG` for the 6 affected functions (provider → `lovable`, model → Gemini, raise `maxTokens` per the table above). Keep `generate-questions` as-is.
2. **No edge-function code changes required** — `callAiTool` already routes by provider and `callLovable` already logs `finish_reason` so we can spot future truncation in logs.
3. **`extract-entities/index.ts` (small hardening)** — when the Lovable path returns `finish_reason === "length"`, retry once with the `text.slice` cut in half before throwing, so an oversized document still produces partial entities instead of a hard failure. Optional but cheap.
4. **Re-run the 2 failed documents** via the existing per-card "Process" / bulk "Process all" flow once deployed.

## Verification

- After deploy, click "Process all" on this solicitation. Expect both failed PDFs to land at `status = analyzed` with rows in `extracted_entities`.
- In edge function logs, confirm `finish=stop` (not `finish=length`) for `extract-entities` and `extract-requirements` runs.
- `[aiClient] lovable` log lines will show `completion_tokens` — if any function uses >70% of its `maxTokens`, bump that one another step.

## Out of scope

- No DB schema changes.
- No UI changes (the per-card Retry button discussed earlier is a separate plan).
- Phases 3 and 4 (`generate-outline`, `generate-win-themes`, `generate-report`, `compare-solicitations`) are unchanged.