import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetaTags } from "@/components/shared/MetaTags";
import { LifeBuoy, BookOpen, Video, Mail } from "lucide-react";

const FAQS = [
  { q: "How do I create my first solicitation?", a: "Go to Clients, create a client, then add a solicitation under that client." },
  { q: "How does AI analysis work?", a: "Upload solicitation documents and click Run Analysis. The system parses and analyzes content using Lovable AI." },
  { q: "Can clients access their data directly?", a: "Yes. Invite client users from the client's Portal Access tab to give them portal access." },
  { q: "How do I export reports?", a: "Open a generated report and use the PDF or Word download buttons." },
  { q: "How does team access work for my consultants?", a: "Each solicitation has a Lead and an Analyst (both full admin) plus optional Contributors. Only assigned people see the solicitation; Org Owners and Admins always see everything. See Settings → Help → 'How team access works' for the full guide." },
  { q: "I can't see a solicitation a teammate showed me — why?", a: "You aren't assigned to it. Ask the Lead to add you as Analyst or Contributor, or ask an Org Admin to promote your org role." },
  { q: "Can two people both be Lead on a solicitation?", a: "No — exactly one Lead per solicitation. Use the Analyst role for the second decision-maker; both have identical edit power." },
];

export default function Help() {
  return (
    <div className="space-y-6 max-w-4xl">
      <MetaTags title="Help & Support" description="Documentation, FAQs, and support resources." />
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><LifeBuoy className="h-7 w-7" /> Help &amp; Support</h1>
        <p className="text-muted-foreground">Find answers, guides, and ways to get in touch.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <ResourceCard icon={BookOpen} title="Documentation" body="Read product guides and API reference." />
        <ResourceCard icon={Video} title="Video tutorials" body="Watch quickstarts and walkthroughs." />
        <ResourceCard icon={Mail} title="Contact support" body="Email us at support@example.com." />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Frequently asked questions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {FAQS.map((f) => (
            <div key={f.q} className="border-b pb-3 last:border-0">
              <div className="font-medium">{f.q}</div>
              <div className="text-sm text-muted-foreground mt-1">{f.a}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ResourceCard({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5 space-y-2">
        <div className="h-9 w-9 rounded-md bg-primary/10 text-primary grid place-items-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{body}</div>
      </CardContent>
    </Card>
  );
}
