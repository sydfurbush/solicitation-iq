import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/features/auth/hooks/useUser";
import { InviteClientUserDialog } from "@/features/clients/components/InviteClientUserDialog";
import { OnboardingUploader } from "./OnboardingUploader";
import {
  openSignedUrl, runTriage, useConfirmReview, useOnboardingDocuments, useOnboardingTriage,
} from "../hooks/useOnboarding";
import { effectiveDestinations, matchesFilter, receivedLabel, type StaffFilter } from "../lib/onboardingFiles";
import { ReceivedRow, useReceivedState } from "./ReceivedRow";
import {
  DESTINATION_LABELS, DOC_TYPE_LABELS, type Destination, type DocType,
} from "../../../../supabase/functions/_shared/onboardingTriage";

const DESTS: Destination[] = ["profile", "knowledge", "restricted", "not_needed"];
const FILTERS: { key: StaffFilter | "emailed"; label: string }[] = [
  { key: "all", label: "All" }, { key: "needs_review", label: "Needs review" },
  { key: "restricted", label: "Restricted" }, { key: "needs_cleaning", label: "Needs cleaning" },
  { key: "not_needed", label: "Not needed" }, { key: "emailed", label: "Emailed" },
];

function DestBadge({ d }: { d: string }) {
  const label = DESTINATION_LABELS[d as Destination] ?? d;
  if (d === "restricted") return <Badge variant="destructive">{label}</Badge>;
  if (d === "not_needed") return <Badge variant="secondary" className="text-muted-foreground">{label}</Badge>;
  return <Badge variant="outline">{label}</Badge>;
}

