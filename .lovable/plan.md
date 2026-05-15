## Problem

When drafting sections one at a time, `draft-section` has no awareness of what was **already written** in earlier sections of the same proposal. Each call is essentially stateless against prior drafts, so the AI re-introduces the company (Offeror Identification table, address, CAGE, DUNS, POC, etc.) in 1.0, then again in 1.1, and likely again in 2.1 Executive Summary.

The existing OUTLINE BOUNDARY block tells the model what sibling/child *titles* exist, but not what content has already been drafted into them.

## Fix

Feed the model a compact summary of **already-drafted sections that come before this one** in `sort_order`, and add explicit non-repetition rules to the system prompt.

### Changes to `supabase/functions/draft-section/index.ts`

1. After loading `allNodesArr`, fetch existing `proposal_drafts` for this outline (only nodes with `sort_order < current` and non-empty content):
   ```ts
   const priorNodeIds = allNodesArr
     .filter(n => n.sort_order < node.sort_order && n.id !== node.id)
     .map(n => n.id);
   const { data: priorDrafts } = await supabase
     .from("proposal_drafts")
     .select("outline_node_id, content_json, word_count")
     .in("outline_node_id", priorNodeIds);
   ```

2. Build a `PRIOR SECTIONS ALREADY DRAFTED` block — for each prior node with a draft, include:
   - Section number + title
   - A short summary (first ~400 chars of the markdown, or a 2-sentence trim) plus key facts already stated (company name, address, CAGE, DUNS, POC, themes already woven if available).
   - Cap total at ~3–4k chars; when over budget, keep the most recent N siblings + the parent's intro + the volume intro, and replace the rest with a short titles-only list.

3. Update `SYSTEM_PROMPT` with a new "NON-REPETITION RULES" block:
   - Do NOT restate company identification (name, address, CAGE, DUNS, POC, telephone, email, business size) once it has appeared in a prior section. Reference it as "as identified in Section X" when needed.
   - Do NOT re-introduce the offeror, the program, or the solicitation purpose if a prior section already did so.
   - Do NOT duplicate tables, certifications, or boilerplate already present in a prior section.
   - When a prior section has covered a topic, build on it — don't restart it.

4. Pass the new `PRIOR SECTIONS ALREADY DRAFTED` block into the user prompt, placed right after the OUTLINE BOUNDARY block.

### Optional UX follow-up (not required for fix)

Add a small "Drafted" indicator in the section list (already shows "8/73 drafted") tooltip listing which prior sections will be used as context — purely informational.

## Out of scope

- No DB schema changes.
- No changes to `polish-section` (it already operates on a single existing draft).
- No changes to UI flow; user keeps clicking AI Draft per section.

## Technical notes

- `proposal_drafts` is keyed by `outline_node_id` (unique), so the lookup is one query.
- Token budget: 73 sections × full content would blow context; the trimming/summary step is essential. 400 chars × ~30 prior sections ≈ 12k chars worst case — acceptable for Claude Sonnet 4.5's 200k context, but we still cap to keep cost down.
- "Bulk draft all" workflows (if added later) would benefit from this same context.