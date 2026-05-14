import { HelpSection, HelpSteps, HelpCallout, HelpBullets } from "@/features/solicitations/help/primitives";

export function TeamAccessArticle() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">How team access works</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A guide to the Organization → Client → Solicitation structure, the Lead / Analyst /
          Contributor model, who can see what, and how a 5-person consulting team should run
          projects together inside Solicitation IQ.
        </p>
      </header>

      <HelpCallout tone="warn" title="Strict access is now active">
        Assigned-only access is live across the platform. Solicitations, clients, documents,
        analyses, reports, risks, win themes, questions, outlines, the writing queue, and the
        activity log are visible only to the people assigned (Lead, Analyst, Contributor) — plus
        Org Owners and Admins, who retain full override. If a teammate can't see a project they
        should be working on, an Org Admin or the current Lead needs to assign them on the
        solicitation (or set them as the default on the parent client).
      </HelpCallout>

      <HelpSection title="The hierarchy">
        <p>
          Everything in Solicitation IQ is scoped to your <strong>Organization</strong>. Inside the
          org you create <strong>Clients</strong>, and each client can have one or more{" "}
          <strong>Solicitations</strong>.
        </p>
        <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto">
{`Organization (your firm)
└── Members (the 5 consultants + admins)
    └── Clients (the agencies/companies you support)
        └── Solicitations (RFPs, RFQs, RFIs you respond to)
            ├── Documents, Analyses, Risks, Win Themes,
            ├── Reports, Outlines, Writing Queue, Activity
            └── Assigned team: Lead + Analyst (+ Contributors)`}
        </pre>
      </HelpSection>

      <HelpSection title="Two layers of roles">
        <p>
          A user has <strong>one organization role</strong> (what they can do across the whole firm)
          and <strong>per-solicitation roles</strong> (which specific projects they're working on).
        </p>

        <p className="font-medium mt-3">Organization roles</p>
        <HelpBullets
          items={[
            "Owner — full control of the org, billing, members, and every client/solicitation. Cannot be locked out.",
            "Admin — same project access as Owner; can invite/remove members, set client teams, and reassign any solicitation.",
            "Analyst — a working consultant. Only sees the clients and solicitations they are assigned to.",
            "Viewer — read-only on assigned work; cannot edit, approve gates, or manage team.",
          ]}
        />

        <p className="font-medium mt-4">Per-solicitation roles</p>
        <HelpBullets
          items={[
            "Lead — the accountable owner of the solicitation. Approves phase gates, signs reports, manages the assigned team.",
            "Analyst — co-owner with full edit rights. Identical permissions to the Lead; the label is for accountability and built-in peer review.",
            "Contributor — read + comment + draft (e.g. a SME or pricing partner). Cannot approve phase gates or change assignments.",
          ]}
        />

        <div className="rounded-md border overflow-hidden mt-3">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-2 font-medium">Action</th>
                <th className="p-2 font-medium">Lead</th>
                <th className="p-2 font-medium">Analyst</th>
                <th className="p-2 font-medium">Contributor</th>
                <th className="p-2 font-medium">Org Admin</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t">
              <tr><td className="p-2">View solicitation + all child data</td><td className="p-2">✓</td><td className="p-2">✓</td><td className="p-2">✓</td><td className="p-2">✓</td></tr>
              <tr><td className="p-2">Edit analyses, risks, win themes, outline</td><td className="p-2">✓</td><td className="p-2">✓</td><td className="p-2">draft only</td><td className="p-2">✓</td></tr>
              <tr><td className="p-2">Approve phase gates / sign reports</td><td className="p-2">✓</td><td className="p-2">✓</td><td className="p-2">—</td><td className="p-2">✓</td></tr>
              <tr><td className="p-2">Add / remove team on solicitation</td><td className="p-2">✓</td><td className="p-2">✓</td><td className="p-2">—</td><td className="p-2">✓</td></tr>
              <tr><td className="p-2">Set default Lead/Analyst on client</td><td className="p-2">—</td><td className="p-2">—</td><td className="p-2">—</td><td className="p-2">✓</td></tr>
              <tr><td className="p-2">Delete solicitation</td><td className="p-2">—</td><td className="p-2">—</td><td className="p-2">—</td><td className="p-2">✓</td></tr>
            </tbody>
          </table>
        </div>
      </HelpSection>

      <HelpSection title="How assignments flow from clients to solicitations">
        <p>
          Each client has a <strong>default Lead and default Analyst</strong>. When you create a new
          solicitation under that client, those two people are automatically assigned. The Lead can
          override either pick on the solicitation itself, and per-solicitation overrides always
          win — changing a client default does <em>not</em> retroactively reassign work in flight.
        </p>
        <HelpCallout tone="info" title="Why it works this way">
          Most firms have a "client owner". This pattern lets that owner stay the default Lead while
          giving you full freedom to swap people in for a single pursuit (e.g. when the usual Lead
          is out, or a specialist needs to run a particular RFP).
        </HelpCallout>
      </HelpSection>

      <HelpSection title="Who sees what (visibility rules)">
        <HelpBullets
          items={[
            "Lead, Analyst, or Contributor on a solicitation → sees the solicitation and all of its data (documents, analyses, reports, risks, win themes, questions, outline, writing queue, activity).",
            "Org Owner / Admin → sees every solicitation in the org, always. They are the safety net.",
            "Org Analyst or Viewer NOT assigned → does not see the solicitation in lists, dashboards, or by direct link.",
            "Client record → visible to anyone assigned to the client OR to any solicitation under it, plus all Org Admins/Owners.",
          ]}
        />
        <HelpCallout tone="info" title="Examples">
          <ul className="list-disc list-inside space-y-1">
            <li>Sarah is Lead on RFP-12 → she sees everything for RFP-12 and the parent client.</li>
            <li>Marcus has Org role "Analyst" but is not assigned to RFP-12 → he can't open it. The dashboard simply doesn't list it for him.</li>
            <li>You (Org Owner) → see every client and every solicitation, regardless of who is assigned.</li>
          </ul>
        </HelpCallout>
      </HelpSection>

      <HelpSection title="Day-to-day workflows">
        <HelpSteps
          items={[
            { title: "Onboard a new client", body: "Create the client record. Then set the default Lead and default Analyst on the client. From this point, every solicitation you add inherits those two." },
            { title: "Start a new solicitation", body: "Open the client, click New Solicitation. Confirm the Lead and Analyst (or override). Add Contributors for SMEs, pricing, or teaming partners as needed." },
            { title: "Hand off a project", body: "Open the solicitation, click Reassign, choose a new Lead. The previous Lead can stay on as Analyst, switch to Contributor, or be removed." },
            { title: "Cover a vacation", body: "Add the covering consultant as a Contributor for the duration. When they return, drop them off — no permanent role change needed. For full coverage, an Org Admin can swap the Lead temporarily." },
            { title: "When someone leaves the firm", body: "An Org Admin removes them from the org and reassigns their solicitations. Their assignment rows aren't deleted automatically — reassign first, then remove the user, so nothing is orphaned." },
          ]}
        />
      </HelpSection>

      <HelpSection title="Recommended team patterns for a 5-consultant firm">
        <p className="font-medium">Pair pattern (recommended)</p>
        <p className="text-muted-foreground">
          Every solicitation has a Lead <em>and</em> a different Analyst. Built-in peer review,
          built-in coverage when one person is out. Best fit for a firm of 5 because it keeps a
          backup on every pursuit without requiring extra meetings.
        </p>

        <p className="font-medium mt-3">Pod pattern</p>
        <p className="text-muted-foreground">
          Split the firm into two pods (e.g. 2 + 3 consultants). Each client belongs to a pod;
          Lead/Analyst rotate inside the pod. Good when clients cluster naturally
          (federal vs state, IT vs construction, etc.).
        </p>

        <p className="font-medium mt-3">Specialist pattern</p>
        <p className="text-muted-foreground">
          Lead is assigned by domain expertise; Analyst is assigned by who has capacity that week.
          Highest quality on technical content but requires active load-balancing — best when one
          or two consultants have a clear specialty the others don't.
        </p>

        <HelpCallout tone="info" title="Our suggestion">
          Start with the <strong>Pair pattern</strong>. It produces the best analyses (two sets of
          eyes on every solicitation), survives vacations and sick days, and lets you switch to a
          Pod or Specialist model later without changing the data model.
        </HelpCallout>
      </HelpSection>

      <HelpSection title="Notifications">
        <HelpBullets
          items={[
            "Assigned to a solicitation → in-app notification + email to the new Lead/Analyst/Contributor.",
            "Reassigned (you were removed) → in-app notification with the new owner's name.",
            "Phase gate awaiting approval → notification to the Lead and Analyst.",
            "@mention in a comment → notification to the mentioned user, regardless of role.",
          ]}
        />
      </HelpSection>

      <HelpSection title="FAQ">
        <p className="font-medium">I can't see a solicitation a teammate showed me — why?</p>
        <p className="text-muted-foreground">
          You're not assigned to it. Ask the Lead to add you (as Analyst, Contributor, or to swap
          you in). If you need broader access, an Org Admin can promote your org role to Admin.
        </p>

        <p className="font-medium mt-3">Can two people both be the Lead?</p>
        <p className="text-muted-foreground">
          No — there is exactly one Lead per solicitation, by design (one accountable owner). The
          Analyst has identical edit power, so use that role for the second decision-maker.
        </p>

        <p className="font-medium mt-3">Can the Lead reassign themselves off a project?</p>
        <p className="text-muted-foreground">
          Yes. The current Lead can hand the role to anyone in the org. Org Admins can also
          reassign at any time.
        </p>

        <p className="font-medium mt-3">What happens to assignments when someone leaves the org?</p>
        <p className="text-muted-foreground">
          They are not deleted automatically. An Org Admin should reassign the user's open
          solicitations to a teammate before removing them, so nothing becomes orphaned.
        </p>

        <p className="font-medium mt-3">Does removing a Contributor delete their work?</p>
        <p className="text-muted-foreground">
          No. Comments, drafts, and edits stay. They simply lose the ability to open the
          solicitation going forward.
        </p>
      </HelpSection>
    </div>
  );
}
