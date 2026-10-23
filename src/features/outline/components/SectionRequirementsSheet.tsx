import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { OutlineNode } from "../hooks/useProposalOutline";
import type { RequirementItem } from "@/features/deepdive/hooks/useRequirementItems";
import { useAssignRequirement, useUnassignRequirement } from "../hooks/useRequirementLinks";
import { sectionLabel } from "./SectionPickerDialog";

interface Props {
  node: OutlineNode | null;
  nodes: OutlineNode[];
  requirements: RequirementItem[];
  canEdit: boolean;
  onOpenChange: (o: boolean) => void;
}

export function SectionRequirementsSheet({ node, nodes, requirements, canEdit, onOpenChange }: Props) {
  const assign = useAssignRequirement();
  const unassign = useUnassignRequirement();
  const [adding, setAdding] = useState(false);

  const ownerByReq = useMemo(() => {
    const m = new Map<string, OutlineNode>();
    for (const n of nodes) for (const id of n.linked_requirement_ids ?? []) if (!m.has(id)) m.set(id, n);
    return m;
  }, [nodes]);

  const current = node ? nodes.find((n) => n.id === node.id) ?? node : null;
  const linked = useMemo(() => {
    const ids = new Set(current?.linked_requirement_ids ?? []);
    return requirements.filter((r) => ids.has(r.id));
  }, [current, requirements]);

  const err = (e: unknown) => toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });

  const remove = async (r: RequirementItem) => {
    if (!current) return;
    try {
      await unassign.mutateAsync({ requirementId: r.id, outlineId: current.outline_id });
      toast({ title: `${r.req_number ?? "Requirement"} removed from ${sectionLabel(current)}` });
    } catch (e) { err(e); }
  };

  const add = async (r: RequirementItem) => {
    if (!current) return;
    try {
      await assign.mutateAsync({ requirementId: r.id, nodeId: current.id });
      toast({ title: `${r.req_number ?? "Requirement"} linked to ${sectionLabel(current)}` });
      setAdding(false);
    } catch (e) { err(e); }
  };

  return (
    <>
      <Sheet open={!!node} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{current ? sectionLabel(current) : ""}</SheetTitle>
            <SheetDescription>{linked.length} linked requirement{linked.length === 1 ? "" : "s"}</SheetDescription>
          </SheetHeader>
          {canEdit && (
            <Button size="sm" className="mt-4" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add requirement
            </Button>
          )}
          <ul className="mt-4 space-y-2">
            {linked.map((r) => (
              <li key={r.id} className="border rounded-md p-2 text-sm flex gap-2 items-start">
                <div className="flex-1">
                  <div className="font-mono text-xs">{r.req_number}</div>
                  <div className="text-muted-foreground text-xs mt-0.5">{r.shall_text}</div>
                </div>
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => remove(r)} disabled={unassign.isPending}>
                    <X className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                )}
              </li>
            ))}
            {!linked.length && <li className="text-sm text-muted-foreground">No requirements linked to this section.</li>}
          </ul>
        </SheetContent>
      </Sheet>
      <CommandDialog open={adding} onOpenChange={setAdding}>
        <CommandInput placeholder="Search requirements…" />
        <CommandList>
          <CommandEmpty>No requirements found.</CommandEmpty>
          {requirements.map((r) => {
            const owner = ownerByReq.get(r.id);
            const here = owner?.id === current?.id;
            return (
              <CommandItem key={r.id} value={`${r.req_number ?? ""} ${r.shall_text ?? ""} ${r.id}`} disabled={here} onSelect={() => add(r)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{r.req_number}</span>
                    {owner ? (
                      <Badge variant="outline" className="text-[10px]">{here ? "This section" : `In ${sectionLabel(owner)}`}</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">Unassigned</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{r.shall_text}</div>
                </div>
              </CommandItem>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
