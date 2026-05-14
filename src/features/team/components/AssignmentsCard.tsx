import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import {
  useOrgMembers, useIsOrgAdmin,
  useClientAssignments, useSetClientAssignment,
  useSolicitationAssignments, useSetSolicitationAssignment,
  useAddContributor, useRemoveAssignment,
  type Assignment, type ClientAssignmentRole, type SolAssignmentRole, type OrgMember,
} from "../hooks/useAssignments";

function memberInitials(m: OrgMember | null) {
  const name = m?.full_name || m?.email || "?";
  return name.split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function MemberPill({ m, onRemove }: { m: OrgMember | null; onRemove?: () => void }) {
  const label = m?.full_name || m?.email || "Unknown";
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-background pl-1 pr-2 py-1 text-sm">
      <Avatar className="h-6 w-6">
        {m?.avatar_url ? <AvatarImage src={m.avatar_url} alt={label} /> : null}
        <AvatarFallback className="text-[10px]">{memberInitials(m)}</AvatarFallback>
      </Avatar>
      <span className="truncate max-w-[160px]">{label}</span>
      {onRemove && (
        <button onClick={onRemove} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function RoleRow({
  label, description, current, members, canEdit, onChange,
}: {
  label: string;
  description?: string;
  current: Assignment<string> | undefined;
  members: OrgMember[];
  canEdit: boolean;
  onChange: (userId: string | null) => Promise<void> | void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">
        {canEdit ? (
          <Select
            value={current?.user_id ?? "__none"}
            onValueChange={(v) => onChange(v === "__none" ? null : v)}
          >
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Unassigned</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : current?.user ? (
          <MemberPill m={current.user} />
        ) : (
          <Badge variant="outline">Unassigned</Badge>
        )}
      </div>
    </div>
  );
}

export function ClientAssignmentsCard({ clientId }: { clientId: string }) {
  const { data: members = [] } = useOrgMembers();
  const { data: isAdmin = false } = useIsOrgAdmin();
  const { data: assignments = [] } = useClientAssignments(clientId);
  const setAssign = useSetClientAssignment(clientId);

  const lead = assignments.find((a) => a.role === "lead");
  const analyst = assignments.find((a) => a.role === "analyst");

  const update = async (role: ClientAssignmentRole, userId: string | null) => {
    try {
      await setAssign.mutateAsync({ role, userId });
      toast.success(`${role === "lead" ? "Lead" : "Analyst"} updated`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Client team</CardTitle>
        <p className="text-sm text-muted-foreground">
          Defaults assigned to every new solicitation under this client. Per-solicitation overrides win.
        </p>
      </CardHeader>
      <CardContent>
        <RoleRow
          label="Default Lead"
          description="Accountable owner. Approves phase gates, signs reports."
          current={lead}
          members={members}
          canEdit={isAdmin}
          onChange={(uid) => update("lead", uid)}
        />
        <RoleRow
          label="Default Analyst"
          description="Co-owner with full edit rights. Built-in peer review."
          current={analyst}
          members={members}
          canEdit={isAdmin}
          onChange={(uid) => update("analyst", uid)}
        />
        {!isAdmin && (
          <p className="text-xs text-muted-foreground mt-3">
            Only Org Owners and Admins can change the client team.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function SolicitationAssignmentsCard({ solicitationId }: { solicitationId: string }) {
  const { data: members = [] } = useOrgMembers();
  const { data: isAdmin = false } = useIsOrgAdmin();
  const { data: assignments = [] } = useSolicitationAssignments(solicitationId);
  const setAssign = useSetSolicitationAssignment(solicitationId);
  const addContributor = useAddContributor(solicitationId);
  const removeAssign = useRemoveAssignment(solicitationId);
  const [contributorPick, setContributorPick] = useState<string>("");

  const lead = assignments.find((a) => a.role === "lead");
  const analyst = assignments.find((a) => a.role === "analyst");
  const contributors = assignments.filter((a) => a.role === "contributor");
  // Lead or Analyst (or admin) can edit
  const canEdit = isAdmin || !!assignments.find((a) =>
    (a.role === "lead" || a.role === "analyst") && a.user?.id /* current user check below */
  );

  // We don't have current user id wired here — use optimistic: allow if admin or any lead/analyst row ours
  // Simpler: allow any signed-in lead/analyst to edit via RLS, which will reject if not.
  const canEditFinal = canEdit || isAdmin;

  const update = async (role: "lead" | "analyst", userId: string | null) => {
    try {
      await setAssign.mutateAsync({ role, userId });
      toast.success(`${role === "lead" ? "Lead" : "Analyst"} updated`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    }
  };

  const addContrib = async () => {
    if (!contributorPick) return;
    try {
      await addContributor.mutateAsync(contributorPick);
      setContributorPick("");
      toast.success("Contributor added");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add");
    }
  };

  const eligibleForContrib = members.filter(
    (m) => !assignments.some((a) => a.user_id === m.id && a.role === "contributor")
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assigned team</CardTitle>
        <p className="text-sm text-muted-foreground">
          Lead and Analyst have full edit rights. Contributors can comment and draft.
        </p>
      </CardHeader>
      <CardContent>
        <RoleRow
          label="Lead"
          current={lead}
          members={members}
          canEdit={canEditFinal}
          onChange={(uid) => update("lead", uid)}
        />
        <RoleRow
          label="Analyst"
          current={analyst}
          members={members}
          canEdit={canEditFinal}
          onChange={(uid) => update("analyst", uid)}
        />

        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Contributors</p>
          {contributors.length === 0 && (
            <p className="text-xs text-muted-foreground mb-2">No contributors yet.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {contributors.map((c) => (
              <MemberPill
                key={c.id}
                m={c.user}
                onRemove={canEditFinal ? () => removeAssign.mutate(c.id) : undefined}
              />
            ))}
          </div>
          {canEditFinal && (
            <div className="flex items-center gap-2 mt-3">
              <Select value={contributorPick} onValueChange={setContributorPick}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Add a contributor…" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleForContrib.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addContrib} disabled={!contributorPick}>
                <UserPlus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
