# Plan — Writing Queue (proposal kickoff view)

Turns the Phase 3 outline into an actionable, prioritized checklist so writers know exactly where to start, what's due, and what compliance + theme targets each section must hit.

## What gets built

### 1. New tab on Solicitation detail: "Writing Queue"
Appears once Phase 3 outline exists. Pulls from existing `outline_nodes` + `requirement_items` + `win_themes` + `section_analyses` — no new AI calls.

### 2. Per-section "writing card" showing everything a writer needs
For each leaf outline node:
- Section number, title, volume badge
- **Priority score** (computed, see below) with color chip
- Page allocation budget
- Linked RTM requirement count + expandable list (id, shall-text, status)
- Mapped win themes (from `win_themes.section_mapping` if present)
- Section L reference
- Owner / writer assignment (editable inline — writes to `outline_nodes.assigned_to`)
- Status dropdown: Not started / Drafting / Pink ready / Red ready / Final (new column on outline_nodes)
- Notes field (existing)

### 3. Three view modes (tab-bar inside the queue)
- **By priority** — flat list, highest score first (default — answers "where do I start?")
- **By owner** — grouped by assignee, shows each writer's queue
- **By volume** — grouped Vol I / II / III for kickoff briefings

### 4. Priority scoring (deterministic, transparent)
```
score = (section_weight_pct × 0.5)
      + (page_allocation × 2)
      + (linked_requirement_count × 1.5)
      + (has_critical_gap ? 10 : 0)
      + (due_soon_bonus)
```
Score and its components are visible on hover so writers understand the ranking.

### 5. Top strip: queue summary
- Total sections / assigned / in progress / complete
- Unassigned count (warning chip if > 0)
- Total pages allocated vs. proposal page limit (if known)
- "Export writing assignments (Word)" button — generates a writer-ready handoff doc per owner

## Technical details

**Schema** (one migration):
- `outline_nodes.writing_status` enum: `not_started | drafting | pink_ready | red_ready | final` (default `not_started`)
- `outline_nodes.assigned_to` uuid nullable (already exists if owner field present — verify; otherwise add)
- `outline_nodes.due_date` date nullable

**New files:**
- `src/pages/SolicitationWritingQueue.tsx` — page shell, registered as new tab in `SolicitationDetail.tsx`
- `src/features/writing-queue/components/WritingQueueCard.tsx` — per-section card
- `src/features/writing-queue/components/WritingQueueGroupedView.tsx` — owner/volume grouping
- `src/features/writing-queue/hooks/useWritingQueue.ts` — joins outline_nodes + requirement_items + win_themes + section_analyses, computes scores
- `src/features/writing-queue/lib/priority.ts` — scoring function (pure, unit-testable)
- `src/features/writing-queue/lib/exportAssignments.ts` — Word export per owner using existing exporters

**Reused:**
- Existing `useOutlineNodes`, `useRequirementItems`, `useWinThemes`, `useOrgMembers`
- Existing `ExportMenu` pattern from `SolicitationOutline.tsx`

**Out of scope (future):**
- Actual draft text storage / rich-text editor per section (this is a queue/dashboard, not a writing surface)
- Pink/Red team review workflow
- Auto-routing notifications when status changes
- Client-portal visibility of the queue

## Build order
1. Migration (writing_status, due_date, assigned_to if missing)
2. `priority.ts` + `useWritingQueue.ts`
3. `WritingQueueCard.tsx` with inline assign/status/due editing
4. Page + tab registration + grouping views
5. Export-assignments Word generator

Approve and I'll build it.
