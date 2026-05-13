import { HelpSection, HelpSteps, HelpCallout, HelpBullets } from "@/features/solicitations/help/primitives";

export function RevisionNotificationFlowArticle() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">Handling a revision notification</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Step-by-step flow for triaging a new pre-solicitation, amendment, or final RFP revision and
          comparing it against prior versions.
        </p>
      </header>

      <HelpSection title="When this applies">
        <HelpBullets
          items={[
            "An agency posts an amendment or final on SAM.gov for a solicitation you're watching.",
            "A teammate manually adds a revision (e.g., uploads a new draft RFP package).",
            "You return to a solicitation after time away and need to catch up on what changed.",
          ]}
        />
      </HelpSection>

      <HelpSection title="The flow">
        <HelpSteps
          items={[
            {
              title: "Get notified",
              body:
                "You'll see a bell-icon notification in the top bar (and optionally an email) when a new revision lands. The Revision Inbox at /revisions also lists every unreviewed revision across all solicitations.",
            },
            {
              title: "Open the solicitation",
              body:
                "Click the notification or open the solicitation directly. A 'New since your last visit' banner appears at the top when there are unreviewed revisions.",
            },
            {
              title: "Go to the Comparison tab",
              body:
                "The newest revision is preselected as B (current) and its predecessor as A (baseline). You can change either side from the Revision Timeline at the top.",
            },
            {
              title: "Choose a comparison mode",
              body:
                "Use Incremental to compare against the immediately prior revision (best for spot-checking what an amendment changed). Use Cumulative to compare against the original solicitation (best for total-impact view across many amendments).",
            },
            {
              title: "Pick a diff view",
              body:
                "Toggle between Side-by-side, Stacked, and Inline. Turn on 'Only changes' to hide unchanged sections. Use j / k to jump to next / previous change.",
            },
            {
              title: "Review document-level changes",
              body:
                "The Document Match panel shows Added / Removed / Modified / Unchanged for each file. Click any modified document to open the diff modal with a section table-of-contents and heatmap.",
            },
            {
              title: "Check the Impact tab",
              body:
                "The Impact tab summarizes affected requirements (RTM), proposal outline sections, and writing assignments. Use the Open / Acknowledge buttons to update each downstream artifact.",
            },
            {
              title: "Update RTM, outline, and writing queue",
              body:
                "For each impact: open the requirement / outline section / assignment, apply the change, and acknowledge so the badge clears for the team.",
            },
            {
              title: "Mark the revision Reviewed",
              body:
                "From the Revision Comparison panel click 'Mark revision reviewed'. This clears the unread badge for you and records the decision in the activity log.",
            },
            {
              title: "Export a Change Report",
              body:
                "Use Export → PDF or Word to share a structured summary (revision metadata, document-level changes, section-level diffs, recommendations) with your capture team or client.",
            },
          ]}
        />
      </HelpSection>

      <HelpSection title="Tips">
        <HelpBullets
          items={[
            "Auto-watch is on by default for any solicitation you create or open. Toggle it off from the solicitation header if you don't want notifications.",
            "Manual revisions: use 'Add revision' on the Revision Timeline to create a Pre-sol / Amendment / Final / Draft entry, then upload its document set.",
            "If you only need to compare two specific files, open the Documents tab and use the file-level diff there instead of the full revision view.",
          ]}
        />
      </HelpSection>

      <HelpCallout tone="warn" title="If you missed a SAM amendment">
        Open the solicitation, click <strong>Pull from SAM</strong>. The system will detect new
        attachments, create an Amendment revision automatically, and notify watchers. Then return to
        the Comparison tab and follow the flow above.
      </HelpCallout>

      <HelpCallout tone="client" title="Sharing with the client">
        After marking the revision reviewed, the Change Report PDF/Word export is the recommended
        artifact to send. It includes the revision label, change density, affected requirements, and
        a written summary suitable for executives.
      </HelpCallout>
    </div>
  );
}
