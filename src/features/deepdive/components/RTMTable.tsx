import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Sparkles, Loader2, Download, History, Save, X, Pencil, Filter as FilterIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  useRequirementItems,
  useExtractRequirements,
  useUpdateRequirement,
  useBulkUpdateRequirements,
  useRequirementVersions,
  useRevertRequirement,
  type RequirementItem,
} from "@/features/deepdive/hooks/useRequirementItems";

type Status = "open" | "in_review" | "covered" | "waived";
const STATUSES: Status[] = ["open", "in_review", "covered", "waived"];

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function RTMTable({
  solicitationId,
  onExtracted,
  autoGapsPending,
}: {
  solicitationId: string;
  onExtracted: () => void | Promise<void>;
  autoGapsPending: boolean;
}) {
  const { data: items = [], isLoading } = useRequirementItems(solicitationId);
  const extract = useExtractRequirements(solicitationId);
  const update = useUpdateRequirement(solicitationId);
  const bulkUpdate = useBulkUpdateRequirements(solicitationId);

  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<RequirementItem>>({});
  const [historyFor, setHistoryFor] = useState<RequirementItem | null>(null);
  const [bulkOwner, setBulkOwner] = useState("");
  const [bulkStatus, setBulkStatus] = useState<Status | "">("");

  const owners = useMemo(() => {
    const s = new Set<string>();
    items.forEach((r) => r.compliance_owner && s.add(r.compliance_owner));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return items.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (ownerFilter !== "all") {
        if (ownerFilter === "__none__") {
          if (r.compliance_owner) return false;
        } else if (r.compliance_owner !== ownerFilter) return false;
      }
      if (q) {
        const hay = `${r.req_number} ${r.shall_text} ${r.source_section ?? ""} ${r.compliance_owner ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, statusFilter, ownerFilter]);

  const allOnPageSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someSelected = filtered.some((r) => selected.has(r.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  const startEdit = (r: RequirementItem) => {
    setEditingId(r.id);
    setDraft({
      shall_text: r.shall_text,
      compliance_owner: r.compliance_owner,
      proposal_volume: r.proposal_volume,
      proposal_section: r.proposal_section,
      status: r.status,
      notes: r.notes,
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };
  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await update.mutateAsync({
        id: editingId,
        patch: {
          shall_text: (draft.shall_text ?? "").toString(),
          compliance_owner: (draft.compliance_owner as string | null) || null,
          proposal_volume: (draft.proposal_volume as string | null) || null,
          proposal_section: (draft.proposal_section as string | null) || null,
          status: (draft.status as Status) || "open",
          notes: (draft.notes as string | null) || null,
        },
      });
      toast({ title: "Saved", description: "Edit recorded in history" });
      cancelEdit();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const runExtract = async (regenerate = false) => {
    try {
      const r = await extract.mutateAsync({ regenerate });
      toast({ title: "RTM extracted", description: `${r.inserted} requirements added` });
      if (r.inserted > 0) {
        toast({ title: "Running gap analysis…" });
        await onExtracted();
      }
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const applyBulk = async (patch: { compliance_owner?: string | null; status?: Status }) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      const r = await bulkUpdate.mutateAsync({ ids, patch });
      toast({ title: "Bulk updated", description: `${r.count} requirement(s)` });
      clearSelection();
      setBulkOwner("");
      setBulkStatus("");
    } catch (e) {
      toast({ title: "Bulk update failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const exportCsv = (rows: RequirementItem[]) => {
    const header = [
      "req_number","shall_text","source_section","page_number","compliance_owner",
      "proposal_volume","proposal_section","status","notes","source_quote","source_citation",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(header.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rtm-${solicitationId.slice(0, 8)}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const busy = extract.isPending || autoGapsPending;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base">Requirements Traceability Matrix</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {filtered.length} of {items.length} shown{selected.size ? ` · ${selected.size} selected` : ""}
              {autoGapsPending ? " · running gap analysis…" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Input placeholder="Search…" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-56" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <FilterIcon className="h-4 w-4 mr-1" />
                  Filters
                  {(statusFilter !== "all" || ownerFilter !== "all") && (
                    <Badge variant="secondary" className="ml-2">
                      {[statusFilter !== "all" ? 1 : 0, ownerFilter !== "all" ? 1 : 0].reduce((a, b) => a + b, 0)}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium">Status</p>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium">Owner</p>
                  <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All owners</SelectItem>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => { setStatusFilter("all"); setOwnerFilter("all"); }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                </Button>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={() => exportCsv(filtered)} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button onClick={() => runExtract(items.length > 0)} disabled={busy} size="sm">
              {extract.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {items.length > 0 ? "Regenerate" : "Extract"}
            </Button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap rounded-md border bg-muted/40 p-2 text-sm">
            <span className="font-medium px-2">{selected.size} selected</span>
            <div className="flex items-center gap-1">
              <Input
                placeholder="Set owner…"
                value={bulkOwner}
                onChange={(e) => setBulkOwner(e.target.value)}
                className="h-8 w-40"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyBulk({ compliance_owner: bulkOwner.trim() || null })}
                disabled={bulkUpdate.isPending}
              >
                Apply
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as Status)}>
                <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Set status…" /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkStatus && applyBulk({ status: bulkStatus })}
                disabled={!bulkStatus || bulkUpdate.isPending}
              >
                Apply
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => exportCsv(items.filter((r) => selected.has(r.id)))}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export selected
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No requirements yet. Click "Extract" to build the RTM from your documents. Gap analysis runs automatically after.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-20">#</TableHead>
                  <TableHead>Shall statement</TableHead>
                  <TableHead className="w-28">Section</TableHead>
                  <TableHead className="w-40">Owner</TableHead>
                  <TableHead className="w-40">Vol / Sec</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const isEditing = editingId === r.id;
                  return (
                    <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleOne(r.id)}
                          aria-label={`Select ${r.req_number}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs align-top">{r.req_number}</TableCell>
                      <TableCell className="text-xs align-top max-w-md">
                        {isEditing ? (
                          <Textarea
                            rows={3}
                            value={(draft.shall_text as string) ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, shall_text: e.target.value }))}
                            className="text-xs"
                          />
                        ) : (
                          <span className="whitespace-pre-wrap">{r.shall_text}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground align-top">
                        {r.source_section ?? "—"}
                      </TableCell>
                      <TableCell className="align-top">
                        {isEditing ? (
                          <Input
                            value={(draft.compliance_owner as string) ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, compliance_owner: e.target.value }))}
                            className="h-7 text-xs"
                            placeholder="Owner"
                          />
                        ) : (
                          <span className="text-xs">{r.compliance_owner ?? <span className="text-muted-foreground">—</span>}</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {isEditing ? (
                          <Input
                            value={[draft.proposal_volume, draft.proposal_section].filter(Boolean).join(" / ")}
                            onChange={(e) => {
                              const [vol, sec] = e.target.value.split("/").map((s) => s.trim());
                              setDraft((d) => ({ ...d, proposal_volume: vol || null, proposal_section: sec || null }));
                            }}
                            className="h-7 text-xs"
                            placeholder="Vol / Sec"
                          />
                        ) : (
                          <span className="text-xs">
                            {[r.proposal_volume, r.proposal_section].filter(Boolean).join(" / ") || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {isEditing ? (
                          <Select
                            value={(draft.status as string) ?? "open"}
                            onValueChange={(v) => setDraft((d) => ({ ...d, status: v as Status }))}
                          >
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="capitalize">{(r.status ?? "open").replace("_", " ")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit} disabled={update.isPending} aria-label="Save">
                                <Save className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} aria-label="Cancel">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)} aria-label="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setHistoryFor(r)} aria-label="History">
                                <History className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                      No requirements match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <HistoryDialog
        requirement={historyFor}
        solicitationId={solicitationId}
        onClose={() => setHistoryFor(null)}
      />
    </Card>
  );
}

function HistoryDialog({
  requirement,
  solicitationId,
  onClose,
}: {
  requirement: RequirementItem | null;
  solicitationId: string;
  onClose: () => void;
}) {
  const { data: versions = [], isLoading } = useRequirementVersions(requirement?.id);
  const revert = useRevertRequirement(solicitationId);

  const handleRevert = async (snapshot: Record<string, unknown>) => {
    if (!requirement) return;
    try {
      await revert.mutateAsync({ requirementId: requirement.id, snapshot });
      toast({ title: "Reverted to previous version" });
    } catch (e) {
      toast({ title: "Revert failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!requirement} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit history · {requirement?.req_number}</DialogTitle>
          <DialogDescription>Each save creates a snapshot. Revert restores fields from that snapshot.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No prior versions yet.</p>
          ) : (
            <ul className="space-y-3">
              {versions.map((v) => {
                const snap = v.snapshot as Record<string, unknown>;
                return (
                  <li key={v.id} className="border rounded-md p-3 text-sm space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(v.changed_at), "MMM d, yyyy · h:mm a")}
                        </p>
                        {v.change_summary && (
                          <p className="text-xs">Changed: <span className="font-medium">{v.change_summary}</span></p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleRevert(snap)} disabled={revert.isPending}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Revert
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Field label="Shall" value={snap.shall_text as string} />
                      <Field label="Status" value={snap.status as string} />
                      <Field label="Owner" value={snap.compliance_owner as string} />
                      <Field label="Vol / Sec" value={[snap.proposal_volume, snap.proposal_section].filter(Boolean).join(" / ")} />
                      <Field label="Section" value={snap.source_section as string} />
                      <Field label="Notes" value={snap.notes as string} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap break-words">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}