export function OnboardingTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { role } = useUser();
  const canEdit = role === "owner" || role === "admin" || role === "analyst";
  const { data: docs = [] } = useOnboardingDocuments(clientId);
  const { data: triage = [] } = useOnboardingTriage(clientId);
  const [filter, setFilter] = useState<StaffFilter | "emailed">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const uploaderIds = useMemo(() => [...new Set(docs.map((d) => d.uploaded_by).filter(Boolean))] as string[], [docs]);
  const { data: names = {} } = useQuery({
    queryKey: ["onboarding-uploader-names", uploaderIds.join(",")],
    enabled: uploaderIds.length > 0,
    queryFn: async () => {
      const map: Record<string, string> = {};
      const [{ data: staff }, { data: cu }] = await Promise.all([
        supabase.from("users").select("id, full_name, email").in("id", uploaderIds),
        supabase.from("client_users").select("id, full_name, email").in("id", uploaderIds),
      ]);
      [...(staff ?? []), ...(cu ?? [])].forEach((u: any) => { map[u.id] = u.full_name || u.email; });
      return map;
    },
  });

  const byDoc = useMemo(() => new Map(triage.map((t) => [t.document_id, t])), [triage]);
  const rows = docs.filter((d) => filter === "emailed" ? d.received_via === "email" : matchesFilter(filter, byDoc.get(d.id)));
  const recv = useReceivedState(clientId);
  const label = (d: any) => receivedLabel({ ...d, uploaderName: d.uploaded_by ? names[d.uploaded_by] : null });
  const reviewed = triage.filter((t) => t.reviewed_at).length;
  const openDoc = docs.find((d) => d.id === openId);
  const openTriage = openId ? byDoc.get(openId) : undefined;

  const rerun = async (id: string) => {
    try { await runTriage(id); toast({ title: "Triage finished" }); }
    catch { toast({ title: "Triage failed", variant: "destructive" }); }
    qc.invalidateQueries({ queryKey: ["onboarding-docs", clientId] });
    qc.invalidateQueries({ queryKey: ["onboarding-triage", clientId] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-6 text-sm">
          <div><p className="text-2xl font-semibold">{docs.length}</p><p className="text-muted-foreground">Files received</p></div>
          <div><p className="text-2xl font-semibold">{triage.length - reviewed}</p><p className="text-muted-foreground">Needing review</p></div>
          <div><p className="text-2xl font-semibold">{reviewed}</p><p className="text-muted-foreground">Reviewed</p></div>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setInviteOpen(true)}><Mail className="h-4 w-4 mr-2" />Invite client to upload</Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Invited clients upload at {window.location.origin}/portal/documents. Reviewed documents will feed the company profile in the next phase.
      </p>

      {canEdit && (
        <OnboardingUploader clientId={clientId} kind="staff" received={recv.meta}>
          <ReceivedRow state={recv} />
        </OnboardingUploader>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} className="rounded-full" onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead><TableHead>Received</TableHead><TableHead>Status</TableHead>
                <TableHead>Type</TableHead><TableHead>Relevance</TableHead><TableHead>Destinations</TableHead>
                <TableHead>Reviewed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No documents.</TableCell></TableRow>
              )}
              {rows.map((d) => {
                const t = byDoc.get(d.id);
                return (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => setOpenId(d.id)}>
                    <TableCell>
                      <button className="font-medium text-primary hover:underline text-left"
                        onClick={(e) => { e.stopPropagation(); openSignedUrl(d.file_path).catch(() => toast({ title: "Download failed", variant: "destructive" })); }}>
                        {d.file_name}
                      </button>
                      <p className="text-xs text-muted-foreground">{d.created_at ? format(new Date(d.created_at), "MMM d, yyyy") : ""}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {label(d)}
                    </TableCell>
                    <TableCell><Badge variant={d.status === "failed" ? "destructive" : "secondary"} className="capitalize">{d.status}</Badge></TableCell>
                    <TableCell className="text-sm">{t?.doc_type ? DOC_TYPE_LABELS[t.doc_type as DocType] ?? t.doc_type : "—"}</TableCell>
                    <TableCell className="text-sm capitalize">{t?.relevance ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {effectiveDestinations(t).map((x) => <DestBadge key={x} d={x} />)}
                        {t?.requires_cleaning && (
                          <Badge variant="outline" className="border-destructive/50 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />Needs cleaning</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{t?.reviewed_at ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {openDoc && (
            <>
              <SheetHeader><SheetTitle className="break-all">{openDoc.file_name}</SheetTitle></SheetHeader>
              <div className="mt-4"><Field label="Received">{label(openDoc)}</Field></div>
              {openTriage ? (
                <TriageDetail key={openTriage.id + (openTriage.reviewed_at ?? "")} triage={openTriage} clientId={clientId} canEdit={canEdit} onRerun={() => rerun(openDoc.id)} />
              ) : (
                <div className="mt-6 space-y-3 text-sm">
                  <p className="text-muted-foreground">{openDoc.status === "failed" ? openDoc.error ?? "Triage failed." : "Not triaged yet."}</p>
                  {canEdit && <Button size="sm" onClick={() => rerun(openDoc.id)}><RefreshCw className="h-4 w-4 mr-1" />Run triage</Button>}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <InviteClientUserDialog clientId={clientId} open={inviteOpen} onOpenChange={setInviteOpen} redirectTo="/portal/documents" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p><div className="mt-1 text-sm">{children}</div></div>;
}

function TriageDetail({ triage: t, clientId, canEdit, onRerun }: { triage: any; clientId: string; canEdit: boolean; onRerun: () => void }) {
  const [dests, setDests] = useState<string[]>(effectiveDestinations(t));
  const [note, setNote] = useState<string>(t.review_note ?? "");
  const confirm = useConfirmReview(clientId);
  const sens = (t.sensitivity ?? {}) as Record<string, any>;
  const detected = (sens.detected ?? {}) as Record<string, string[]>;
  const flags: { key: string; label: string; ev?: string }[] = [
    { key: "pricing", label: "Pricing", ev: "pricing" },
    { key: "personal_data", label: "Personal data", ev: "personal_data" },
    { key: "signatures", label: "Signatures", ev: "signatures" },
    { key: "bid_specific", label: "Bid-specific", ev: "solicitation_numbers" },
  ];

  return (
    <div className="mt-6 space-y-5">
      <Field label="Title">{t.title || "—"}</Field>
      <Field label="Summary">{t.summary || "—"}</Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Document date">{t.document_date || "—"}</Field>
        <Field label="Type">{DOC_TYPE_LABELS[t.doc_type as DocType] ?? t.doc_type ?? "—"}</Field>
      </div>
      <Field label="Solicitation numbers">{t.solicitation_numbers?.length ? t.solicitation_numbers.join(", ") : "—"}</Field>
      <Field label="Useful for">
        <div className="flex flex-wrap gap-1">{(t.useful_for ?? []).map((u: string) => <Badge key={u} variant="outline">{u.replace(/_/g, " ")}</Badge>)}</div>
      </Field>
      <Field label="Sensitivity">
        <ul className="space-y-1">
          {flags.map((f) => (
            <li key={f.key} className={cn(sens[f.key] ? "text-destructive" : "text-muted-foreground")}>
              {sens[f.key] ? "Yes" : "No"} — {f.label}
              {sens[f.key] && detected[f.ev!]?.length ? (
                <span className="block text-xs text-muted-foreground">Evidence: {detected[f.ev!].slice(0, 5).join("; ")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Field>
      {t.reasons?.length > 0 && <Field label="Reasons"><ul className="list-disc pl-5 space-y-1">{t.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></Field>}
      {t.notes && <Field label="AI notes">{t.notes}</Field>}

      <div className="border-t pt-4 space-y-3">
        <p className="font-medium">Review</p>
        {DESTS.map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm">
            <Checkbox disabled={!canEdit} checked={dests.includes(d)}
              onCheckedChange={(c) => setDests((p) => (c ? [...p, d] : p.filter((x) => x !== d)))} />
            {DESTINATION_LABELS[d]}
          </label>
        ))}
        <div className="space-y-1">
          <Label>Review note (optional)</Label>
          <Textarea disabled={!canEdit} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </div>
        {t.reviewed_at && <p className="text-xs text-muted-foreground">Reviewed {format(new Date(t.reviewed_at), "MMM d, yyyy h:mm a")}</p>}
        {canEdit && (
          <div className="flex gap-2">
            <Button disabled={confirm.isPending}
              onClick={() => confirm.mutate({ triageId: t.id, destinations: dests, note },
                { onSuccess: () => toast({ title: "Review saved" }), onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }) })}>
              Confirm review
            </Button>
            <Button variant="outline" onClick={onRerun}><RefreshCw className="h-4 w-4 mr-1" />Re-run triage</Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Reviewed documents will feed the company profile in the next phase.</p>
      </div>
    </div>
  );
}
