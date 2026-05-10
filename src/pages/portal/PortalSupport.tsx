import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClientUser } from "@/features/portal/hooks/useClientUser";
import { SupportWidget } from "@/features/portal/components/SupportWidget";

export default function PortalSupport() {
  const { clientUser } = useClientUser();

  const { data: messages = [] } = useQuery({
    queryKey: ["portal-support", clientUser?.id],
    enabled: !!clientUser?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_support_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LifeBuoy className="h-6 w-6" /> Support
        </h1>
        <p className="text-muted-foreground">
          Send us a message using the support button on any page, or browse common questions below.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Frequently asked</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Faq q="How do I download a report?">
            Open a solicitation, go to the Reports tab, and click the PDF or Word button.
          </Faq>
          <Faq q="Why can't I see all analysis details?">
            Visibility depends on the access level your account team configured for your organization.
          </Faq>
          <Faq q="How do notifications work?">
            We notify you in-app whenever a new report is published or analysis is updated. Manage preferences in your profile.
          </Faq>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Your messages</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No support messages yet.</p>
          )}
          {messages.map((m: any) => (
            <div key={m.id} className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium text-sm">{m.subject}</div>
                <Badge variant={m.status === "resolved" ? "outline" : "default"} className="capitalize">{m.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{m.message}</p>
              <div className="text-[11px] text-muted-foreground mt-1">
                {format(new Date(m.created_at), "PPp")}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <SupportWidget />
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="border-b pb-3 last:border-0">
      <div className="font-medium">{q}</div>
      <div className="text-muted-foreground mt-1">{children}</div>
    </div>
  );
}
