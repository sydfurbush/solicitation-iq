import { format } from "date-fns";
import { FolderUp, RefreshCw, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useClientUser } from "@/features/portal/hooks/useClientUser";
import { OnboardingUploader } from "@/features/onboarding/components/OnboardingUploader";
import { runTriage, useDeleteOnboardingDoc, useOnboardingDocuments } from "@/features/onboarding/hooks/useOnboarding";
import { clientCanDelete, clientStatusLabel, type OnboardingStatus } from "@/features/onboarding/lib/onboardingFiles";
import { formatFileSize } from "@/features/documents/utils/fileHelpers";

export default function PortalDocuments() {
  const { clientUser } = useClientUser();
  const clientId = clientUser?.client_id;
  const qc = useQueryClient();
  const { data: docs = [] } = useOnboardingDocuments(clientId);
  const del = useDeleteOnboardingDoc(clientId);

  const retry = async (id: string) => {
    try { await runTriage(id); } catch { toast({ title: "Still couldn't read this file", variant: "destructive" }); }
    qc.invalidateQueries({ queryKey: ["onboarding-docs", clientId] });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FolderUp className="h-6 w-6" /> Company Documents</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Share documents about your company (capability statement, past proposals and past performance, certifications,
          registrations, resumes of staff you may propose). We'll review them and send back a company profile for you to
          confirm. Your files are private to your company and our team.
        </p>
      </div>
      {clientId && <OnboardingUploader clientId={clientId} kind="client" />}
      <Card>
        <CardHeader><CardTitle className="text-base">Your uploads</CardTitle></CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files yet.</p>
          ) : (
            <ul className="divide-y">
              {docs.map((d) => {
                const s = d.status as OnboardingStatus;
                return (
                  <li key={d.id} className="py-3 flex items-center gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{d.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(d.byte_size)} · {d.created_at ? format(new Date(d.created_at), "MMM d, yyyy") : ""}
                      </p>
                      {s === "failed" && d.error && <p className="text-xs text-destructive mt-1">{d.error}</p>}
                    </div>
                    <Badge variant={s === "failed" ? "destructive" : s === "triaged" ? "default" : "secondary"}>
                      {clientStatusLabel(s)}
                    </Badge>
                    {s === "failed" && (
                      <Button size="sm" variant="ghost" onClick={() => retry(d.id)}><RefreshCw className="h-4 w-4 mr-1" />Retry</Button>
                    )}
                    {clientCanDelete(s) && (
                      <Button size="icon" variant="ghost" title="Delete" onClick={() => del.mutate(d)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
