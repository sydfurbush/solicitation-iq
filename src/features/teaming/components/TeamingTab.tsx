import { useMemo, useRef, useState } from "react";
import { Plus, Trash2, Edit, Loader2, Paperclip, Download, X, AlertTriangle, Users, UserPlus, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  useTeamingPartners,
  useCreateTeamingPartner,
  useUpdateTeamingPartner,
  useDeleteTeamingPartner,
  useTeamingAttachments,
  useUploadTeamingAttachment,
  useDeleteTeamingAttachment,
  downloadTeamingAttachment,
  type TeamingPartner,
} from "@/features/teaming/hooks/useTeamingPartners";
import { useSolicitation } from "@/features/solicitations/hooks/useSolicitations";
import { useClient, type ClientRow } from "@/features/clients/hooks/useClients";
import { useClientProfile, type ClientProfile } from "@/features/clients/hooks/useClientProfile";

type ClientPartnerRole = "prime" | "sub" | "teaming" | "mentor_protege";

function buildClientPartnerDefaults(
  client: ClientRow,
  profile: ClientProfile | null | undefined,
  role: ClientPartnerRole,
): Partial<TeamingPartner> & { name: string } {
  const wc = (profile?.workforce_capacity ?? {}) as Record<string, unknown>;
  const clearanceLevel = typeof wc.clearance_level === "string" ? (wc.clearance_level as string) : null;
  const clearedCountRaw = wc.cleared_count ?? wc.cleared_staff_count;
  const clearedCount =
    typeof clearedCountRaw === "number"
      ? clearedCountRaw
      : typeof clearedCountRaw === "string" && clearedCountRaw.trim() !== ""
        ? Number(clearedCountRaw)
        : null;
  return {
    name: client.name,
    role,
    set_asides: (profile?.set_asides ?? []) as string[],
    naics_codes: (profile?.naics_codes ?? []) as string[],
    workshare_pct: role === "prime" ? 100 : null,
    scope_summary: null,
    agreement_status: role === "prime" ? "subcontract" : "none",
    poc_name: client.primary_contact_name ?? null,
    poc_email: client.primary_contact_email ?? null,
    poc_phone: null,
    clearance_level: clearanceLevel,
    cleared_staff_count: Number.isFinite(clearedCount as number) ? (clearedCount as number) : null,
    notes: "Auto-populated from client profile.",
    linked_client_id: client.id,
  } as Partial<TeamingPartner> & { name: string };
}

const ROLE_LABEL: Record<string, string> = {
  prime: "Prime",
  sub: "Subcontractor",
  teaming: "Teaming partner",
  mentor_protege: "Mentor/Protégé",
};

const AGREEMENT_LABEL: Record<string, string> = {
  none: "None",
  nda: "NDA",
  ta: "Teaming Agreement",
  loi: "LOI",
  subcontract: "Subcontract executed",
};

const AGREEMENT_TONE: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  nda: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  ta: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  loi: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  subcontract: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
};

const SET_ASIDE_OPTIONS = ["SDVOSB", "WOSB", "8(a)", "HUBZone", "SB", "LB"];
const SMALL_BIZ_TAGS = new Set(["SDVOSB", "WOSB", "8(a)", "HUBZone", "SB"]);

