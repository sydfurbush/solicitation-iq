import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/features/auth/components/AuthProvider";
import { useUser } from "@/features/auth/hooks/useUser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import { Copy, MoreHorizontal, Trash2, UserPlus } from "lucide-react";

type Role = "owner" | "admin" | "analyst" | "viewer";
type InviteRole = "admin" | "analyst" | "viewer";

export function TeamTab() {
  const { user } = useAuthContext();
  const { role: myRole } = useUser();
  const qc = useQueryClient();
  const isOwner = myRole === "owner";

  const { data: me } = useQuery({
    queryKey: ["me-org", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("users").select("organization_id").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  const orgId = me?.organization_id;

  const { data: members = [] } = useQuery({
    queryKey: ["org-members", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: users } = await supabase
        .from("users").select("id, email, full_name, created_at")
        .eq("organization_id", orgId!);
      const ids = (users ?? []).map((u) => u.id);
      const { data: roles } = ids.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] as any[] };
      return (users ?? []).map((u) => ({
        ...u,
        role: (roles?.find((r: any) => r.user_id === u.id)?.role ?? null) as Role | null,
      }));
    },
  });

  const ownerCount = members.filter((m: any) => m.role === "owner").length;

  const { data: invites = [] } = useQuery({
    queryKey: ["org-invitations", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("org_invitations")
        .select("*")
        .eq("organization_id", orgId!)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("analyst");

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("no org");
      const { data, error } = await supabase
        .from("org_invitations")
        .insert({ organization_id: orgId, email: email.trim().toLowerCase(), role, invited_by: user!.id })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Invitation created");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["org-invitations", orgId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to invite"),
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-invitations", orgId] }),
  });

  const setMemberRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: Role }) => {
      const { error } = await supabase.rpc("set_member_role" as any, {
        p_user_id: userId,
        p_role: newRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update role"),
  });

  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remove_org_member" as any, { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed");
      setRemoveTarget(null);
      qc.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to remove member"),
  });

  const [attachEmail, setAttachEmail] = useState("");
  const [attachRole, setAttachRole] = useState<InviteRole>("analyst");
  const attach = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("attach_existing_user_to_org", {
        p_email: attachEmail.trim().toLowerCase(),
        p_role: attachRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Teammate moved into your organization");
      setAttachEmail("");
      qc.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to attach user"),
  });

  const inviteLink = (token: string) => `${window.location.origin}/signup?invite=${token}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Invite a teammate</CardTitle>
          <CardDescription>
            Create an invitation link, then send it to your teammate. When they sign up using the link they
            join your organization automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email" placeholder="teammate@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1"
            />
            <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="analyst">Analyst</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => createInvite.mutate()} disabled={!email || createInvite.isPending}>
              Create invitation
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pending invitations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {invites.length === 0 && <p className="text-sm text-muted-foreground">No pending invitations.</p>}
          {invites.map((inv: any) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 border rounded-md p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{inv.email}</div>
                <div className="text-xs text-muted-foreground">
                  {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => {
                navigator.clipboard.writeText(inviteLink(inv.token));
                toast.success("Invitation link copied");
              }}>
                <Copy className="h-4 w-4 mr-1" /> Copy link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => cancelInvite.mutate(inv.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Change a teammate's role or remove them from the organization. The last owner cannot be demoted or removed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((m: any) => {
            const isSelf = m.id === user?.id;
            const targetIsOwner = m.role === "owner";
            // Role select is disabled if: it's you, or target is an owner and you aren't, or last owner being demoted (server still enforces)
            const roleSelectDisabled =
              isSelf ||
              (targetIsOwner && !isOwner) ||
              setMemberRole.isPending;
            const canRemove =
              !isSelf &&
              !(targetIsOwner && (ownerCount <= 1 || !isOwner));

            return (
              <div key={m.id} className="flex items-center justify-between gap-2 border rounded-md p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{m.full_name ?? m.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.email}{isSelf && " · you"}</div>
                </div>

                {roleSelectDisabled ? (
                  <Badge variant="secondary" className="capitalize">{m.role ?? "—"}</Badge>
                ) : (
                  <Select
                    value={m.role ?? undefined}
                    onValueChange={(v) => {
                      if (v === m.role) return;
                      setMemberRole.mutate({ userId: m.id, newRole: v as Role });
                    }}
                  >
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" disabled={isSelf}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={!canRemove}
                      onSelect={(e) => {
                        e.preventDefault();
                        setRemoveTarget({ id: m.id, name: m.full_name ?? m.email });
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Remove from organization
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Move an existing user into your organization</CardTitle>
          <CardDescription>
            If your teammate already signed up and got their own workspace, enter their email here to move
            them into yours. Their old workspace will be removed if it has no other members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email" placeholder="teammate@company.com"
              value={attachEmail} onChange={(e) => setAttachEmail(e.target.value)} className="flex-1"
            />
            <Select value={attachRole} onValueChange={(v) => setAttachRole(v as InviteRole)}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="analyst">Analyst</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => attach.mutate()} disabled={!attachEmail || attach.isPending}>
              Move user
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Remove member?"
        description={
          removeTarget
            ? `Remove ${removeTarget.name} from the organization? They will lose access immediately. Their account and any content they authored will be preserved.`
            : ""
        }
        confirmText="Remove member"
        variant="destructive"
        onConfirm={() => removeTarget && removeMember.mutate(removeTarget.id)}
        loading={removeMember.isPending}
      />
    </div>
  );
}
