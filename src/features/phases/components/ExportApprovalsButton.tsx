import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePhaseApprovals } from "../hooks/usePhaseApprovals";
import { exportApprovalsPdf } from "../utils/exportApprovalsPdf";

interface Props {
  solicitationId: string | undefined;
  solicitation: {
    title: string | null;
    solicitation_number?: string | null;
    issuing_agency?: string | null;
    client?: { name?: string | null } | null;
  } | null | undefined;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
}

export function ExportApprovalsButton({ solicitationId, solicitation, size = "sm", variant = "outline" }: Props) {
  const { approvals } = usePhaseApprovals(solicitationId);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!solicitationId || !solicitation) return;
    setBusy(true);
    try {
      await exportApprovalsPdf({ solicitationId, solicitation, approvals });
      toast({ title: "Approvals PDF downloaded" });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size={size} variant={variant} onClick={handleClick} disabled={busy || !solicitationId}>
      {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
      Export approvals PDF
    </Button>
  );
}
