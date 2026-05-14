import { HelpSection, HelpSteps, HelpCallout, HelpBullets } from "./primitives";

export const phase5Doc = {
  title: "Phase 5 · Drafting & Submission",
  summary:
    "Draft each section against the outline and themes, run pink/red/gold reviews, compile the proposal, and produce a submission-ready package.",
  Body: () => (
    <div className="space-y-6">
      <HelpSection title="Purpose">
        <p>
          Phase 5 turns the approved outline and win themes into the actual
          proposal the client submits. Writers draft against requirements and
          themes, reviewers run color teams, the compiler assembles every
          volume, and a packager produces the final submission bundle.
        </p>
      </HelpSection>

      <HelpSection title="How it works">
        <p>
          Each outline node becomes a draftable section with the linked Section
          L/M references, requirements, and themes always visible. AI assists
          with first drafts and targeted polish; the Client Knowledge Library
          is queried inline for citations. The compliance matrix updates live
          as drafts evolve.
        </p>
      </HelpSection>

      <HelpSection title="Step-by-step">
        <HelpSteps
          items={[
            {
              title: "Draft sections",
              body:
                "Open a section in the drafting workspace. Click AI Draft for a first pass, then refine using Tighten / Expand / Rewrite to Theme.",
            },
            {
              title: "Review (pink → red → gold)",
              body:
                "Move sections through color-team reviews. Comments are inline and threaded. The reviewer dashboard lists everything awaiting you.",
            },
            {
              title: "Compliance check",
              body:
                "Confirm every shall has a written response in the live compliance matrix. Export to Word/Excel for the deliverable matrix.",
            },
            {
              title: "Compile",
              body:
                "Run the compiler. It assembles all final sections, front matter, back matter, and applies the chosen buyer format profile (Federal or Utility default).",
            },
            {
              title: "Pre-flight & package",
              body:
                "Pre-flight checks page limits, formatting compliance, requirement coverage, comment resolution. When all pass, package to a single submission .zip.",
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="Outcome">
        <HelpBullets
          items={[
            "Drafted, reviewed sections at 'final' status across every volume.",
            "Compliance matrix proving 100% requirement coverage.",
            "Compiled .docx per volume + combined .pdf, formatted to the buyer profile.",
            "Submission .zip with file naming, redline/clean copies, and transmittal letter.",
          ]}
        />
      </HelpSection>

      <HelpSection title="Why it matters">
        <p>
          A great Phase 1–4 means nothing if Phase 5 ships an out-of-compliance
          or sloppy package. This phase is the deliverable.
        </p>
      </HelpSection>

      <HelpSection title="Client participation">
        <HelpCallout tone="client" title="Client touchpoint">
          The client owns gold-team review and final sign-off. They must
          approve the compiled package before submission packaging is unlocked.
        </HelpCallout>
      </HelpSection>

      <HelpSection title="Tips">
        <HelpBullets
          items={[
            "Resolve every comment before promoting a section to final.",
            "Use the buyer format profile early — page limits drive how aggressively to tighten.",
            "Re-run the compliance matrix after every major edit; do not wait until pre-flight.",
          ]}
        />
      </HelpSection>
    </div>
  ),
};
