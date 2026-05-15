
## Your findings — my read

Your analysis is correct, and the pattern matches how the prompt is currently structured. Two root causes:

**1. The model is rewarded for volume, not synthesis.**
The system prompt literally says *"Be thorough. It is far better to surface a borderline question than to omit a real one. Generate as many questions as the documents in this batch warrant."* That's why you get 9 Section 508 questions, 9 SCA questions, 8 PII questions — each section that mentions the topic triggers its own question, and nothing tells the model to consolidate.

**2. Each chunk runs in isolation.**
The doc is sliced into batches of ~50K chars and each batch is a separate LLM call. The model in batch 3 has no idea batch 1 already asked about Section 508. The cross-doc pass only looks for contradictions between docs, not for **intra-package topic duplication**.

That's the structural reason for the 9/9/8 clustering you flagged. The 6 "remove entirely" items (Q1, Q7, Q12, Q57, Q73, Q78) are a different failure: the model is generating questions whose answer is **visible in the same quote it cites**, or treating boilerplate / checkbox representations / standard FAR language as ambiguity.

## Proposed prompt + pipeline changes

### A. Rewrite the SYSTEM_PROMPT (single-batch pass)

Replace the "be exhaustive, borderline OK" framing with a **synthesis-first** framing. Concretely add:

- **Self-answer check (kills Q1, Q78):** *"Before emitting a question, re-read your own source_quote. If the quote answers the question — even partially — DO NOT emit it. A question is only valid if the cited text leaves a material ambiguity a contracting officer would have to resolve."*
- **Boilerplate filter (kills Q73, and the checkbox case Q57/Q78):** *"Do NOT question standard FAR/DFARS boilerplate, representation checkboxes, reservation-of-rights language, or clauses that appear in a 'check all that apply' representations list. These are not ambiguities."*
- **Citation accuracy (kills Q12):** *"When citing a Class Deviation, FAR clause, or DFARS clause, the cited reference MUST address the topic of your question. Do not cite a deviation that governs a different program (e.g., Canadian Commercial Corporation) as evidence of a general provision."*
- **Topic-cap rule (attacks the 9/9/8 clustering):** *"Maximum 2 questions per topic per document. Topics include: Section 508 accessibility, SCA wage determinations, Privacy Act / PII safeguards, cybersecurity (NIST 800-171/CMMC), small-business subcontracting, key personnel, OCI, and security clearances. If a topic surfaces in multiple sections, CONSOLIDATE into one synthesis question that lists every section reference in source_quote, instead of one question per section."*
- **Hard duplicate rule (kills Q7):** *"Do not emit two questions whose normalized text is the same or whose source_quote overlaps by >50%. Pick the strongest framing and drop the rest."*

### B. Add a new third pass: **synthesis / dedupe pass**

Today the pipeline is: per-batch passes → cross-doc contradiction pass → done. Add a final pass that receives **all draft questions from all batches** (just question_text + category + topic tag + source) and is told:

> *"You are a senior capture manager doing a final review before submission to the agency. Remove duplicates and near-duplicates. Where 3+ questions cover the same topic, merge into one consolidated question. Remove any question whose own cited quote already answers it. Remove questions about boilerplate or standard reservation-of-rights language. Return the deduped, consolidated list."*

This is the structural fix for "the team didn't synthesize." It runs **once per run**, sees the full picture, and is the only place a topic-cap can actually be enforced (because a single batch can't see other batches).

### C. Add a `topic_tag` field to the schema

Add an optional `topic_tag` enum to SCHEMA so the synthesis pass can group reliably without relying on fuzzy text match. Suggested values: `section_508`, `sca_wages`, `pii_privacy`, `cybersecurity`, `small_business`, `key_personnel`, `oci`, `clearances`, `pricing`, `delivery`, `evaluation`, `other`. The per-batch model assigns it; the synthesis pass groups on it and applies the topic cap.

### D. Tweak the cross-doc prompt

Add the same "if your own quote answers the question, drop it" rule, and explicitly: *"A clause appearing in a representations checkbox list is not in conflict with the same clause appearing as an active requirement elsewhere — that is the standard solicitation structure."* (This is the Q57 failure mode.)

## What this does NOT change

- No DB schema migration required (topic_tag lives on the AI response, then gets folded into existing fields or dropped — we can add a column later if you want to filter by topic in the UI).
- No change to chunking, retries, or model selection. `draft-section` is on Gemini 2.5 Pro per the previous change; `generate-questions` stays on its current model unless you want to switch it too.
- The existing client-side **Cleanup** button (malformed + exact dupes) stays — the new synthesis pass attacks the *near-duplicate / over-clustered* problem the cleanup button intentionally leaves alone.

## Expected impact on your 104

- Removes ~6 self-answered / wrong-citation / boilerplate questions (Q1, Q7, Q12, Q57, Q73, Q78) at generation time.
- Collapses the 9 Section 508 + 9 SCA + 8 PII clusters into ~2 each → roughly **−20 questions**.
- Net: a 104-question run should land closer to **65–75 sharper questions**, with the strong ones no longer buried.

## Files to change

- `supabase/functions/generate-questions/index.ts` — rewrite `SYSTEM_PROMPT` and `CROSS_DOC_SYSTEM_PROMPT`, add `topic_tag` to `SCHEMA`, add a new synthesis chunk kind that runs after the cross-doc pass and replaces the staged questions with the deduped set.

Want me to proceed with all four changes (A + B + C + D), or start with just A + D (prompt-only, no pipeline change) as a lower-risk first step?
