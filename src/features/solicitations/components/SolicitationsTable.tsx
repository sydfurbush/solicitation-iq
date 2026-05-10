import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowUpDown, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  STATUS_CLASSES,
  STATUS_LABELS,
  daysUntil,
  dueUrgency,
  formatRange,
} from "../lib/format";
import type { SolicitationWithClient } from "../hooks/useSolicitations";
import type { SolicitationStatus } from "@/lib/validators/solicitation";

type SortKey = "due" | "value" | "status" | "title" | "client";

interface Props {
  rows: SolicitationWithClient[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onArchive: (s: SolicitationWithClient) => void;
  onDelete: (s: SolicitationWithClient) => void;
  onBulkArchive: () => void;
  onBulkExport: () => void;
}

export function SolicitationsTable({
  rows,
  selectedIds,
  onSelectChange,
  onArchive,
  onDelete,
  onBulkArchive,
  onBulkExport,
}: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const acc = (r: SolicitationWithClient) => {
      switch (sortKey) {
        case "due": return r.proposal_due_date ?? "";
        case "value": return r.estimated_value_high ?? r.estimated_value_low ?? 0;
        case "status": return r.status ?? "";
        case "title": return r.title?.toLowerCase() ?? "";
        case "client": return r.client?.name?.toLowerCase() ?? "";
      }
    };
    return [...rows].sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const allSelected = sorted.length > 0 && sorted.every((r) => selectedIds.includes(r.id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => toggleSort(k)}>
      {children}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-muted/50 border rounded-md px-3 py-2 text-sm">
          <span>{selectedIds.length} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onBulkExport}>
              Export
            </Button>
            <Button size="sm" variant="outline" onClick={onBulkArchive}>
              Archive
            </Button>
          </div>
        </div>
      )}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected || (someSelected ? "indeterminate" : false)}
                  onCheckedChange={(v) =>
                    onSelectChange(v === true ? sorted.map((r) => r.id) : [])
                  }
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead><SortBtn k="client">Client</SortBtn></TableHead>
              <TableHead><SortBtn k="title">Title</SortBtn></TableHead>
              <TableHead>Agency</TableHead>
              <TableHead><SortBtn k="status">Status</SortBtn></TableHead>
              <TableHead><SortBtn k="due">Due</SortBtn></TableHead>
              <TableHead><SortBtn k="value">Value</SortBtn></TableHead>
              <TableHead>Phase</TableHead>
              <TableHead className="text-center">Docs</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s) => {
              const status = (s.status ?? "intake") as SolicitationStatus;
              const urgency = dueUrgency(s.proposal_due_date);
              const days = daysUntil(s.proposal_due_date);
              const checked = selectedIds.includes(s.id);
              return (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/solicitations/${s.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        onSelectChange(
                          v === true
                            ? [...selectedIds, s.id]
                            : selectedIds.filter((id) => id !== s.id)
                        )
                      }
                      aria-label={`Select ${s.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {s.client?.logo_url ? (
                          <AvatarImage src={s.client.logo_url} alt={s.client.name} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                          {(s.client?.name ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{s.client?.name ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium max-w-[280px] truncate">{s.title}</TableCell>
                  <TableCell className="text-muted-foreground">{s.issuing_agency ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
                      {STATUS_LABELS[status]}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      urgency === "danger" || urgency === "overdue"
                        ? "text-destructive"
                        : urgency === "warning"
                          ? "text-amber-600"
                          : ""
                    )}
                  >
                    {s.proposal_due_date ? (
                      <div className="flex flex-col">
                        <span>{format(new Date(s.proposal_due_date), "MMM d, yyyy")}</span>
                        {days !== null && (
                          <span className="text-xs">
                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                          </span>
                        )}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatRange(s.estimated_value_low, s.estimated_value_high)}
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">
                    {(s.current_phase ?? "phase_1_initial").replace(/phase_(\d)_.*/i, "P$1")}
                  </TableCell>
                  <TableCell className="text-center">{s.documents_count}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/solicitations/${s.id}`)}>
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onArchive(s)}>
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(s)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