export function TeamingTab({ solicitationId }: { solicitationId: string }) {
  const { data: partners = [], isLoading } = useTeamingPartners(solicitationId);
  const { data: attachments = [] } = useTeamingAttachments(solicitationId);
  const create = useCreateTeamingPartner(solicitationId);
  const update = useUpdateTeamingPartner(solicitationId);
  const remove = useDeleteTeamingPartner(solicitationId);

  const { data: solicitation } = useSolicitation(solicitationId);
  const clientId = solicitation?.client_id;
  const { data: client } = useClient(clientId);
  const { data: clientProfile } = useClientProfile(clientId);

  const [editing, setEditing] = useState<TeamingPartner | null>(null);
  const [creating, setCreating] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<Partial<TeamingPartner> | null>(null);

  const clientPartner = useMemo(
    () => (clientId ? partners.find((p) => p.linked_client_id === clientId) ?? null : null),
    [partners, clientId],
  );

  const openAddClientAs = (role: ClientPartnerRole) => {
    if (!client) {
      toast({ title: "Client not loaded yet", variant: "destructive" });
      return;
    }
    if (clientPartner) {
      setEditing(clientPartner);
      return;
    }
    setCreateDefaults(buildClientPartnerDefaults(client, clientProfile ?? null, role));
    setCreating(true);
  };


  const totals = useMemo(() => {
    const totalShare = partners.reduce((acc, p) => acc + (Number(p.workshare_pct) || 0), 0);
    const smallBiz = partners
      .filter((p) => (p.set_asides ?? []).some((s) => SMALL_BIZ_TAGS.has(s)))
      .reduce((acc, p) => acc + (Number(p.workshare_pct) || 0), 0);
    return {
      totalShare: Math.round(totalShare * 10) / 10,
      smallBiz: Math.round(smallBiz * 10) / 10,
      count: partners.length,
    };
  }, [partners]);

  const attachmentsByPartner = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attachments) m.set(a.partner_id, (m.get(a.partner_id) ?? 0) + 1);
    return m;
  }, [attachments]);

  const handleCreate = async (input: Partial<TeamingPartner> & { name: string }) => {
    try {
      await create.mutateAsync(input);
      toast({ title: "Partner added" });
      setCreating(false);
    } catch (e) {
      toast({
        title: "Could not add partner",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (id: string, patch: Partial<TeamingPartner>) => {
    try {
      await update.mutateAsync({ id, patch });
      toast({ title: "Partner updated" });
      setEditing(null);
    } catch (e) {
      toast({
        title: "Could not update",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast({ title: "Partner removed" });
    } catch (e) {
      toast({
        title: "Could not remove",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const workshareWarning = totals.count > 0 && Math.abs(totals.totalShare - 100) > 0.5;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Teaming &amp; Subcontractors</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={!client}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {clientPartner ? "Edit client row" : "Add client as…"}
                  <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {clientPartner ? (
                  <DropdownMenuItem onClick={() => setEditing(clientPartner)}>
                    Edit existing client row
                  </DropdownMenuItem>
                ) : (
                  (["prime", "sub", "teaming", "mentor_protege"] as ClientPartnerRole[]).map((r) => (
                    <DropdownMenuItem key={r} onClick={() => openAddClientAs(r)}>
                      {ROLE_LABEL[r]}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => { setCreateDefaults(null); setCreating(true); }} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Add partner
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Per-solicitation team roster. Used by AI for gap analysis, risks, outline, and
            drafting. Defaults live on the client's Capabilities profile; this overrides them
            for this bid only.
          </p>

          {/* Rollup */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{totals.count} partner{totals.count === 1 ? "" : "s"}</Badge>
            <Badge
              variant="outline"
              className={
                workshareWarning
                  ? "border-amber-500/40 text-amber-700"
                  : "border-emerald-500/30 text-emerald-700"
              }
            >
              Total workshare: {totals.totalShare}%
            </Badge>
            <Badge variant="outline">Small-business participation: {totals.smallBiz}%</Badge>
            {workshareWarning && (
              <span className="text-xs text-amber-700 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Workshare doesn't sum to 100%
              </span>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : partners.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No teaming partners yet for this solicitation.
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Add the first partner
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Set-asides</TableHead>
                    <TableHead className="text-right">Workshare %</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Agreement</TableHead>
                    <TableHead>POC</TableHead>
                    <TableHead className="text-right">Files</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.linked_client_id && clientId && p.linked_client_id === clientId && (
                            <Badge variant="secondary" className="text-[10px]">Client</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ROLE_LABEL[p.role] ?? p.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(p.set_asides ?? []).map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px]">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.workshare_pct != null ? `${p.workshare_pct}%` : "—"}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate" title={p.scope_summary ?? ""}>
                        {p.scope_summary ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={AGREEMENT_TONE[p.agreement_status]}>
                          {AGREEMENT_LABEL[p.agreement_status] ?? p.agreement_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.poc_name || p.poc_email ? (
                          <div>
                            <div>{p.poc_name}</div>
                            <div className="text-muted-foreground">{p.poc_email}</div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {attachmentsByPartner.get(p.id) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Paperclip className="h-3 w-3" />
                            {attachmentsByPartner.get(p.id)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {p.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This also deletes attached files. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(p.id)}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {(creating || editing) && (
        <PartnerDrawer
          key={editing?.id ?? "create"}
          solicitationId={solicitationId}
          partner={editing}
          initialValues={creating ? createDefaults : null}
          client={client ?? null}
          clientProfile={clientProfile ?? null}
          open={creating || !!editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setCreateDefaults(null);
          }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          saving={create.isPending || update.isPending}
        />
      )}
    </div>
  );
}

function PartnerDrawer({
  solicitationId,
  partner,
  initialValues,
  client,
  clientProfile,
  open,
  onClose,
  onCreate,
  onUpdate,
  saving,
}: {
  solicitationId: string;
  partner: TeamingPartner | null;
  initialValues?: Partial<TeamingPartner> | null;
  client?: ClientRow | null;
  clientProfile?: ClientProfile | null;
  open: boolean;
  onClose: () => void;
  onCreate: (input: Partial<TeamingPartner> & { name: string }) => void;
  onUpdate: (id: string, patch: Partial<TeamingPartner>) => void;
  saving: boolean;
}) {
  const isEdit = !!partner;
  const [form, setForm] = useState<Partial<TeamingPartner>>(() =>
    partner ??
    initialValues ?? {
      name: "",
      role: "sub" as TeamingPartner["role"],
      set_asides: [],
      naics_codes: [],
      agreement_status: "none" as TeamingPartner["agreement_status"],
    },
  );

  const linkedClientId = (form.linked_client_id ?? partner?.linked_client_id) as string | null | undefined;
  const canRefill = !!linkedClientId && !!client && client.id === linkedClientId;

  const refillFromClient = () => {
    if (!client) return;
    const role = (form.role ?? "sub") as ClientPartnerRole;
    const defaults = buildClientPartnerDefaults(client, clientProfile ?? null, role);
    setForm((f) => {
      const merged: Partial<TeamingPartner> = { ...f };
      for (const [k, v] of Object.entries(defaults)) {
        const key = k as keyof TeamingPartner;
        const current = (f as Record<string, unknown>)[k];
        const isEmpty =
          current == null ||
          current === "" ||
          (Array.isArray(current) && current.length === 0);
        if (isEmpty && v != null && v !== "") {
          (merged as Record<string, unknown>)[key] = v;
        }
      }
      return merged;
    });
    toast({ title: "Refilled from client profile" });
  };


  const setField = <K extends keyof TeamingPartner>(k: K, v: TeamingPartner[K] | null) =>
    setForm((f) => ({ ...f, [k]: v as TeamingPartner[K] }));

  const toggleSetAside = (tag: string) => {
    const current = new Set(form.set_asides ?? []);
    current.has(tag) ? current.delete(tag) : current.add(tag);
    setField("set_asides", Array.from(current));
  };

  const submit = () => {
    if (!form.name || !form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      name: form.name.trim(),
      workshare_pct:
        form.workshare_pct == null || form.workshare_pct === ("" as unknown)
          ? null
          : Number(form.workshare_pct),
      cleared_staff_count:
        form.cleared_staff_count == null || (form.cleared_staff_count as unknown) === ""
          ? null
          : Number(form.cleared_staff_count),
      naics_codes: (form.naics_codes ?? []).map((s) => String(s).trim()).filter(Boolean),
    } as Partial<TeamingPartner> & { name: string };
    if (isEdit && partner) onUpdate(partner.id, payload);
    else onCreate(payload);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit partner" : "Add partner"}</SheetTitle>
          <SheetDescription>
            Captures one partner on this solicitation. Workshare and agreement status flow into
            downstream AI analysis.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Partner name</Label>
              <Input
                value={form.name ?? ""}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Acme Cyber LLC"
              />
            </div>

            <div>
              <Label>Role</Label>
              <Select
                value={(form.role as string) ?? "sub"}
                onValueChange={(v) => setField("role", v as TeamingPartner["role"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Workshare %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.workshare_pct == null ? "" : String(form.workshare_pct)}
                onChange={(e) =>
                  setField(
                    "workshare_pct",
                    e.target.value === "" ? null : (Number(e.target.value) as unknown as TeamingPartner["workshare_pct"]),
                  )
                }
              />
            </div>

            <div className="col-span-2">
              <Label>Set-asides / socioeconomic tags</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {SET_ASIDE_OPTIONS.map((tag) => {
                  const on = (form.set_asides ?? []).includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleSetAside(tag)}
                      className={`text-xs px-2 py-1 rounded-md border transition ${
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="col-span-2">
              <Label>NAICS codes</Label>
              <Input
                value={(form.naics_codes ?? []).join(", ")}
                onChange={(e) =>
                  setField(
                    "naics_codes",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean) as unknown as TeamingPartner["naics_codes"],
                  )
                }
                placeholder="541512, 541519"
              />
            </div>

            <div className="col-span-2">
              <Label>Scope (what they perform)</Label>
              <Textarea
                rows={2}
                value={form.scope_summary ?? ""}
                onChange={(e) => setField("scope_summary", e.target.value)}
                placeholder="Zero Trust engineering, ~30% LOE"
              />
            </div>

            <div className="col-span-2">
              <Label>Agreement status</Label>
              <Select
                value={(form.agreement_status as string) ?? "none"}
                onValueChange={(v) =>
                  setField("agreement_status", v as TeamingPartner["agreement_status"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AGREEMENT_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>POC name</Label>
              <Input
                value={form.poc_name ?? ""}
                onChange={(e) => setField("poc_name", e.target.value)}
              />
            </div>
            <div>
              <Label>POC email</Label>
              <Input
                type="email"
                value={form.poc_email ?? ""}
                onChange={(e) => setField("poc_email", e.target.value)}
              />
            </div>
            <div>
              <Label>POC phone</Label>
              <Input
                value={form.poc_phone ?? ""}
                onChange={(e) => setField("poc_phone", e.target.value)}
              />
            </div>
            <div>
              <Label>Clearance level</Label>
              <Input
                value={form.clearance_level ?? ""}
                onChange={(e) => setField("clearance_level", e.target.value)}
                placeholder="TS/SCI"
              />
            </div>
            <div>
              <Label>Cleared staff count</Label>
              <Input
                type="number"
                min={0}
                value={form.cleared_staff_count == null ? "" : String(form.cleared_staff_count)}
                onChange={(e) =>
                  setField(
                    "cleared_staff_count",
                    e.target.value === ""
                      ? null
                      : (Number(e.target.value) as unknown as TeamingPartner["cleared_staff_count"]),
                  )
                }
              />
            </div>

            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>
          </div>

          {isEdit && partner && (
            <AttachmentList solicitationId={solicitationId} partnerId={partner.id} />
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Save changes" : "Add partner"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AttachmentList({
  solicitationId,
  partnerId,
}: {
  solicitationId: string;
  partnerId: string;
}) {
  const { data: all = [] } = useTeamingAttachments(solicitationId);
  const items = all.filter((a) => a.partner_id === partnerId);
  const upload = useUploadTeamingAttachment(solicitationId);
  const del = useDeleteTeamingAttachment(solicitationId);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync({ partnerId, file });
      toast({ title: "Attachment uploaded" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-2">
        <Label>Attachments (TA, LOI, capability statement)</Label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4 mr-2" />
          )}
          Upload file
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={onPick} />
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No files yet.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between text-xs rounded border px-2 py-1"
            >
              <span className="truncate">{a.file_name}</span>
              <span className="flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => downloadTeamingAttachment(a.file_path, a.file_name)}
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    del.mutate({ id: a.id, filePath: a.file_path })
                  }
                >
                  <X className="h-3 w-3 text-destructive" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
