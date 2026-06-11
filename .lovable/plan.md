## Goal

The Phase 3 reference card (opened from the BookOpen icon next to "Phase 3 · Outline") currently only documents the Outline sub-step. Phase 3 now spans six sub-steps: **Outline → Exhibits → Win Themes → Draft → Compliance → Compile**. Update the card so it documents the whole phase, incorporating the previously-separate Phase 4 (Win Themes) and Phase 5 (Drafting & Submission) content.

## File touched

- `src/features/solicitations/help/phase3.tsx` — rewrite content
- `src/features/solicitations/help/phase4.tsx` — delete (now orphaned)
- `src/features/solicitations/help/phase5.tsx` — delete (now orphaned)

No changes to `PhaseHelpPanel.tsx` (it already only references `phase3Doc`), no route, type, or workflow changes.

## New phase3.tsx structure

**Title:** `Phase 3 · Proposal Development`
**Summary:** "Build the proposal end-to-end — outline, exhibits, win themes, drafting, compliance, and final compile — aligned to Section L and the RTM."

**Sections:**

1. **Purpose** — Phase 3 turns Phase 1/2 intelligence into the submitted proposal: skeleton, strategy, drafts, compliance proof, and final compiled package.

2. **How it works** — Six sequenced sub-steps share the same RTM, Section L/M references, and Client Knowledge Library. Each sub-step has its own workspace; advancement is gated by approvals.

3. **Step-by-step** (HelpSteps, 6 items):
   - **Outline** — Generate hierarchical outline from Section L + RTM with page-count guidance; edit, reorder, assign owners.
   - **Exhibits** — Identify and stage required exhibits (resumes, past performance, certifications, attachments) per section.
   - **Win Themes** — Generate 3–5 validated themes with discriminators, proof points, and competitor ghosting; map each theme to outline sections (from old Phase 4).
   - **Draft** — Writers draft each section with AI assist (Draft / Tighten / Expand / Rewrite to Theme); inline citations from the Knowledge Library; run pink/red/gold reviews (from old Phase 5).
   - **Compliance** — Live compliance matrix confirms every "shall" has a response; export to Word/Excel.
   - **Compile** — Assemble all volumes, front/back matter, apply buyer format profile, run pre-flight, and package the submission .zip.

4. **Outcome** (HelpBullets):
   - Compliance-aligned outline + exhibit plan ready for writers.
   - 3–5 validated win themes mapped section-by-section.
   - Drafted, reviewed sections at "final" across every volume.
   - 100% requirement coverage in the compliance matrix.
   - Compiled .docx per volume + combined .pdf in the buyer format.
   - Submission .zip with naming, redline/clean copies, transmittal letter.

5. **Why it matters** — A great Phase 1/2 means nothing if Phase 3 ships out-of-compliance or off-message. This phase is the deliverable.

6. **Client participation** (HelpCallout, tone="client") — Client approves the outline + page allocations, validates every win theme discriminator/proof point, owns gold-team review, and signs off the compiled package before submission is unlocked.

7. **Tips** (HelpBullets):
   - Lock the outline before kicking off writers — late structural changes are expensive.
   - Limit to 3–5 win themes; pair every discriminator with a proof point.
   - Resolve every comment before promoting a section to final.
   - Re-run the compliance matrix after every major edit; do not wait until pre-flight.
   - Apply the buyer format profile early — page limits drive how aggressively to tighten.

## Cleanup

Delete `phase4.tsx` and `phase5.tsx` — no remaining imports.

## Out of scope

No changes to sub-step keys, `PhaseHub`, workflow UI, approvals, or any business logic.
