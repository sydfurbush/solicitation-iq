import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, FileWarning, Download, Image as ImageIcon, FileText, Copy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useExhibits,
  useDeleteExhibit,
  useSolicitationAppendixSettings,
  useUpdateAppendixSettings,
  getExhibitSignedUrl,
  type Exhibit,
  type ExhibitStatus,
  type ExhibitKind,
} from "../hooks/useExhibits";
import { ExhibitDrawer } from "./ExhibitDrawer";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useActiveOutline, useOutlineNodes } from "@/features/outline/hooks/useProposalOutline";
import { useSolicitation } from "@/features/solicitations/hooks/useSolicitations";
import { useClient } from "@/features/clients/hooks/useClients";

interface Props { solicitationId: string }

const STATUS_TONE: Record<ExhibitStatus, string> = {
  placeholder: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ready: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export function ExhibitsTab({ solicitationId }: Props) {
  const { data: sol } = useSolicitation(solicitationId);
  const { data: client } = useClient(sol?.client_id ?? undefined);
  const organizationId = client?.organization_id ?? "";
  const { data: outline } = useActiveOutline(solicitationId);
  const { data: nodes = [] } = useOutlineNodes(outline?.id);
  const { data: exhibits = [], isLoading } = useExhibits(solicitationId);
  const del = useDeleteExhibit(solicitationId);
  const { data: appendix } = useSolicitationAppendixSettings(solicitationId);
  const updateAppendix = useUpdateAppendixSettings(solicitationId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Exhibit | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Exhibit | null>(null);
  const [filterKind, setFilterKind] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterText, setFilterText] = useState("");

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const filtered = useMemo(() => {
    return exhibits.filter((ex) => {
      if (filterKind !== "all" && ex.kind !== filterKind) return false;
      if (filterStatus !== "all" && ex.status !== filterStatus) return false;
      if (filterText.trim()) {
        const t = filterText.toLowerCase();
        if (
          !ex.title.toLowerCase().includes(t) &&
          !(ex.label ?? "").toLowerCase().includes(t) &&
          !(ex.caption ?? "").toLowerCase().includes(t)
        )
          return false;
      }
      return true;
    });
  }, [exhibits, filterKind, filterStatus, filterText]);

  const counts = useMemo(() => {
    const c: Record<ExhibitStatus, number> = { placeholder: 0, in_progress: 0, ready: 0, approved: 0 };
    let missingFiles = 0;
    for (const e of exhibits) {
      c[e.status] += 1;
      if (!e.file_path && e.status !== "placeholder") missingFiles += 1;
    }
    return { ...c, missingFiles, total: exhibits.length };
  }, [exhibits]);

  const onAdd = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const onEdit = (ex: Exhibit) => {
    setEditing(ex);
    setDrawerOpen(true);
  };
  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete);
      toast.success("Exhibit deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setConfirmDelete(null);
    }
  };

  const onDownload = async (ex: Exhibit) => {
    if (!ex.file_path) return;
    try {
      const url = await getExhibitSignedUrl(ex.file_path, 60);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const copyToken = (ex: Exhibit) => {
    const token = `{{exhibit:${ex.id}}}`;
    navigator.clipboard.writeText(token).then(
      () => toast.success(`Copied ${token}`),
      () => toast.error("Copy failed"),
    );
  };

  return (
    <div className="space-y-4">
      {/* Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Appendix volume</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              <Label className="text-sm">Compile a separate Appendix volume</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, exhibits with placement = appendix are compiled into a standalone .docx grouped by appendix code.
              </p>
            </div>
            <Switch
              checked={appendix?.compile_appendix_volume ?? false}
              onCheckedChange={(v) =>
                updateAppendix.mutate({ compile_appendix_volume: v }, {
                  onError: (e: Error) => toast.error(e.message),
                })
              }
            />
          </div>
          {appendix?.compile_appendix_volume && (
            <div className="grid sm:grid-cols-[200px_1fr] gap-2 items-center">
              <Label className="text-xs">Volume name</Label>
              <Input
                defaultValue={appendix?.appendix_volume_name ?? "Appendix"}
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim() || "Appendix";
                  if (v !== appendix?.appendix_volume_name) {
                    updateAppendix.mutate({ appendix_volume_name: v });
                  }
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roster */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Exhibits & Attachments</CardTitle>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px]">
              <Badge variant="outline">{counts.total} total</Badge>
              <Badge className={STATUS_TONE.placeholder}>{counts.placeholder} placeholder</Badge>
              <Badge className={STATUS_TONE.in_progress}>{counts.in_progress} in progress</Badge>
              <Badge className={STATUS_TONE.ready}>{counts.ready} ready</Badge>
              <Badge className={STATUS_TONE.approved}>{counts.approved} approved</Badge>
              {counts.missingFiles > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <FileWarning className="h-3 w-3" /> {counts.missingFiles} missing files
                </Badge>
              )}
            </div>
          </div>
          <Button onClick={onAdd} disabled={!organizationId}>
            <Plus className="h-4 w-4 mr-1.5" /> Add exhibit
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              placeholder="Search title, label, caption..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="max-w-xs h-9"
            />
            <Select value={filterKind} onValueChange={setFilterKind}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Kind" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                {(["figure","table","chart","exhibit","resume","past_performance","certification","appendix","other"] as ExhibitKind[]).map((k) => (
                  <SelectItem key={k} value={k} className="capitalize">{k.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(["placeholder","in_progress","ready","approved"] as ExhibitStatus[]).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading exhibits…</p>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
              {exhibits.length === 0
                ? "No exhibits yet. Add a figure, table, chart, resume, past-performance write-up, or appendix file."
                : "No exhibits match the current filters."}
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label / Title</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Assigned to</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((ex) => {
                    const node = ex.outline_node_id ? nodeMap.get(ex.outline_node_id) : null;
                    const isImage = ex.file_type?.startsWith("image/");
                    return (
                      <TableRow key={ex.id}>
                        <TableCell className="min-w-[220px]">
                          <div className="font-medium text-sm">
                            {ex.label ? <span className="font-mono text-xs mr-1.5 text-muted-foreground">{ex.label}</span> : null}
                            {ex.title}
                          </div>
                          {ex.caption && <div className="text-xs text-muted-foreground line-clamp-1">{ex.caption}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[10px]">{ex.kind.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {ex.placement === "appendix" ? (
                            <span><Badge variant="secondary" className="text-[10px] mr-1">Appendix</Badge>{ex.appendix_code ?? "—"}</span>
                          ) : node ? (
                            <span>
                              {node.section_number ? <span className="font-mono text-muted-foreground mr-1">{node.section_number}</span> : null}
                              {node.title}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Unassigned</span>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                            placement: {ex.placement.replace(/_/g, " ")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_TONE[ex.status] + " capitalize text-[10px]"}>
                            {ex.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {ex.due_date ? format(new Date(ex.due_date), "MMM d") : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {ex.file_path ? (
                            <button type="button" onClick={() => onDownload(ex)} className="inline-flex items-center gap-1 hover:underline">
                              {isImage ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                              <span className="truncate max-w-[160px]">{ex.file_name ?? "file"}</span>
                            </button>
                          ) : (
                            <span className="text-muted-foreground">No file</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="ghost" title="Copy {{exhibit:id}} token" onClick={() => copyToken(ex)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            {ex.file_path && (
                              <Button size="icon" variant="ghost" title="Download file" onClick={() => onDownload(ex)}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" title="Edit" onClick={() => onEdit(ex)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Delete" onClick={() => setConfirmDelete(ex)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {organizationId && (
        <ExhibitDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          solicitationId={solicitationId}
          organizationId={organizationId}
          exhibit={editing}
          outlineNodes={nodes.map((n) => ({ id: n.id, title: n.title, section_number: n.section_number, volume: n.volume }))}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete exhibit?"
        description={confirmDelete ? `"${confirmDelete.title}" will be permanently removed, including any uploaded file.` : ""}
        confirmText="Delete"
        onConfirm={onDelete}
        variant="danger"
      />
    </div>
  );
}
