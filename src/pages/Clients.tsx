import { useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useClients, useDeleteClient, type ClientWithStats } from "@/features/clients/hooks/useClients";
import { ClientCard } from "@/features/clients/components/ClientCard";
import { ClientsTable } from "@/features/clients/components/ClientsTable";
import { ClientsEmptyState } from "@/features/clients/components/ClientsEmptyState";
import { CreateClientDialog } from "@/features/clients/components/CreateClientDialog";
import { INDUSTRIES } from "@/lib/validators/client";
import { toast } from "@/hooks/use-toast";

export default function Clients() {
  const { data: clients = [], isLoading, isError, error } = useClients();
  const deleteMut = useDeleteClient();

  const [view, setView] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClientWithStats | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClientWithStats | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter((c) => {
      const matchesTerm = !term || c.name.toLowerCase().includes(term);
      const matchesIndustry = industry === "all" || c.industry === industry;
      return matchesTerm && matchesIndustry;
    });
  }, [clients, search, industry]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Organizations whose solicitations you analyze.
          </p>
        </div>
        <CreateClientDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add client
            </Button>
          }
        />
      </div>

      {!isLoading && clients.length === 0 ? (
        <ClientsEmptyState onAdd={() => setCreateOpen(true)} />
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter by industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All industries</SelectItem>
                {INDUSTRIES.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as "grid" | "table")}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="grid" aria-label="Grid view">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table view">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-sm text-destructive">
              Failed to load clients: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center border rounded-md">
              No clients match your filters.
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => (
                <ClientCard
                  key={c.id}
                  client={c}
                  onEdit={setEditing}
                  onDelete={setPendingDelete}
                />
              ))}
            </div>
          ) : (
            <ClientsTable
              clients={filtered}
              onEdit={setEditing}
              onDelete={setPendingDelete}
            />
          )}
        </>
      )}

      {editing && (
        <CreateClientDialog
          client={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          trigger={null}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} will be removed from your active clients. Solicitations and reports
              tied to it will remain but become inaccessible from the clients list.
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
                  toast({ title: "Client deleted" });
                } catch (e) {
                  toast({
                    title: "Delete failed",
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
