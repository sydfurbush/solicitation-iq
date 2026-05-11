import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ExternalLink, Mail, MoreVertical, Pencil, Save, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useClient, useUpdateClient } from "@/features/clients/hooks/useClients";
import { useDeleteSolicitation } from "@/features/solicitations/hooks/useSolicitations";
import { CreateClientDialog } from "@/features/clients/components/CreateClientDialog";
import { ClientUsersManagement } from "@/features/clients/components/ClientUsersManagement";
import { CapabilitiesEditor } from "@/features/clients/components/CapabilitiesEditor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type SolicitationRow = Database["public"]["Tables"]["solicitations"]["Row"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(clientId);
  const updateMut = useUpdateClient();
  const queryClient = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SolicitationRow | null>(null);
  const deleteSolicitation = useDeleteSolicitation();

  const { data: solicitations = [] } = useQuery({
    queryKey: ["client-solicitations", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitations")
        .select("*")
        .eq("client_id", clientId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SolicitationRow[];
    },
  });

  const stats = useMemo(() => {
    const total = solicitations.length;
    const active = solicitations.filter(
      (s) => s.status !== "complete" && s.status !== "archived"
    ).length;
    const complete = solicitations.filter((s) => s.status === "complete").length;
    const archived = solicitations.filter((s) => s.status === "archived").length;
    return { total, active, complete, archived };
  }, [solicitations]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Client not found.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/clients")}>
          Back to clients
        </Button>
      </div>
    );
  }

  const startEditNotes = () => {
    setNotesDraft(client.notes ?? "");
    setEditingNotes(true);
  };
  const saveNotes = async () => {
    try {
      await updateMut.mutateAsync({ id: client.id, input: { notes: notesDraft || undefined } });
      toast({ title: "Notes saved" });
      setEditingNotes(false);
    } catch (e) {
      toast({
        title: "Failed to save",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-muted-foreground">
        <Link to="/clients" className="hover:text-foreground">
          Clients
        </Link>
        <ChevronRight className="h-4 w-4 mx-1" />
        <span className="text-foreground font-medium">{client.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            {client.logo_url ? <AvatarImage src={client.logo_url} alt={client.name} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
              {initials(client.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              {client.industry && <Badge variant="secondary">{client.industry}</Badge>}
              {client.website && (
                <a
                  href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> {client.website}
                </a>
              )}
            </div>
          </div>
        </div>
        <CreateClientDialog
          client={client}
          open={editOpen}
          onOpenChange={setEditOpen}
          trigger={
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
          }
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Active" value={stats.active} accent="primary" />
        <StatCard label="Complete" value={stats.complete} accent="accent" />
        <StatCard label="Archived" value={stats.archived} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="solicitations">Solicitations</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="portal">Portal Access</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Primary contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.primary_contact_name ? (
                  <p className="font-medium">{client.primary_contact_name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No contact set.</p>
                )}
                {client.primary_contact_email && (
                  <a
                    href={`mailto:${client.primary_contact_email}`}
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" /> {client.primary_contact_email}
                  </a>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Notes</CardTitle>
                {!editingNotes ? (
                  <Button size="sm" variant="ghost" onClick={startEditNotes}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" onClick={saveNotes} disabled={updateMut.isPending}>
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {editingNotes ? (
                  <Textarea
                    rows={5}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Internal notes..."
                  />
                ) : client.notes ? (
                  <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Recent solicitations</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/solicitations?client=${client.id}`)}
              >
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {solicitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No solicitations yet.</p>
              ) : (
                <ul className="divide-y">
                  {solicitations.slice(0, 5).map((s) => (
                    <li key={s.id} className="py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.solicitation_number || "No number"} ·{" "}
                          {s.created_at && format(new Date(s.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {s.status?.replace(/_/g, " ")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="solicitations" className="mt-6">
          <Card>
            <CardContent className="py-6">
              {solicitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No solicitations for this client yet.</p>
              ) : (
                <ul className="divide-y">
                  {solicitations.map((s) => (
                    <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/solicitations/${s.id}`)}
                        className="min-w-0 text-left flex-1 hover:text-primary"
                      >
                        <p className="font-medium truncate">{s.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.solicitation_number || "No number"}
                        </p>
                      </button>
                      <Badge variant="outline" className="capitalize">
                        {s.status?.replace(/_/g, " ")}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Solicitation actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setPendingDelete(s)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Activity log coming soon.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portal" className="mt-6">
          {clientId && <ClientUsersManagement clientId={clientId} />}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete solicitation?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title}" will be removed from this client. This can be restored later from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!pendingDelete) return;
                try {
                  await deleteSolicitation.mutateAsync(pendingDelete.id);
                  toast({ title: "Deleted", description: pendingDelete.title });
                  queryClient.invalidateQueries({ queryKey: ["client-solicitations", clientId] });
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

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary" | "accent";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p
          className={
            "text-2xl font-semibold mt-1 " +
            (accent === "primary"
              ? "text-primary"
              : accent === "accent"
                ? "text-accent"
                : "text-foreground")
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
