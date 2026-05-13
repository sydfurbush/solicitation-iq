# Revision Notification & Comparison — Gap Fixes + Help Doc

Four gaps to close, plus a new Help tab in **Settings** that documents the step-by-step flow.

---

## Phase 1 — Auto-watch & in-app notifications

**Goal:** When SAM posts an amendment to a watched solicitation, we detect it, import it, create the revision, and notify the team — without anyone clicking "Pull from SAM".

### DB
- New table `solicitation_watches` (`solicitation_id`, `user_id`, `notify_email`, `notify_in_app`, `created_at`). Auto-subscribe the creator + anyone who has opened the solicitation.
- New table `notifications` (`id`, `user_id`, `kind`, `title`, `body`, `link`, `solicitation_id`, `revision_id`, `read_at`, `created_at`). RLS: user sees own only.
- New table `sam_poll_state` (`solicitation_id`, `last_checked_at`, `last_known_resource_hash`, `last_modified_at`).

### Edge functions
- `sam-watch-poll` (scheduled via `pg_cron` every 30 min): for each watched solicitation, call SAM, hash the attachment manifest + `modifiedDate`. If changed, invoke existing `sam-import-attachments` (which already creates the Amendment revision) and then fan out `notifications` rows to watchers.
- `notify-revision-created` (DB trigger → `pg_net`): backstop so manually-added revisions also notify.

### UI
- Bell icon in `RootLayout` topbar → `NotificationCenter` popover (reuse the portal `NotificationCenter.tsx` pattern). Realtime via `notifications` channel.
- "Watch" toggle on `SolicitationDetail` header.

---

## Phase 2 — Unified Revision Inbox

**Goal:** One place to triage every new revision across all solicitations.

- New page `/revisions` (sidebar entry "Revision Inbox") listing revisions where `received_at > last_seen_at` for the current user.
- Columns: Solicitation • Revision label • Source (SAM/manual) • Received • Docs added/modified/removed • [Compare] [Mark reviewed].
- Filters: unreviewed, source, last 7/30 days, client.
- "Compare" deep-links into `/solicitations/:id/comparison?a=<prev>&b=<new>`.

---

## Phase 3 — Read / reviewed state

**Goal:** Visually flag what's new since you last looked.

### DB
- `revision_reviews` (`revision_id`, `user_id`, `reviewed_at`).
- `document_reviews` (`document_id`, `user_id`, `reviewed_at`, `reviewed_revision_id`).

### UI
- "New since your last visit" banner on solicitation detail when unreviewed revisions exist.
- Dot/badge on revision cards in `RevisionTimeline`.
- "Mark revision reviewed" button in `RevisionComparisonPanel`.
- Per-document "Reviewed" checkmark in `DocumentMatchPanel`; auto-mark when user opens `DocumentDiffModal` and scrolls through.

---

## Phase 4 — Propagate revision impact into RTM / Outline / Writing Queue

**Goal:** Translate "what changed in the document" into "what changed in our proposal work".

### DB
- `revision_impacts` (`id`, `revision_id`, `kind` enum: `requirement_added|requirement_modified|requirement_removed|outline_section_affected|assignment_affected`, `entity_id`, `summary`, `severity` enum, `acknowledged_at`, `acknowledged_by`).
- Add `source_revision_id` to `requirement_items`, `proposal_outline_sections`, `writing_assignments` (track when entities were created/last touched by which revision).

### Edge function
- `analyze-revision-impact` (triggered after `sam-import-attachments` finishes a new amendment): 
  1. Re-runs `extract-requirements` on changed sections only.
  2. Diffs new requirement set vs. existing → emits `requirement_added/modified/removed` impact rows.
  3. Maps changed sections → affected outline sections (via `source_section_ref`) → emits `outline_section_affected`.
  4. Maps affected outline sections → `writing_assignments` → emits `assignment_affected`.
  5. Severity heuristic: removed/added requirement = high; wording-only edit = medium; whitespace = low.

### UI
- New "Impact" tab inside `RevisionComparisonPanel` showing impact rows grouped by kind, with [Open in RTM] / [Open in Outline] / [Open assignment] / [Acknowledge] actions.
- Badges on RTM rows ("Changed in Amendment 0002"), outline cards, and writing-queue cards when `source_revision_id` matches an unacknowledged impact.
- Toast/notification when impact analysis completes: "Amendment 0002 affects 6 requirements, 3 outline sections, 2 assignments."

---

## Help Doc — Settings → Help tab

Add a new `Help` tab to `src/pages/Settings.tsx` (between Notifications and Integrations). Implementation:

- New folder `src/features/settings/help/` with one component per article using existing `HelpSection`/`HelpSteps`/`HelpCallout`/`HelpBullets` primitives from `src/features/solicitations/help/primitives.tsx`.
- First article: **"Handling a revision notification"** with these steps:
  1. You get notified (bell icon, email, or Revision Inbox).
  2. Open the solicitation → review the "New since your last visit" banner.
  3. Go to the **Comparison** tab → the new revision is preselected as B, predecessor as A.
  4. Switch between **Incremental** (vs. previous) and **Cumulative** (vs. original) modes.
  5. Use Side-by-side / Stacked / Inline + "Only changes" filter; press `j`/`k` to jump.
  6. Open the **Impact** tab to see affected requirements, outline sections, and assignments.
  7. Acknowledge each impact, update RTM/outline/queue as needed.
  8. Mark the revision **Reviewed**; export a Change Report (PDF/Word) for the team.
- Sidebar list of articles (left) + article body (right), so we can grow the library later (e.g., "Adding a manual revision", "Wiring SAM auto-watch").

---

## Technical notes

- Reuse existing `RevisionTimeline`, `RevisionComparisonPanel`, `DocumentDiffModal`, `changeReport.ts`.
- Notifications use Supabase Realtime on `public.notifications`.
- `pg_cron` job uses the documented `net.http_post` pattern (insert tool, not migration, so remixers don't inherit our keys).
- All new tables get RLS scoped via `current_user_org()` / `auth.uid()`.
- No changes to `client.ts` / `types.ts` — types regenerate after migration.

---

## Build order

1. Help tab + "Handling a revision notification" article (immediate user value, no backend).
2. Phase 3 (read state) — small, unlocks UX wins.
3. Phase 1 (watch + notify + cron).
4. Phase 2 (Revision Inbox) — depends on Phase 1 data.
5. Phase 4 (impact propagation) — heaviest, last.

Reply **"build all"** to execute in this order, or name the phases you want first.