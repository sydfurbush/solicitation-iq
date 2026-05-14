import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  CheckCircle2,
  RefreshCw,
  FileDown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  useStrategicQuestions,
} from "../hooks/useStrategicQuestions";
import {
  useDraftClarification,
  useMarkClarificationReady,
  useCompileClarificationPackage,
  useClarificationPackages,
  getSignedPackageUrl,
} from "../hooks/useClarificationPackages";
import {
  ITEM_STATUS_LABEL,
  PACKAGE_STATUS_LABEL,
} from "../utils/clientDecisions";
import {
  generateClarificationPdf,
  generateClarificationDocx,
} from "../utils/clarificationPackageGenerator";
import type { QuestionRow } from "../utils/questionHelpers";
import { CATEGORY_LABEL } from "../utils/questionHelpers";

interface Props {
  solicitationId: string;
}

export function ClarificationDrafts({ solicitationId }: Props) {
  const { user } = useAuth();
  const { data: allQuestions = [], isLoading } = useStrategicQuestions(solicitationId);
  const { data: packages = [] } = useClarificationPackages(solicitationId);

  const { data: solicitation } = useQuery({
    queryKey: ["solicitation-meta-clarif", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select("title, solicitation_number, issuing_agency, client_id, clients(name)")
        .eq("id", solicitationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const clarifyQs = useMemo(
    () => allQuestions.filter((q) => q.client_decision === "clarify"),
    [allQuestions]
  );

  const draftMut = useDraftClarification(solicitationId);
  const markMut = useMarkClarificationReady(solicitationId);
  const compileMut = useCompileClarificationPackage(solicitationId);

  const [drafting, setDrafting] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [compiling, setCompiling] = useState(false);

  const draftOne = async (q: QuestionRow) => {
    setDrafting((d) => ({ ...d, [q.id]: true }));
    try {
      await draftMut.mutateAsync(q.id);
      toast({ title: "Draft generated" });
    } catch (e) {
      toast({ title: "Draft failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setDrafting((d) => ({ ...d, [q.id]: false }));
    }
  };

  const draftAllPending = async () => {
    const pending = clarifyQs.filter((q) => !q.clarification_draft);
    if (!pending.length) return;
    toast({ title: `Drafting ${pending.length} item(s)…` });
    await Promise.allSettled(pending.map((q) => draftMut.mutateAsync(q.id)));
    toast({ title: "Drafts generated" });
  };

  const saveEdit = async (q: QuestionRow) => {
    const draft = edits[q.id];
    if (draft === undefined) return;
    try {
      await markMut.mutateAsync({ id: q.id, draft, status: q.clarification_status === "ready" ? "ready" : "drafting" });
      toast({ title: "Saved" });
      setEdits((e) => { const n = { ...e }; delete n[q.id]; return n; });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const markReady = async (q: QuestionRow) => {
    try {
      const draft = edits[q.id];
      await markMut.mutateAsync({ id: q.id, draft, status: "ready" });
      toast({ title: "Marked ready" });
      setEdits((e) => { const n = { ...e }; delete n[q.id]; return n; });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const allReady = clarifyQs.length > 0 && clarifyQs.every((q) => q.clarification_status === "ready");

  const compile = async () => {
    if (!user || !solicitation) return;
    setCompiling(true);
    try {
      const ctx = {
        solicitationTitle: solicitation.title ?? "Solicitation",
        solicitationNumber: solicitation.solicitation_number,
        issuingAgency: solicitation.issuing_agency,
        clientName: (solicitation as any).clients?.name ?? null,
        preparedAt: new Date(),
      };
      const pdfBlob = generateClarificationPdf(clarifyQs, ctx);
      const docxBlob = await generateClarificationDocx(clarifyQs, ctx);

      const stamp = Date.now();
      const base = `clarifications/${solicitationId}/${stamp}`;
      const pdfPath = `${base}.pdf`;
      const docxPath = `${base}.docx`;

      const { error: pdfErr } = await supabase.storage.from("reports").upload(pdfPath, pdfBlob, {
        contentType: "application/pdf", upsert: true,
      });
      if (pdfErr) throw pdfErr;
      const { error: docErr } = await supabase.storage.from("reports").upload(docxPath, docxBlob, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true,
      });
      if (docErr) throw docErr;

      await compileMut.mutateAsync({
        pdfPath, docxPath, userId: user.id, questionIds: clarifyQs.map((q) => q.id),
      });
      toast({ title: "Package compiled", description: "Client has been notified." });
    } catch (e) {
      toast({ title: "Compile failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setCompiling(false);
    }
  };

  const downloadPackage = async (path: string, filename: string) => {
    const url = await getSignedPackageUrl(path);
    if (!url) {
      toast({ title: "Download failed", variant: "destructive" });
      return;
    }
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  };

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>;
  }

  if (clarifyQs.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No items awaiting clarification</AlertTitle>
        <AlertDescription>
          When the client triages questions in their portal and marks any as “Clarify,” they will appear here for you to draft formal requests.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Clarification requests</h3>
            <p className="text-sm text-muted-foreground">
              {clarifyQs.length} item(s) · {clarifyQs.filter((q) => q.clarification_status === "ready").length} ready
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={draftAllPending} disabled={draftMut.isPending}>
              <Sparkles className="h-4 w-4 mr-1" /> Draft all pending
            </Button>
            <Button size="sm" onClick={compile} disabled={!allReady || compiling}>
              {compiling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              Compile package
            </Button>
          </div>
        </CardContent>
      </Card>

      {packages.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Compiled packages</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
                <div className="text-sm">
                  <div className="font-medium">{PACKAGE_STATUS_LABEL[pkg.status]}</div>
                  <div className="text-xs text-muted-foreground">
                    Compiled {pkg.compiled_at ? new Date(pkg.compiled_at).toLocaleString() : "—"}
                    {pkg.submitted_at ? ` · Submitted ${new Date(pkg.submitted_at).toLocaleString()}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  {pkg.pdf_path && (
                    <Button size="sm" variant="outline" onClick={() => downloadPackage(pkg.pdf_path!, "clarification.pdf")}>PDF</Button>
                  )}
                  {pkg.docx_path && (
                    <Button size="sm" variant="outline" onClick={() => downloadPackage(pkg.docx_path!, "clarification.docx")}>DOCX</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {clarifyQs.map((q) => {
        const draftValue = edits[q.id] ?? q.clarification_draft ?? "";
        const isDrafting = drafting[q.id];
        return (
          <Card key={q.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <Badge variant="outline" className="text-xs">{CATEGORY_LABEL[q.category] ?? q.category}</Badge>
                  <CardTitle className="text-base leading-snug">{q.question_text}</CardTitle>
                </div>
                <Badge variant={q.clarification_status === "ready" ? "default" : "secondary"}>
                  {ITEM_STATUS_LABEL[q.clarification_status ?? "none"]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {q.client_note && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="text-xs font-medium uppercase text-muted-foreground mb-1">Client note</div>
                  {q.client_note}
                </div>
              )}
              {(q.source_citation || q.source_quote) && (
                <div className="text-xs text-muted-foreground">
                  {q.source_citation && <div><span className="font-medium">Reference:</span> {q.source_citation}</div>}
                  {q.source_quote && <div className="italic mt-1">"{q.source_quote}"</div>}
                </div>
              )}

              <Textarea
                value={draftValue}
                onChange={(e) => setEdits((s) => ({ ...s, [q.id]: e.target.value }))}
                placeholder="AI-drafted clarification will appear here. Use 'Draft with AI' to generate, then edit as needed."
                className="min-h-[200px] font-mono text-xs"
              />

              <div className="flex flex-wrap gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => draftOne(q)} disabled={isDrafting}>
                  {isDrafting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  {q.clarification_draft ? "Regenerate" : "Draft with AI"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => saveEdit(q)} disabled={edits[q.id] === undefined}>
                  Save edit
                </Button>
                <Button size="sm" onClick={() => markReady(q)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Mark ready
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
