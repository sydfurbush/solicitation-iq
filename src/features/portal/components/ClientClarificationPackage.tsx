import { useState } from "react";
import { Download, FileText, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useClarificationPackages,
  useMarkPackageSubmitted,
  getSignedPackageUrl,
} from "@/features/questions/hooks/useClarificationPackages";
import { PACKAGE_STATUS_LABEL } from "@/features/questions/utils/clientDecisions";
import { useClientUser } from "../hooks/useClientUser";

interface Props {
  solicitationId: string;
  solicitationTitle?: string | null;
}

export function ClientClarificationPackage({ solicitationId, solicitationTitle }: Props) {
  const { clientUser } = useClientUser();
  const { data: packages = [] } = useClarificationPackages(solicitationId);
  const submit = useMarkPackageSubmitted(solicitationId);
  const [submitDialogId, setSubmitDialogId] = useState<string | null>(null);
  const [reference, setReference] = useState("");

  const pkg = packages.find((p) => p.status === "ready") ?? packages[0];
  if (!pkg) return null;

  const handleDownload = async (path?: string | null) => {
    if (!path) return;
    const url = await getSignedPackageUrl(path);
    if (!url) {
      toast.error("Could not generate download link.");
      return;
    }
    window.open(url, "_blank");
  };

  const handleSubmit = async () => {
    if (!clientUser?.id || !submitDialogId) return;
    try {
      await submit.mutateAsync({
        packageId: submitDialogId,
        clientUserId: clientUser.id,
        submissionReference: reference || undefined,
      });
      toast.success("Marked as submitted.");
      setSubmitDialogId(null);
      setReference("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit");
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Clarification package
          </CardTitle>
          <Badge variant="outline">{PACKAGE_STATUS_LABEL[pkg.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Your analyst has compiled a formal clarification package
          {solicitationTitle ? ` for ${solicitationTitle}` : ""}. Download it and submit to the contracting officer
          using the channel the agency requires.
        </p>
        <div className="flex flex-wrap gap-2">
          {pkg.pdf_path && (
            <Button size="sm" variant="outline" onClick={() => handleDownload(pkg.pdf_path)}>
              <Download className="h-4 w-4 mr-1" /> Download PDF
            </Button>
          )}
          {pkg.docx_path && (
            <Button size="sm" variant="outline" onClick={() => handleDownload(pkg.docx_path)}>
              <Download className="h-4 w-4 mr-1" /> Download Word
            </Button>
          )}
          {pkg.status !== "submitted" ? (
            <Button size="sm" onClick={() => setSubmitDialogId(pkg.id)}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Mark as submitted
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground self-center">
              Submitted {pkg.submitted_at ? format(new Date(pkg.submitted_at), "PP") : ""}
              {pkg.submission_reference ? ` · Ref: ${pkg.submission_reference}` : ""}
            </span>
          )}
        </div>
      </CardContent>

      <Dialog open={!!submitDialogId} onOpenChange={(o) => !o && setSubmitDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark package as submitted</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Confirm you've sent this package to the contracting officer. Optionally paste a reference (email
              subject, agency confirmation number, etc.).
            </p>
            <Input
              placeholder="Submission reference (optional)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogId(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submit.isPending}>
              Confirm submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
