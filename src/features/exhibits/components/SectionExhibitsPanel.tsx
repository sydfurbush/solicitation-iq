import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, Paperclip, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useExhibits, type ExhibitStatus, type Exhibit } from "../hooks/useExhibits";
import { ExhibitDrawer } from "./ExhibitDrawer";

interface Props {
  solicitationId: string;
  organizationId: string;
  outlineNodeId: string | null;
  onInsertToken?: (token: string) => void;
  outlineNodes: Array<{ id: string; title: string | null; section_number: string | null; volume: string | null }>;
}

const STATUS_DOT: Record<ExhibitStatus, string> = {
  placeholder: "bg-muted-foreground/50",
  in_progress: "bg-amber-500",
  ready: "bg-blue-500",
  approved: "bg-emerald-500",
};

export function SectionExhibitsPanel({ solicitationId, organizationId, outlineNodeId, onInsertToken, outlineNodes }: Props) {
  const { data: exhibits = [] } = useExhibits(solicitationId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Exhibit | null>(null);

  const items = useMemo(
    () => exhibits.filter((ex) => ex.outline_node_id === outlineNodeId && outlineNodeId),
    [exhibits, outlineNodeId],
  );

  const insert = (ex: Exhibit) => {
    const token = `{{exhibit:${ex.id}}}`;
    if (onInsertToken) {
      onInsertToken(token);
      toast.success("Inserted exhibit token");
    } else {
      navigator.clipboard.writeText(token).then(
        () => toast.success(`Copied ${token}`),
        () => toast.error("Copy failed"),
      );
    }
  };

  const copy = (ex: Exhibit) => {
    const token = `{{exhibit:${ex.id}}}`;
    navigator.clipboard.writeText(token).then(
      () => toast.success(`Copied ${token}`),
      () => toast.error("Copy failed"),
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" />
          Exhibits ({items.length})
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          disabled={!outlineNodeId || !organizationId}
          onClick={() => {
            setEditing(null);
            setDrawerOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {!outlineNodeId ? (
        <p className="text-[11px] text-muted-foreground">Select a section to manage its exhibits.</p>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No exhibits assigned. Add a figure, table, chart, or attachment for this section.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((ex) => (
            <li key={ex.id} className="text-[11px] border rounded-md p-2 space-y-1">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[ex.status]}`} />
                    {ex.label && <span className="font-mono text-muted-foreground">{ex.label}</span>}
                    <span className="font-medium truncate">{ex.title}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge variant="outline" className="text-[9px] capitalize py-0 px-1">{ex.kind.replace(/_/g, " ")}</Badge>
                    {!ex.file_path && ex.status !== "placeholder" && (
                      <Badge variant="destructive" className="text-[9px] py-0 px-1 gap-0.5">
                        <FileWarning className="h-2.5 w-2.5" /> no file
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => insert(ex)}>
                  Insert token
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(ex)} title="Copy token">
                  <Copy className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 ml-auto" onClick={() => { setEditing(ex); setDrawerOpen(true); }}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {organizationId && (
        <ExhibitDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          solicitationId={solicitationId}
          organizationId={organizationId}
          exhibit={editing}
          defaultOutlineNodeId={outlineNodeId}
          outlineNodes={outlineNodes}
        />
      )}
    </div>
  );
}
