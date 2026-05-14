# Team Assignments (Option B) + Help Documentation

Implement **Option B: assigned-only access with admin override**, plus a Help Center article that explains the new organization → client → solicitation team structure to your consultants.

## Access model

Each solicitation has a named **Lead** and **Analyst** (both full admin on that solicitation and its client record), with optional **Contributors**. Each client has a default Lead and Analyst that auto-populate new solicitations under it.

Visibility:
- **Lead, Analyst, Contributor** assigned to a solicitation → see + work on it.
- **Org Owner / Admin** → always see everything (override, never locked out).
- **Org Analyst not assigned** → does not see that solicitation or its child data (documents, analyses, reports, questions, risks, etc.).
- Client record visibility = union of "I'm assigned to this client" or "I'm assigned to any solicitation under it" or "I'm an Org Admin".

Lead and Analyst share identical permissions; the labels are for accountability and reporting.

## Database changes

1. New table `client_assignments(client_id, user_id, role, assigned_by, assigned_at)` with role enum `lead | analyst`. Unique on (client_id, role).
2. New table `solicitation_assignments(solicitation_id, user_id, role, assigned_by, assigned_at)` with role enum `lead | analyst | contributor`. Unique on (solicitation_id, role) for lead/analyst; contributor unique on (solicitation_id, user_id).
3. Security definer helpers:
   - `is_solicitation_member(uid, sol_id)` — true if assigned in any role, OR Org Admin/Owner of the sol's org.
   - `is_client_member(uid, client_id)` — true if assigned to client, OR assigned to any sol under it, OR Org Admin/Owner.
   - `is_solicitation_admin(uid, sol_id)` — true if Lead, Analyst, Org Admin, or Org Owner.
4. Trigger on `solicitations` insert: copy that client's default Lead and Analyst into `solicitation_assignments`.
5. Replace existing org-wide RLS on these tables with `is_solicitation_member` (or `is_client_member` for client-scoped tables): `solicitations`, `documents`, `document_sections`, `extracted_entities`, `annotations`, `capability_gaps`, `opportunities`, `delta_runs`, `delta_actions`, `executive_reports`, `outline_nodes`, `proposal_outlines`, `activity_log`, `export_history`, plus risks/win_themes/strategic_questions/section_analyses/requirement_items/writing_queue. Clients table uses `is_client_member`.
6. Backfill: every existing solicitation gets the org Owner as Lead and Analyst so nothing disappears the moment Option B turns on.
7. Keep client-portal policies (`current_client_id`) untouched — clients still see their own data.

## UI changes

### Settings → Team
Keep current invite + members list. Add per-member workload chips:
- # clients led, # solicitations as Lead, # as Analyst, # as Contributor.

### Client detail page
New "Team" card (Org Admin only edits): pick default Lead and Analyst from org members. Show a member list of everyone with access via solicitation assignments.

### Solicitation detail + create dialog
Add "Assigned team" section: Lead, Analyst, Contributors with avatar chips and a "Reassign" button (Lead or Org Admin). Create dialog pre-fills from the client defaults; Lead can override before saving. Every assignment change writes to `activity_log`.

### Dashboard
Three views:
- **My work** (default) — solicitations where I'm Lead or Analyst, sorted by next due date.
- **Watching** — solicitations where I'm a Contributor.
- **All (admin)** — only visible to Org Admin/Owner.
KPI tiles scope to "My work": active solicitations, phase gates awaiting me, overdue items.

### Empty / unassigned states
If a non-admin user opens a solicitation URL they aren't assigned to, show a friendly "You don't have access — request from {Lead name}" page with a one-click request that notifies the Lead.

## Help documentation

Add a new Help Center article: **"How team access works"**. Wire it into `src/features/settings/components/HelpTab.tsx` alongside the existing articles, and add an FAQ entry in `src/pages/Help.tsx`.

The article covers:
1. **The hierarchy** — Organization → Members → Clients → Solicitations, with a small ASCII diagram.
2. **Roles inside the org** — Owner, Admin, Analyst, Viewer (org-level), and what each can do.
3. **Roles on a solicitation** — Lead, Analyst, Contributor, plus Admin override. A table of permissions (view, edit, approve phase gates, manage team, delete).
4. **How assignments flow** — Default Lead/Analyst on the client cascade to new solicitations; per-solicitation overrides win.
5. **Who sees what** — Plain-English version of the visibility rules above. Examples: "Sarah is Lead on RFP-12 → she sees everything for it. Marcus is not assigned → he can't see it unless he's an Org Admin."
6. **Day-to-day workflows**:
   - Starting a new client: set Lead + Analyst on the client record first.
   - Starting a new solicitation: confirm or override Lead/Analyst, add Contributors for SMEs.
   - Handing off: change the Lead; the previous Lead stays as Analyst or is removed.
   - Out-of-office coverage: temporarily add the covering consultant as Contributor (or Org Admin escalates).
7. **Recommended team patterns for a 5-consultant firm**:
   - **Pair pattern (recommended):** every solicitation has a Lead + a different Analyst — built-in peer review.
   - **Pod pattern:** group clients into 2 pods of 2–3 consultants; rotate Lead/Analyst within the pod.
   - **Specialist pattern:** assign Lead by domain (e.g., federal vs state, IT vs construction) and Analyst by capacity.
8. **Notifications** — what triggers email/in-app: assignment, reassignment, phase gate awaiting Lead, mention.
9. **FAQ** — "I can't see a solicitation", "How do I get access", "Can two people both be Lead", "What happens when someone leaves the org" (Org Admin reassigns; their assignments don't auto-delete).

## Rollout

1. Ship schema + assignment tables + backfill (Owner = Lead + Analyst on every existing solicitation/client). RLS still org-wide at this step — nothing breaks.
2. Ship Team / Client / Solicitation assignment UI + Dashboard views + Help article.
3. Internal sweep: assign correct Lead/Analyst on every active client and solicitation.
4. Flip RLS to Option B. Org Admin override remains as the safety net.

## Open questions

1. Should **Contributors** ship in v1, or start with Lead + Analyst only and add Contributor later?
2. Required field on client creation, or allow unassigned clients (then required at first solicitation)?
3. Should the current Lead be allowed to reassign themselves, or must Org Admin do it?
4. Notification channel preference — email, in-app, or both — for assignment events?
