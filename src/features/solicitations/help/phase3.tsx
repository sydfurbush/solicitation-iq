import { HelpSection, HelpSteps, HelpCallout, HelpBullets } from "./primitives";

export const phase3Doc = {
  title: "Phase 3 · Proposal Development",
  summary:
    "Build the proposal end-to-end — outline, exhibits, win themes, drafting, compliance, and final compile — aligned to Section L and the RTM.",
  Body: () => (
    <div className="space-y-6">
      <HelpSection title="Purpose">
        <p>
          Phase 3 turns Phase 1 and Phase 2 intelligence into the submitted
          proposal: the skeleton, the strategy, the drafts, the compliance
          proof, and the final compiled package.
        </p>
      </HelpSection>

      <HelpSection title="How it works">
        <p>
          Six sequenced sub-steps share the same RTM, Section L/M references,
          and Client Knowledge Library. Each sub-step has its own workspace,
          and advancement is gated by approvals so nothing ships out of order.
        </p>
      </HelpSection>

      <HelpSection title="Step-by-step">
        <HelpSteps
          items={[
            {
              title: "Outline",
              body:
                "Generate a hierarchical outline from Section L and the RTM with page-count guidance. Edit, reorder, merge or split sections, and assign owners. Required content from Section L should never be removed without justification.",
            },
            {
              title: "Exhibits",
              body:
                "Identify and stage every required exhibit — resumes, past performance, certifications, letters of commitment, attachments — and link each to the section that consumes it.",
            },
            {
              title: "Win Themes",
              body:
                "Generate 3–5 validated win themes with discriminators, proof points, and competitor ghosting language. Validate with the client and map each theme to the outline sections where it should appear.",
            },
            {
              title: "Draft",
              body:
                "Writers draft each section with AI assist (Draft / Tighten / Expand / Rewrite to Theme). Knowledge Library citations are inline. Move sections through pink → red → gold reviews; comments are inline and threaded.",
            },
            {
              title: "Compliance",
              body:
                "The live compliance matrix confirms every shall has a written response. Export to Word/Excel for the deliverable matrix and re-run after every major edit.",
            },
            {
              title: "Compile",
              body:
                "Assemble all volumes, front matter, and back matter, apply the chosen buyer format profile (Federal or Utility default), run pre-flight checks (page limits, formatting, requirement coverage, comment resolution), and package the submission .zip.",
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="Outcome">
        <HelpBullets
          items={[
            "Compliance-aligned outline and exhibit plan ready for writers.",
            "3–5 validated win themes mapped section-by-section.",
            "Drafted, reviewed sections at 'final' status across every volume.",
            "Compliance matrix proving 100% requirement coverage.",
            "Compiled .docx per volume plus combined .pdf in the buyer format.",
            "Submission .zip with file naming, redline/clean copies, and transmittal letter.",
          ]}
        />
      </HelpSection>

      <HelpSection title="Why it matters">
        <p>
          A great Phase 1 and Phase 2 means nothing if Phase 3 ships an
          out-of-compliance or off-message package. This phase is the
          deliverable — evaluators score on themes and compliance, not effort.
        </p>
      </HelpSection>

      <HelpSection title="Client participation">
        <HelpCallout tone="client" title="Client touchpoints">
          The client approves the outline structure, page allocations, and
          writer assignments; validates every win-theme discriminator and
          proof point line by line; owns gold-team review; and signs off the
          compiled package before submission packaging is unlocked.
        </HelpCallout>
      </HelpSection>

      <HelpSection title="Tips">
        <HelpBullets
          items={[
            "Lock the outline before kicking off writers — late structural changes are expensive.",
            "Limit to 3–5 win themes and pair every discriminator with a proof point. Never claim a discriminator in a gap area.",
            "Resolve every comment before promoting a section to final.",
            "Re-run the compliance matrix after every major edit; do not wait until pre-flight.",
            "Apply the buyer format profile early — page limits drive how aggressively to tighten.",
          ]}
        />
      </HelpSection>
    </div>
  ),
};
