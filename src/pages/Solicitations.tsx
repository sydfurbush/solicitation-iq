import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useDeleteSolicitation,
  useRestoreSolicitation,
  useSolicitations,
  useUpdateSolicitationStatus,
  type SolicitationFilters as Filters,
  type SolicitationWithClient,
} from "@/features/solicitations/hooks/useSolicitations";
import { SolicitationCard } from "@/features/solicitations/components/SolicitationCard";
import { SolicitationsTable } from "@/features/solicitations/components/SolicitationsTable";
import { SolicitationFilters as FiltersBar } from "@/features/solicitations/components/SolicitationFilters";
import { SolicitationsEmptyState } from "@/features/solicitations/components/SolicitationsEmptyState";
import { CreateSolicitationDialog } from "@/features/solicitations/components/CreateSolicitationDialog";
import { toast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

export default function Solicitations() {
  const [searchParams] = useSearchParams();
  const initialClient = searchParams.get("client") ?? undefined;

  const [filters, setFilters] = useState<Filters>(() =>
    initialClient ? { clientIds: [initialClient] } : {}
  );
  const [view, setView] = useState<"grid" | "table">("grid");
  const [showFilters, setShowFilters] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<SolicitationWithClient | null>(null);

  const { data: rows = [], isLoading, isError, error } = useSolicitations(filters);
  const updateStatus = useUpdateSolicitationStatus();
  const deleteMut = useDeleteSolicitation();
  const restoreMut = useRestoreSolicitation();

  const restore = async (s: SolicitationWithClient) => {
    try {
      await restoreMut.mutateAsync(s.id);
      toast({ title: "Restored", description: s.title });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filters]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paged = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page]
  );

  const hasFilters =
    !!filters.search ||
    (filters.clientIds?.length ?? 0) > 0 ||
    (filters.statuses?.length ?? 0) > 0 ||
    (filters.phases?.length ?? 0) > 0 ||
    !!filters.dueFrom ||
    !!filters.dueTo;

  const archive = async (s: SolicitationWithClient) => {
    try {
      await updateStatus.mutateAsync({ id: s.id, status: "archived" });
      toast({ title: "Archived", description: s.title });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const bulkArchive = async () => {
    for (const id of selected) {
      try {
        await updateStatus.mutateAsync({ id, status: "archived" });
      } catch {
        // continue
      }
    }
    toast({ title: `Archived ${selected.length} solicitations` });
    setSelected([]);
  };

  const bulkExport = () => {
    const lines = [
      ["Title", "Client", "Status", "Due", "Value Low", "Value High"].join(","),
      ...rows
        .filter((r) => selected.includes(r.id))
        .map((r) =>
          [
            JSON.stringify(r.title),
            JSON.stringify(r.client?.name ?? ""),
            r.status ?? "",
            r.proposal_due_date ?? "",
            r.estimated_value_low ?? "",
            r.estimated_value_high ?? "",
          ].join(",")
        ),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "solicitations.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Solicitations</h1>
          <p className="text-sm text-muted-foreground">
            Track RFPs, RFQs, and RFIs across your client portfolio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="mr-2 h-4 w-4" /> {showFilters ? "Hide filters" : "Filters"}
          </Button>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as "grid" | "table")}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="grid" aria-label="Grid">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <CreateSolicitationDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New solicitation
              </Button>
            }
          />
        </div>
      </div>

      {showFilters && <FiltersBar value={filters} onChange={setFilters} />}

      <div className="text-xs text-muted-foreground">
        {isLoading
          ? "Loading…"
          : `${total} solicitation${total === 1 ? "" : "s"}${hasFilters ? " (filtered)" : ""}`}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-sm text-destructive">
          Failed to load: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : total === 0 ? (
        <SolicitationsEmptyState
          hasFilters={hasFilters}
          onCreate={() => setCreateOpen(true)}
          onClearFilters={() => setFilters({})}
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paged.map((s) => (
            <SolicitationCard
              key={s.id}
              solicitation={s}
              onArchive={archive}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      ) : (
        <SolicitationsTable
          rows={paged}
          selectedIds={selected}
          onSelectChange={setSelected}
          onArchive={archive}
          onDelete={setPendingDelete}
          onBulkArchive={bulkArchive}
          onBulkExport={bulkExport}
        />
      )}

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  isActive={page === i + 1}
                  onClick={() => setPage(i + 1)}
                  className="cursor-pointer"
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete solicitation?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title}" will be removed from your active list. This can be restored
              later from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!pendingDelete) return;
                try {
                  await deleteMut.mutateAsync(pendingDelete.id);
                  toast({ title: "Deleted" });
                } catch (e) {
                  toast({
                    title: "Failed",
                    description: e instanceof Error ? e.message : String(e),
                    variant: "destructive",
                  });
                } finally {
                  setPendingDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
