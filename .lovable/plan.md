## AI-Generated Service Presets

Add a "Generate with AI" path in the Service Presets tab. The user fills a short guided form, the AI returns a complete preset with reasoning notes, and the existing create dialog opens pre-filled for review and edits before saving as v1.

---

### User flow

1. In **Settings → Service Presets**, the "New preset" button gets a split: `New preset ▾` with two options:
   - **Blank** (current behavior)
   - **Generate with AI** ✨
2. "Generate with AI" opens a small dialog with the guided form (4 fields). Submit shows a streaming progress state (5–15s).
3. When generation finishes, the existing **CreateDialog** opens pre-filled with every field. A subtle banner reads *"AI-generated draft — review before saving."*
4. Each AI-populated section (codes, agencies, vehicles, compliance, discriminators, flags, glossary) shows a small `i` icon → hovering reveals the AI's reasoning for that section.
5. User edits anything, then clicks **Create** — saved as a normal custom preset v1 (uses the existing `useCreatePreset` hook, no new write path).

---

### Guided input form (4 fields)

| Field | Type | Example |
|---|---|---|
| Service category | Text | "Federal Cybersecurity Services" |
| Family | Federal / Utility | Federal |
| Primary buyers | Text (1 line) | "DoD, DHS CISA, civilian CIOs" |
| Differentiators / context (optional) | Textarea | "FedRAMP High, CMMC L3, cleared workforce" |

Family steers the prompt toward the right vocabulary (NAICS vs. utility regulatory bodies, etc.).

---

### Generation contract

The edge function returns a strict JSON object matching `PresetContent` plus a `reasoning` map:

```text
{
  label, description, family,
  content: {
    naics_codes[], psc_codes[], set_asides[], agencies_focus[],
    contract_vehicles[], compliance_frameworks[],
    discriminators[{title, evidence, proof_point}],
    acronym_glossary{},
    always_flag[{rule, reason}],
    tone_voice, reading_level, keywords[]
  },
  reasoning: {
    naics_codes: "Why these codes...",
    agencies_focus: "Why these buyers...",
    compliance_frameworks: "...",
    discriminators: "...",
    always_flag: "..."
  }
}
```

Used via AI SDK `generateText` + `Output.object` for structured output (no manual JSON parsing).

---

### Grounding (few-shot)

Before calling the model, the function:
1. Loads all built-in presets matching the chosen `family` from `lens_presets` + their current versions.
2. Picks the 3 closest by simple keyword overlap between user category and `label`/`description`.
3. Includes them as compact JSON examples in the system prompt: *"Match this format exactly. Examples follow."*

This keeps NAICS/vehicle/agency naming consistent with the existing library at near-zero token cost.

---

### Technical details

**New edge function**: `supabase/functions/generate-preset/index.ts`
- Auth: standard JWT validation (admin/owner only — same gate as `lens_presets` write RLS).
- Input: Zod-validated `{ category, family, buyers, context? }`.
- Loads few-shot examples via service-role client.
- Calls Lovable AI Gateway with `openai/gpt-5` (best for niche regulatory accuracy + reasoning quality). Falls back to `google/gemini-3-flash-preview` on 429.
- Returns the structured object. Surfaces 402/429 cleanly to the UI.

**New client files**:
- `src/features/presets/hooks/useGeneratePreset.ts` — wraps `supabase.functions.invoke('generate-preset')`.
- `src/features/presets/components/AIGenerateDialog.tsx` — guided form + progress state.

**Modified files**:
- `src/features/presets/components/PresetsTab.tsx`:
  - Split-button trigger (Blank / Generate with AI).
  - Pass an `initialDraft` + `initialReasoning` prop into `CreateDialog`.
  - Render reasoning tooltips next to each populated section header.
- No DB schema changes. No new tables. Reasoning is only shown during the review step — not persisted (keeps `lens_preset_versions.content` clean).

**Reuse**: the AI flow ends by handing off to the existing `useCreatePreset` mutation, so versioning, RLS, and audit trail all behave identically to a hand-built preset.

---

### Out of scope (can add later if useful)

- Web-search grounding via sam.gov / census.gov to verify codes — adds latency + tool-loop complexity. Defer until first round of generated presets shows real hallucinations.
- Persisting reasoning into version history.
- Re-generating individual sections ("regenerate just the NAICS codes").
- Bulk "generate 5 candidates and pick one" mode.
