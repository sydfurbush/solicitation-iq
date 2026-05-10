import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SectionRow = {
  id: string;
  parent_section_id: string | null;
  section_number: string | null;
  section_title: string | null;
  page_start: number | null;
  page_end: number | null;
  depth: number | null;
  sort_order: number | null;
  content: string;
  ai_importance_score: number | null;
  ai_tags: string[] | null;
};

type Node = SectionRow & { children: Node[] };

function buildTree(rows: SectionRow[]): Node[] {
  // Database has no FK from parent_section_id by design here; we rebuild via depth + order.
  // For a robust tree, group by depth.
  const sorted = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const roots: Node[] = [];
  const stack: Node[] = [];
  for (const r of sorted) {
    const node: Node = { ...r, children: [] };
    const depth = node.depth ?? 0;
    while (stack.length && (stack[stack.length - 1].depth ?? 0) >= depth) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return roots;
}

export function DocumentSectionsTree({
  documentId,
  onSectionClick,
  selectedId,
}: {
  documentId: string;
  onSectionClick?: (section: SectionRow) => void;
  selectedId?: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["sections", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_sections")
        .select(
          "id, parent_section_id, section_number, section_title, page_start, page_end, depth, sort_order, content, ai_importance_score, ai_tags"
        )
        .eq("document_id", documentId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SectionRow[];
    },
  });

  const tree = useMemo(() => buildTree(data ?? []), [data]);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No sections parsed for this document.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {tree.map((n) => (
        <SectionNode
          key={n.id}
          node={n}
          onSectionClick={onSectionClick}
          selectedId={selectedId ?? null}
        />
      ))}
    </ul>
  );
}

function SectionNode({
  node,
  onSectionClick,
  selectedId,
}: {
  node: Node;
  onSectionClick?: (section: SectionRow) => void;
  selectedId: string | null;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const importance = node.ai_importance_score ?? 0;
  const importanceTone =
    importance >= 0.75
      ? "bg-amber-500"
      : importance >= 0.5
        ? "bg-blue-500"
        : importance > 0
          ? "bg-muted-foreground"
          : "bg-transparent";

  return (
    <li>
      <div
        className={cn(
          "group flex items-start gap-1 rounded-md px-2 py-1.5 hover:bg-accent/40 cursor-pointer text-sm",
          selectedId === node.id && "bg-accent"
        )}
        onClick={() => onSectionClick?.(node)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            className="text-muted-foreground hover:text-foreground mt-0.5"
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground mt-0.5 opacity-0" />
        )}
        <span className={cn("h-1.5 w-1.5 rounded-full mt-2 shrink-0", importanceTone)} />
        <div className="flex-1 min-w-0">
          <p className="truncate">
            {node.section_number && (
              <span className="font-mono text-xs text-muted-foreground mr-2">
                {node.section_number}
              </span>
            )}
            <span className="font-medium">{node.section_title ?? "Untitled"}</span>
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {node.page_start != null && (
              <span className="text-[10px] text-muted-foreground">
                p. {node.page_start}
                {node.page_end && node.page_end !== node.page_start ? `–${node.page_end}` : ""}
              </span>
            )}
            {(node.ai_tags ?? []).slice(0, 4).map((t) => (
              <Badge key={t} variant="secondary" className="text-[9px] py-0 px-1.5">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      {hasChildren && open && (
        <ul className="ml-4 border-l pl-2 space-y-0.5 mt-0.5">
          {node.children.map((c) => (
            <SectionNode
              key={c.id}
              node={c}
              onSectionClick={onSectionClick}
              selectedId={selectedId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
