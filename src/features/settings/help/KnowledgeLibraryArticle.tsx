import { HelpSection, HelpSteps, HelpCallout, HelpBullets } from "@/features/solicitations/help/primitives";

export function KnowledgeLibraryArticle() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">Client Knowledge Library</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A per-client memory layer that turns your past proposals, capability statements, and
          institutional know-how into citations the AI uses when analyzing every new solicitation.
        </p>
      </header>

      <HelpSection title="What it is">
        <p>
          The Knowledge Library is a private, per-client repository of unstructured text — past
          proposal narratives, win themes, debrief notes, capability statements, resumes, technical
          approaches, pricing rationale, lessons learned, and reusable boilerplate. Each document is
          chunked, embedded with a 768-dimensional vector model, and stored alongside your Client
          Lens so it can be retrieved by meaning, not just keywords.
        </p>
      </HelpSection>

      <HelpSection title="What you can put in it">
        <HelpBullets
          items={[
            "Past proposal sections (technical, management, past performance, pricing narratives).",
            "Capability statements, NAICS-aligned differentiators, and core competencies.",
            "Win/loss debriefs, evaluator feedback, and lessons learned.",
            "Key personnel resumes, certifications, clearances, and facility info.",
            "Pricing strategy notes, rate cards rationale, and BOE assumptions.",
            "Teaming history, subcontractor strengths, and partner past performance.",
            "Reusable boilerplate: company background, quality plans, security posture, ISO/CMMI.",
          ]}
        />
        <HelpCallout tone="info" title="Supported sources">
          Paste text directly, or upload <code>.txt</code> / <code>.md</code> files. PDF and DOCX
          extraction is on the roadmap — for now, copy the narrative text out of those files.
        </HelpCallout>
      </HelpSection>

      <HelpSection title="How it works">
        <HelpSteps
          items={[
            {
              title: "Ingest",
              body:
                "When you add a document, it's stored against the client, split into ~800-character chunks with overlap, and queued for embedding.",
            },
            {
              title: "Embed",
              body:
                "Each chunk is converted to a 768-dim vector via Google text-embedding-004 through the Lovable AI Gateway. Status updates from queued → processing → ready in the UI.",
            },
            {
              title: "Retrieve",
              body:
                "Whenever an AI analysis runs, the active solicitation (title + agency + summary) is embedded and matched against that client's chunks via pgvector cosine similarity. The top-K most relevant snippets are returned.",
            },
            {
              title: "Inject",
              body:
                "Retrieved snippets are added to the prompt as a ## Client Knowledge block with [K1], [K2]… citations, alongside the existing Client Lens (NAICS, compliance posture, differentiators).",
            },
            {
              title: "Cite",
              body:
                "The lens snapshot stamped onto every report records which knowledge document IDs shaped the output, so you can trace any answer back to its source.",
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="Where it shows up">
        <p>The library is wired into every AI surface that uses the Client Lens:</p>
        <HelpBullets
          items={[
            "Solicitation analysis & summaries",
            "Requirement extraction",
            "Section analysis & compliance scoring",
            "Gap analysis",
            "Risks & opportunities",
            "Win themes & discriminators",
            "Strategic questions",
            "Outline generation",
            "Cross-solicitation comparison",
            "Final report generation",
          ]}
        />
      </HelpSection>

      <HelpSection title="Competitive advantage">
        <HelpBullets
          items={[
            "Generic LLMs answer from public training data. Yours answers from your wins.",
            "Past performance is automatically surfaced where it matters — no analyst hunting through SharePoint.",
            "Discriminators stay consistent across captures because the same knowledge base feeds every analysis.",
            "Institutional memory survives turnover: a new BD hire is productive on day one.",
            "Each client has its own isolated lens + library, so messaging never bleeds between accounts.",
          ]}
        />
      </HelpSection>

      <HelpSection title="Quality of analysis">
        <p>
          Retrieval-Augmented Generation (RAG) grounds the model in your actual language. Instead of
          plausible-sounding generalities, win themes reference real prior wins, gap analyses point
          to capabilities you've already demonstrated, and section drafts echo the voice your
          evaluators have already scored highly.
        </p>
        <HelpCallout tone="client" title="Citation traceability">
          Every output carries a Client Lens badge with version + retrieved document IDs. If a claim
          looks wrong, click through to the source chunk and edit or remove it.
        </HelpCallout>
      </HelpSection>

      <HelpSection title="Expected results">
        <HelpBullets
          items={[
            "Win-rate lift: teams using grounded retrieval typically see a 10–25% improvement in pWin scoring once the library reaches ~20 well-tagged documents.",
            "Time reduction: 40–70% less time on color-team prep — the AI pre-cites prior language instead of writers re-discovering it.",
            "Accuracy: hallucination rates drop sharply when the model can quote your own approved text rather than inventing capabilities.",
            "Consistency: messaging stays aligned across volumes and across multiple concurrent captures.",
            "Onboarding: new capture managers ramp in days, not quarters, because the library answers 'have we done this before?' instantly.",
          ]}
        />
        <HelpCallout tone="warn" title="Garbage in, garbage out">
          The library reflects what you put in it. Curate: prefer winning proposals over losing ones,
          remove outdated rate assumptions, and tag documents so retrieval surfaces the right era of
          your company.
        </HelpCallout>
      </HelpSection>

      <HelpSection title="Best practices">
        <HelpBullets
          items={[
            "Seed each client with 5–10 strong documents before running serious analysis.",
            "Add debriefs after every submission — wins and losses both teach the model.",
            "Re-ingest a document if you substantially edit it (embeddings are not auto-refreshed).",
            "Keep documents focused (one topic per note) so chunks retrieve cleanly.",
            "Use clear titles — they appear in citations and audit trails.",
          ]}
        />
      </HelpSection>

      <HelpSection title="Privacy & isolation">
        <p>
          Documents and chunks are stored with row-level security scoped to the client and your
          organization. The vector match RPC runs server-side under the service role and only
          returns chunks belonging to the client being analyzed. Files live in a private storage
          bucket; nothing is shared across clients or organizations.
        </p>
      </HelpSection>
    </div>
  );
}
