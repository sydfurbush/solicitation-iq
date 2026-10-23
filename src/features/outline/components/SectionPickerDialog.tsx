import { useMemo } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { OutlineNode } from "../hooks/useProposalOutline";

export function sectionLabel(n: Pick<OutlineNode, "section_number" | "title">) {
  return `${n.section_number ?? ""} ${n.title}`.trim();
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nodes: OutlineNode[];
  currentNodeId?: string | null;
  onPick: (node: OutlineNode) => void;
}

export function SectionPickerDialog({ open, onOpenChange, nodes, currentNodeId, onPick }: Props) {
  const groups = useMemo(() => {
    const m = new Map<string, OutlineNode[]>();
    for (const n of nodes) {
      const v = n.volume || "No volume";
      if (!m.has(v)) m.set(v, []);
      m.get(v)!.push(n);
    }
    return [...m.entries()];
  }, [nodes]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search sections…" />
      <CommandList>
        <CommandEmpty>No sections found.</CommandEmpty>
        {groups.map(([vol, list]) => (
          <CommandGroup key={vol} heading={vol}>
            {list.map((n) => (
              <CommandItem
                key={n.id}
                value={`${vol} ${sectionLabel(n)} ${n.id}`}
                disabled={n.id === currentNodeId}
                onSelect={() => { onPick(n); onOpenChange(false); }}
              >
                <span className="text-muted-foreground mr-1">{vol} ·</span>
                {sectionLabel(n)}
                {n.id === currentNodeId && <span className="ml-auto text-xs text-muted-foreground">current</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
