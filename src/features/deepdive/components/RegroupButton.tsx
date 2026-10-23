import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderTree, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useCanEditRequirementLinks } from "@/features/outline/hooks/useRequirementLinks";
import { toast } from "sonner";

// Groups newly extracted requirements under the imported matrix rows.
// Only shown when the solicitation already has imported master rows.
export function RegroupButton({ solicitationId }: { solicitationId: string }) {
  const canEdit = useCanEditRequirementLinks();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: hasMasters } = useQuery({
    queryKey: ["requirement-items", solicitationId, "has-imported-masters"],
    enabled: canEdit === true,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("requirement_items")
        .select("id", { count: "exact", head: true })
        .eq("solicitation_id", solicitationId)
        .eq("origin", "import");
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  if (canEdit !== true || !hasMasters) return null;

  const regroup = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-compliance-matrix", {
        body: { solicitationId, regroup: true },
      });
      if (error) {
        if (error.context instanceof Response) {
          const body = await error.context.json().catch(() => null);
          if (body?.error) throw new Error(body.error);
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      toast.success(`Grouped ${data?.regrouped ?? 0} more items under matrix rows`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["requirement-items", solicitationId] }),
        qc.invalidateQueries({ queryKey: ["outline-nodes"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regroup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" variant="outline" disabled={busy} onClick={regroup}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FolderTree className="mr-1 h-4 w-4" />}
          Regroup
        </Button>
      </TooltipTrigger>
      <TooltipContent>Group newly extracted requirements under the imported matrix rows.</TooltipContent>
    </Tooltip>
  );
}
