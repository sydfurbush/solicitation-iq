import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/features/auth/components/AuthProvider";

export type ClientAssignmentRole = "lead" | "analyst";
export type SolAssignmentRole = "lead" | "analyst" | "contributor";

export type OrgMember = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type Assignment<R extends string> = {
  id: string;
  user_id: string;
  role: R;
  user: OrgMember | null;
};

async function fetchOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, avatar_url")
    .eq("organization_id", orgId);
  if (error) throw error;
  return (data ?? []) as OrgMember[];
}

export function useOrgMembers() {
  const { user } = useAuthContext();
  return useQuery({
    queryKey: ["org-members-list", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: me } = await supabase
        .from("users").select("organization_id").eq("id", user!.id).maybeSingle();
      if (!me?.organization_id) return [];
      return fetchOrgMembers(me.organization_id);
    },
  });
}

export function useIsOrgAdmin() {
  const { user } = useAuthContext();
  return useQuery({
    queryKey: ["is-org-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).some((r: { role: string }) => r.role === "owner" || r.role === "admin");
    },
  });
}

function attachUsers<R extends string>(rows: { id: string; user_id: string; role: R }[], members: OrgMember[]): Assignment<R>[] {
  return rows.map((r) => ({ ...r, user: members.find((m) => m.id === r.user_id) ?? null }));
}

export function useClientAssignments(clientId?: string) {
  const { data: members = [] } = useOrgMembers();
  return useQuery({
    queryKey: ["client-assignments", clientId, members.length],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_assignments")
        .select("id, user_id, role")
        .eq("client_id", clientId!);
      if (error) throw error;
      return attachUsers<ClientAssignmentRole>((data ?? []) as any, members);
    },
  });
}

export function useSetClientAssignment(clientId?: string) {
  const qc = useQueryClient();
  const { user } = useAuthContext();
  return useMutation({
    mutationFn: async ({ role, userId }: { role: ClientAssignmentRole; userId: string | null }) => {
      if (!clientId) throw new Error("no client");
      // Remove existing for that role
      await supabase.from("client_assignments").delete().eq("client_id", clientId).eq("role", role);
      if (userId) {
        const { error } = await supabase.from("client_assignments").insert({
          client_id: clientId, user_id: userId, role, assigned_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-assignments", clientId] }),
  });
}

export function useSolicitationAssignments(solId?: string) {
  const { data: members = [] } = useOrgMembers();
  return useQuery({
    queryKey: ["sol-assignments", solId, members.length],
    enabled: !!solId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitation_assignments")
        .select("id, user_id, role")
        .eq("solicitation_id", solId!);
      if (error) throw error;
      return attachUsers<SolAssignmentRole>((data ?? []) as any, members);
    },
  });
}

export function useSetSolicitationAssignment(solId?: string) {
  const qc = useQueryClient();
  const { user } = useAuthContext();
  return useMutation({
    mutationFn: async ({ role, userId }: { role: "lead" | "analyst"; userId: string | null }) => {
      if (!solId) throw new Error("no solicitation");
      await supabase.from("solicitation_assignments").delete()
        .eq("solicitation_id", solId).eq("role", role);
      if (userId) {
        const { error } = await supabase.from("solicitation_assignments").insert({
          solicitation_id: solId, user_id: userId, role, assigned_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sol-assignments", solId] }),
  });
}

export function useAddContributor(solId?: string) {
  const qc = useQueryClient();
  const { user } = useAuthContext();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!solId) throw new Error("no solicitation");
      const { error } = await supabase.from("solicitation_assignments").insert({
        solicitation_id: solId, user_id: userId, role: "contributor", assigned_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sol-assignments", solId] }),
  });
}

export function useRemoveAssignment(solId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("solicitation_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sol-assignments", solId] }),
  });
}

/** All solicitation IDs the current user is assigned to (any role). */
export function useMyAssignedSolicitationIds() {
  const { user } = useAuthContext();
  return useQuery({
    queryKey: ["my-sol-assignments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitation_assignments")
        .select("solicitation_id, role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as { solicitation_id: string; role: SolAssignmentRole }[];
    },
  });
}
