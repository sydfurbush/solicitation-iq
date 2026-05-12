
# Client Approval Gates — Full & Restricted Access

Add a lightweight client-approval workflow at the end of Phases 1, 2, and 3. Both Full and Restricted clients can approve; staff cannot advance the solicitation's `current_phase` until the gate is approved (or staff explicitly override).

## Access matrix

| Area | Full | Restricted | Summary |
|---|---|---|---|
| Overview (title, dates, summary, contract) | ✓ | ✓ | ✓ |
| Reports (published + client_accessible) | ✓ | ✓ | ✓ |
| Phase approval banner + Approve/Request Changes | ✓ | ✓ | — |
| Analysis (key requirements) | ✓ | — | — |
| Strategic Questions | ✓ | — | — |
| Annotations (read + create) | ✓ | — | — |

Restricted gains the approval UI on Overview; everything else stays as today.

## Approval gates

Three gates, one per phase end:

1. **Phase 1 → Phase 2** — approves initial summary, key dates, risks
2. **Phase 2 → Phase 3** — approves RTM, section analysis, capability gaps
3. **Phase 3 → Phase 4** — approves proposal outline

Any client portal user can approve. First decision wins; can be reset by staff.

## Status model

Each gate has one of: `pending_review` · `approved` · `changes_requested` · `not_ready` (staff hasn't requested review yet).

Lifecycle:
```
not_ready  → (staff: "Request client approval")
pending_review → (client: Approve)             → approved
              → (client: Request changes + note) → changes_requested
                                                 → (staff resets) → pending_review
```

Staff `Advance Phase` button is disabled while the current phase's gate is `pending_review`, `changes_requested`, or `not_ready` (with an override toggle for owners/admins).

## UI

**Client portal (`PortalSolicitationDetail`)**
- Top action banner when a gate is `pending_review`: "Phase 2 deliverables are ready for your review" + **Approve** / **Request changes** buttons (textarea on request).
- Per-phase status strip below the title: 4 pills (Initial · Deep Dive · Outline · Win Themes), each showing badge color:
  - gray = not_ready
  - amber pulse = pending_review
  - red = changes_requested
  - green check = approved
- Overview tab: "Approvals" card listing each gate with status, approver name, timestamp, and any change-request note.

**Staff (`SolicitationDetail` / `PhaseHub`)**
- Each `PhaseCard` gets an approval row: status badge + "Request client approval" button (when `not_ready` and phase complete) or "Reopen for review" (when `changes_requested`).
- `AdvancePhaseButton` blocked with tooltip if gate not approved; admin override checkbox.
- Activity log entries on every state change.

## Technical details

**New table `phase_approvals`**
- `id`, `solicitation_id`, `phase` (phase_type enum), `status` (text: not_ready/pending_review/approved/changes_requested), `requested_at`, `requested_by` (staff uuid), `decided_at`, `decided_by` (client_user uuid), `decided_by_name` (text snapshot), `decision_note` (text), `created_at`, `updated_at`
- Unique on `(solicitation_id, phase)`
- RLS:
  - Staff in org: full ALL via `is_org_staff` + client/org join (mirror existing pattern)
  - Client users: SELECT where `solicitation_id` belongs to `current_client_id()` (regardless of access_level so Restricted can see)
  - Client users: UPDATE `status`, `decided_at`, `decided_by`, `decision_note` where same condition AND `status = 'pending_review'`
- Trigger: on UPDATE log to `activity_log`

**Hooks**
- `usePhaseApprovals(solicitationId)` — list/subscribe (realtime publication add)
- `useRequestApproval()` — staff sets `pending_review`
- `useDecideApproval()` — client approve / request changes
- `useResetApproval()` — staff move back to `pending_review`

**Gate enforcement**
- `useAdvancePhase` checks the row for `from` phase; throws if not `approved` unless `override=true` passed by admin.

**Files to add/modify**
- New migration: `phase_approvals` table + RLS + trigger + realtime
- New `src/features/phases/hooks/usePhaseApprovals.ts`
- New `src/features/phases/components/PhaseApprovalStrip.tsx` (shared by staff + portal)
- New `src/features/phases/components/ApprovalActionBanner.tsx` (portal)
- Edit `src/pages/portal/PortalSolicitationDetail.tsx` — banner + strip + Approvals card; remove the `hasFullAccess` gate around the approval UI
- Edit `src/features/solicitations/components/PhaseHub.tsx` — render approval status row + request button
- Edit `src/features/phases/components/AdvancePhaseButton.tsx` — block + override
- Edit `src/features/solicitations/hooks/usePhaseProgression.ts` — validate gate

## Out of scope (call out, not building)
- Per-report or per-question approvals
- Email/SMS notifications on gate state changes (in-app `client_notifications` row only)
- Designated-approver restriction (any client user can approve for now)
