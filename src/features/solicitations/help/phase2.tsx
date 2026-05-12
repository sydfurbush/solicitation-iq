import { HelpSection, HelpSteps, HelpCallout, HelpBullets } from "./primitives";

export const phase2Doc = {
  title: "Phase 2 · Deep Dive",
  summary:
    "Extract the requirements traceability matrix, analyze each section, and identify capability gaps to inform the bid/no-bid decision.",
  Body: () => (
    <div className="space-y-6">
      <HelpSection title="Purpose">
        <p>
          Phase 2 converts the solicitation into compliance-grade artifacts:
          an enumerated requirements list (RTM), a section-by-section breakdown,
          and a gap analysis comparing requirements against the client's
          capabilities profile.
        </p>
      </HelpSection>

      <HelpSection title="How it works">
        <p>
          Three tabs run in order. Requirements (RTM) must be extracted first —
          Gaps depends on it. Section analysis can run in parallel.
        </p>
      </HelpSection>

      <HelpSection title="Step-by-step">
        <HelpSteps
          items={[
            {
              title: "Requirements (RTM)",
              body:
                "Click Extract to scan all documents for shall/must/will statements. The AI returns a numbered table with volume, section, owner, and status. Gap analysis runs automatically when extraction completes.",
            },
            {
              title: "Section analysis",
              body:
                "Generates a plain-English summary, scoring weight, and risk flags for each section (L, M, C, SOW, etc.). Use the accordion to drill in.",
            },
            {
              title: "Capability gaps",
              body:
                "Compares each requirement against the client's capabilities profile. Each gap has severity, type, and a recommendation. Resolve gaps as you address them.",
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="Outcome">
        <HelpBullets
          items={[
            "Numbered, exportable Requirements Traceability Matrix.",
            "Section-level summaries with scoring weights and risk flags.",
            "Prioritized capability gap list with recommendations.",
            "Bid/no-bid signal: unresolved critical gaps trigger the no-bid banner.",
          ]}
        />
      </HelpSection>

      <HelpSection title="Why it matters">
        <p>
          The RTM becomes the spine of the proposal outline (Phase 3) and
          compliance matrix. The gap analysis is the single best input to a
          bid/no-bid decision — addressing critical gaps before commit avoids
          wasted proposal effort.
        </p>
      </HelpSection>

      <HelpSection title="Client participation">
        <HelpCallout tone="client" title="Client touchpoint">
          The client validates the capabilities profile that feeds gap analysis,
          and reviews critical gaps to confirm partner, hire, or no-bid
          decisions. Share the gap list and any unresolved critical items
          before advancing.
        </HelpCallout>
      </HelpSection>

      <HelpSection title="Tips">
        <HelpBullets
          items={[
            "Re-run extraction after uploading new amendments to catch added requirements.",
            "Use the Filters in RTM to slice by volume or owner during compliance reviews.",
            "Export the Deep Dive bundle (RTM + Sections + Gaps) for client review meetings.",
          ]}
        />
      </HelpSection>
    </div>
  ),
};
