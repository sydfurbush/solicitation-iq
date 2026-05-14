import { Card, CardContent } from "@/components/ui/card";

export function ClientQuestionWorkflowArticle() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none space-y-4">
      <h2>Client question review &amp; clarification workflow</h2>
      <p>
        After your analyst generates strategic questions for a solicitation, the client reviews each one,
        decides what should reach the agency, and gets back a polished package to submit. This article walks
        through the full round-trip.
      </p>

      <Card><CardContent className="p-4">
        <pre className="text-xs whitespace-pre overflow-x-auto m-0">{`Analyst generates  ->  Client triages      ->  Client submits decisions
       |                                              |
       v                                              v
 Hold list (internal)                       Analyst drafts (AI)
                                                      |
                                                      v
                                              Analyst compiles package
                                                      |
                                                      v
                                              Client downloads + submits
                                                      |
                                                      v
                                              Agency response captured`}</pre>
      </CardContent></Card>

      <h3>Roles</h3>
      <ul>
        <li><strong>Analyst</strong> — generates questions, drafts formal clarification language with AI assistance, compiles the final package.</li>
        <li><strong>Client</strong> — triages every question, adds notes for clarification items, and submits the final package to the agency.</li>
        <li><strong>AI</strong> — drafts the four-part formal clarification request (reference, quote, concern, requested clarification) for each item the client wants asked.</li>
      </ul>

      <h3>Step by step</h3>
      <ol>
        <li><strong>Generate questions.</strong> Analyst opens the solicitation's <em>Strategic Questions</em> tab and clicks <em>Generate</em>.</li>
        <li><strong>Client triages.</strong> Client opens the solicitation in the portal and the <em>Questions</em> tab. For every question they pick one of four options (see below) and add a note where required.</li>
        <li><strong>Client submits decisions.</strong> Once every question is decided, the client clicks <em>Send decisions to analyst</em>. The analyst is notified.</li>
        <li><strong>Analyst drafts clarifications.</strong> The analyst opens the <em>Clarifications</em> tab on the solicitation, runs <em>Draft with AI</em> for each "Clarify" item, edits, and marks each one ready.</li>
        <li><strong>Analyst compiles the package.</strong> When all items are ready, the analyst clicks <em>Compile package</em>. PDF and Word files are saved and the client is notified.</li>
        <li><strong>Client submits to the agency.</strong> Client downloads the package from the portal, sends it through the agency's preferred channel (email, SAM, etc.), and clicks <em>Mark as submitted</em>.</li>
        <li><strong>Capture the agency response.</strong> When the agency answers, the analyst pastes responses against the original questions so they're searchable for the proposal team.</li>
      </ol>

      <h3>The four decision types</h3>
      <ul>
        <li><strong>Clarify</strong> — Send to the agency. Requires a note explaining what's unclear or what outcome the client wants. AI uses the note to draft the formal request.</li>
        <li><strong>Hold</strong> — Keep internal. The question reveals competitive intelligence the client doesn't want to surface. Stays on an internal list for the proposal team.</li>
        <li><strong>Remove</strong> — Drop the question. Not worth asking.</li>
        <li><strong>Defer</strong> — The client wants to discuss with the analyst before deciding. Surfaces in the analyst's queue with the client's note attached.</li>
      </ul>

      <h3>Tips</h3>
      <ul>
        <li>Watch the <em>Questions due</em> countdown at the top of the triage view — anything inside three days of the deadline turns red.</li>
        <li>The client can edit the question text inline before deciding. The clearest path to a good clarification is sometimes a rewrite, not just a note.</li>
        <li>"Hold" questions are valuable competitive intelligence — they're listed separately for the proposal team even though they never reach the agency.</li>
        <li>The analyst can <em>Send back to client</em> a clarification draft if the AI's framing would tip the client's hand. The question moves back to <em>Defer</em> with the analyst's note.</li>
      </ul>

      <h3>FAQ</h3>
      <dl className="space-y-2">
        <dt className="font-semibold">Can two client users review at the same time?</dt>
        <dd className="text-muted-foreground">Yes. Decisions and notes save per question, and the last person to save wins. We show who decided each question and when.</dd>
        <dt className="font-semibold">Can I undo a submission?</dt>
        <dd className="text-muted-foreground">After the client clicks <em>Mark as submitted</em>, the package locks. Ask your analyst to compile a follow-up package if anything changes.</dd>
        <dt className="font-semibold">Where do "Hold" questions go?</dt>
        <dd className="text-muted-foreground">They stay on the strategic-questions list with a Hold badge and never appear in the package sent to the agency.</dd>
        <dt className="font-semibold">Does AI ever submit anything automatically?</dt>
        <dd className="text-muted-foreground">No. AI only drafts language. The analyst reviews and approves every clarification, and only the client can mark the package as submitted.</dd>
      </dl>
    </article>
  );
}
