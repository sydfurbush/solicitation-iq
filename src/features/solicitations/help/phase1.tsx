import { HelpSection, HelpSteps, HelpCallout, HelpBullets } from "./primitives";

export const phase1Doc = {
  title: "Phase 1 · Initial",
  summary:
    "Stand up the opportunity, ingest documents, run AI analysis, draft strategic questions, and capture early risks and opportunities.",
  Body: () => (
    <div className="space-y-6">
      <HelpSection title="Purpose">
        <p>
          Phase 1 turns a raw solicitation into a structured, analyzable opportunity.
          You confirm scope, ingest the source documents, get an AI overview, then
          generate the questions and risk register that feed every later phase.
        </p>
      </HelpSection>

      <HelpSection title="How it works">
        <p>
          Five sub-steps are surfaced as tabs across the top: Overview, Documents,
          Analysis, Questions, and Risks &amp; Opportunities. They are designed to
          be done in order but each can be revisited.
        </p>
      </HelpSection>

      <HelpSection title="Step-by-step">
        <HelpSteps
          items={[
            {
              title: "Overview",
              body:
                "Review the SAM.gov metadata, confirm the client, due date, and status. Set the proposal due date so countdowns activate.",
            },
            {
              title: "Documents",
              body:
                "Upload or pull attachments from SAM.gov. Each document is parsed and chunked so AI tools can read it. Wait for processing to finish before running Analysis.",
            },
            {
              title: "Analysis",
              body:
                "Run the AI analyzer to generate a plain-English summary, key dates, scope, evaluation criteria, and a high-level recommendation.",
            },
            {
              title: "Questions",
              body:
                "Generate strategic questions for the client. Edit, prioritize, and assign categories. This is the core deliverable the client responds to.",
            },
            {
              title: "Risks & Opportunities",
              body:
                "Capture risks (compliance, schedule, technical) and opportunities (discriminators, partnerships) flagged during analysis or review.",
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="Outcome">
        <HelpBullets
          items={[
            "Validated opportunity with a parsed document set.",
            "AI-generated summary and evaluation overview.",
            "Curated strategic question set ready for client.",
            "Initial risk and opportunity register.",
          ]}
        />
      </HelpSection>

      <HelpSection title="Why it matters">
        <p>
          Phase 2's RTM, Phase 3's outline, and Phase 4's win themes all rely on
          the documents and questions captured here. Skipping or rushing Phase 1
          weakens every downstream artifact.
        </p>
      </HelpSection>

      <HelpSection title="Client participation">
        <HelpCallout tone="client" title="Client touchpoint">
          The client answers the strategic questionnaire generated in this phase.
          Share the Client Strategic Questionnaire report from the Reports
          workspace — their responses drive the gap analysis in Phase 2 and the
          win themes in Phase 4.
        </HelpCallout>
      </HelpSection>

      <HelpSection title="Tips">
        <HelpBullets
          items={[
            "Run Documents → Analysis before Questions for the richest AI output.",
            "Tag risks with severity early — they roll up into the no-bid trigger in Phase 2.",
            "Use Annotations to leave context for teammates on tricky sections.",
          ]}
        />
      </HelpSection>
    </div>
  ),
};
