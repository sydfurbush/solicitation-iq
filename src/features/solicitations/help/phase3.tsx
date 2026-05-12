import { HelpSection, HelpSteps, HelpCallout, HelpBullets } from "./primitives";

export const phase3Doc = {
  title: "Phase 3 · Outline",
  summary:
    "Generate the proposal outline aligned to Section L instructions and the RTM, ready for writers to populate.",
  Body: () => (
    <div className="space-y-6">
      <HelpSection title="Purpose">
        <p>
          Phase 3 produces the proposal skeleton — volumes, sections, and
          subsections — sequenced and weighted to match the solicitation's
          instructions and evaluation factors.
        </p>
      </HelpSection>

      <HelpSection title="How it works">
        <p>
          The outline generator reads Section L (or equivalent), the RTM from
          Phase 2, and the section weights to produce a structured outline.
          Edit, reorder, and assign owners before exporting.
        </p>
      </HelpSection>

      <HelpSection title="Step-by-step">
        <HelpSteps
          items={[
            {
              title: "Generate outline",
              body:
                "Run the AI generator. It returns a hierarchical outline with page-count guidance and links back to the RTM requirements each section must address.",
            },
            {
              title: "Review and edit",
              body:
                "Adjust headings, merge or split sections, and assign writers. Required content from Section L should never be removed without justification.",
            },
            {
              title: "Export",
              body:
                "Export to Word for the writing team. The outline becomes the working document that drives volume kick-offs.",
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="Outcome">
        <HelpBullets
          items={[
            "Compliance-aligned proposal outline ready for writers.",
            "Page allocations per section based on weight and L-clause guidance.",
            "Owner assignments and traceability back to RTM requirement IDs.",
          ]}
        />
      </HelpSection>

      <HelpSection title="Why it matters">
        <p>
          A solid outline shortens proposal cycle time, prevents non-compliance
          findings during pink/red team reviews, and ensures every required
          response element is accounted for before writing starts.
        </p>
      </HelpSection>

      <HelpSection title="Client participation">
        <HelpCallout tone="client" title="Client touchpoint">
          The client reviews and approves the outline structure, page
          allocations, and writer assignments. This is typically a single
          working session before writing kickoff.
        </HelpCallout>
      </HelpSection>

      <HelpSection title="Tips">
        <HelpBullets
          items={[
            "Lock the outline before kicking off writers — late structural changes are expensive.",
            "Export to PDF for client signoff and Word for the writing team.",
          ]}
        />
      </HelpSection>
    </div>
  ),
};
