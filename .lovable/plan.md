## Problem

When the user clicks "AI Draft" on a node like **1.0 Volume I – General Volume**, the AI returns a long blob that:
- Repeats/owns headings that belong to OTHER outline nodes (e.g. it writes its own "1.1 Corporate Overview and Relevant Experience" even though the actual outline node 1.1 is "SF 1449 Solicitation/Contract/Order Form").
- Drafts content that should live in sibling/child nodes, so when the user later drafts those nodes the proposal will have duplicated and conflicting sections.
- Doesn't respect node depth: a Volume-level node (depth 0) gets a full multi-section narrative instead of just a short volume introduction.

Root cause: `supabase/functions/draft-section/index.ts` sends the AI only the single node's title + linked requirements + themes. It never tells the AI what the surrounding outline looks like or what content boundary this node owns. So the model invents its own subsection structure.

## Fix (scoped to drafting only)

Update `supabase/functions/draft-section/index.ts` to make each draft strictly own only its node's slice of the proposal.

1. **Load the full outline context for the node**:
   - Fetch all sibling nodes (same `parent_id`, same `outline_id`) and all direct child nodes (`parent_id = node.id`) — section_number + title + volume only.
   - Fetch the parent node (if any) for context.

2. **Pass an "outline boundary" block to the AI** in the user prompt:
   ```
   THIS NODE: 1.0 Volume I – General Volume   (depth: volume)
   PARENT: (none)
   SIBLINGS (do NOT write their content):
     - 2.0 Volume II – Technical Proposal
     - 3.0 Volume III – Price
   CHILDREN (each will be drafted separately — do NOT write their content):
     - 1.1 SF 1449 Solicitation/Contract/Order Form
     - 1.2 Amendments Acknowledgment
     - 1.3 Representations and Certifications
   ```

3. **Tighten the system prompt** with explicit boundary rules:
   - "Draft ONLY the body content for THIS node. Do not output the node's own title as a heading — the app renders that."
   - "Do NOT write any heading or content that belongs to a sibling or child node listed in the prompt. If a child node exists, stop where that child would begin."
   - Depth-aware guidance:
     - Volume-level node (no parent, has children) → write a short 1–3 paragraph volume introduction only. No subsections.
     - Section-level node with children → write a brief section intro only.
     - Leaf node (no children) → write the full body content for that section.
   - "Use H3/H4 only for sub-points inside this node's own body. Never reuse the node's section number in a heading."

4. **No schema or DB changes.** No frontend changes. No changes to outline generation, requirements, themes, or polish.

## Files to touch

- `supabase/functions/draft-section/index.ts` — load siblings/children/parent, build outline-boundary block, update SYSTEM_PROMPT.

## Out of scope

- Outline structure or generation
- Polish actions (tighten/expand/etc.)
- Phase 5 compile
- Any UI changes to the drafting workspace

## How to verify

1. Open Phase 5 on the same solicitation.
2. Click "AI Draft" on **1.0 Volume I – General Volume** → should return a short 1–3 paragraph volume introduction only, no "1.1 …" heading inside it.
3. Click "AI Draft" on **1.1 SF 1449 Solicitation/Contract/Order Form** → should return content scoped to that form, not "Corporate Overview".
4. Click "AI Draft" on a leaf like **2.4.1 Client Reception and Intake** → full body content, no headings for siblings.