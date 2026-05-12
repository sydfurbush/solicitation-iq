import { HelpSection, HelpSteps, HelpCallout, HelpBullets } from "./primitives";

export const phase4Doc = {
  title: "Phase 4 · Win Themes",
  summary:
    "Develop discriminators, ghost the competition, and map win themes to each proposal section.",
  Body: () => (
    <div className="space-y-6">
      <HelpSection title="Purpose">
        <p>
          Phase 4 captures the strategy layer: the handful of messages that
          make the client's proposal differentiated, credible, and resonant
          with the evaluators.
        </p>
      </HelpSection>

      <HelpSection title="How it works">
        <p>
          The win themes generator uses the strategic questionnaire responses,
          the gap analysis, and the section analysis to propose 3–5 themes,
          each with discriminators, proof points, and ghosting language.
        </p>
      </HelpSection>

      <HelpSection title="Step-by-step">
        <HelpSteps
          items={[
            {
              title: "Generate themes",
              body:
                "Run the AI generator. Output includes theme name, customer hot button, discriminator, proof points, and competitor ghosting language.",
            },
            {
              title: "Validate with the client",
              body:
                "Confirm each theme reflects an actual capability and resonates with the client's competitive intelligence.",
            },
            {
              title: "Map to sections",
              body:
                "Tie each theme to the proposal sections where it should appear so writers know where to weave the messaging.",
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="Outcome">
        <HelpBullets
          items={[
            "3–5 validated win themes with discriminators and proof points.",
            "Ghosting language for the top 1–2 likely competitors.",
            "Section-by-section theme map for writers.",
          ]}
        />
      </HelpSection>

      <HelpSection title="Why it matters">
        <p>
          Win themes are the difference between a compliant proposal and a
          winning one. Evaluators score on themes, not features — these
          messages must appear consistently across volumes.
        </p>
      </HelpSection>

      <HelpSection title="Client participation">
        <HelpCallout tone="client" title="Client touchpoint">
          The client must validate every discriminator and proof point. Themes
          built without client buy-in tend to fall apart at red team. Schedule
          a working session to walk through the generated themes line by line.
        </HelpCallout>
      </HelpSection>

      <HelpSection title="Tips">
        <HelpBullets
          items={[
            "Limit to 3–5 themes — more dilutes the message.",
            "Pair every discriminator with a proof point. Unsupported claims hurt credibility.",
            "Re-check themes against the gap list — never claim a discriminator in a gap area.",
          ]}
        />
      </HelpSection>
    </div>
  ),
};
