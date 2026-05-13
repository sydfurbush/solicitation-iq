import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Check,
  DollarSign,
  FileText,
  Pencil,
  Sparkles,
  Tag,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatRange } from "../lib/format";
import {
  useUpdateSolicitation,
  type SolicitationRow,
  type SolicitationUpdateInput,
} from "../hooks/useSolicitations";
import {
  AGENCY_TYPES,
  CONTRACT_TYPES,
  SET_ASIDE_TYPES,
} from "@/lib/validators/solicitation";

interface Props {
  solicitation: SolicitationRow;
  onUploadDocs?: () => void;
  onRunAnalysis?: () => void;
  onGenerateQuestions?: () => void;
}

function DateRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">
        {value ? format(new Date(value), "MMM d, yyyy") : "—"}
      </span>
    </div>
  );
}

function InlineDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const date = value ? new Date(value) : undefined;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("h-8 text-xs", !date && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-3 w-3" />
            {date ? format(date, "MMM d, yyyy") : "Pick a date"}
            {date && (
              <X
                className="ml-2 h-3 w-3 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(undefined);
                }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => onChange(d ? d.toISOString() : undefined)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function EditHeader({
  title,
  icon,
  editing,
  onEdit,
  onSave,
  onCancel,
  saving,
}: {
  title: string;
  icon?: React.ReactNode;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
      <CardTitle className="text-sm flex items-center gap-2">
        {icon}
        {title}
      </CardTitle>
      {!editing ? (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit} aria-label={`Edit ${title}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onCancel} aria-label="Cancel">
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onSave}
            disabled={saving}
            aria-label="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </CardHeader>
  );
}

export function SolicitationOverview({
  solicitation: s,
  onUploadDocs,
  onRunAnalysis,
  onGenerateQuestions,
}: Props) {
  const updateMut = useUpdateSolicitation();
  const setAside = (s as { set_aside?: string | null }).set_aside ?? null;

  const [editing, setEditing] = useState<
    null | "dates" | "financials" | "incumbent" | "tags" | "summary"
  >(null);

  const save = async (patch: SolicitationUpdateInput, label = "Saved") => {
    try {
      await updateMut.mutateAsync({ id: s.id, input: patch });
      toast({ title: label });
      setEditing(null);
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  // ---- Dates ----
  const [dates, setDates] = useState({
    release_date: s.release_date ?? "",
    questions_due_date: s.questions_due_date ?? "",
    proposal_due_date: s.proposal_due_date ?? "",
    expected_award_date: s.expected_award_date ?? "",
    period_of_performance_start: s.period_of_performance_start ?? "",
    period_of_performance_end: s.period_of_performance_end ?? "",
  });
  const startDates = () => {
    setDates({
      release_date: s.release_date ?? "",
      questions_due_date: s.questions_due_date ?? "",
      proposal_due_date: s.proposal_due_date ?? "",
      expected_award_date: s.expected_award_date ?? "",
      period_of_performance_start: s.period_of_performance_start ?? "",
      period_of_performance_end: s.period_of_performance_end ?? "",
    });
    setEditing("dates");
  };

  // ---- Financials ----
  const [fin, setFin] = useState({
    estimated_value_low: s.estimated_value_low ?? undefined as number | undefined,
    estimated_value_high: s.estimated_value_high ?? undefined as number | undefined,
    contract_type: s.contract_type ?? "",
    agency_type: s.agency_type ?? "",
    set_aside: setAside ?? "",
  });
  const startFin = () => {
    setFin({
      estimated_value_low: s.estimated_value_low ?? undefined,
      estimated_value_high: s.estimated_value_high ?? undefined,
      contract_type: s.contract_type ?? "",
      agency_type: s.agency_type ?? "",
      set_aside: setAside ?? "",
    });
    setEditing("financials");
  };

  // ---- Incumbent ----
  const [inc, setInc] = useState({
    has_incumbent: s.has_incumbent ?? false,
    incumbent_name: s.incumbent_name ?? "",
    incumbent_contract_number: s.incumbent_contract_number ?? "",
    incumbent_contract_value: s.incumbent_contract_value ?? undefined as number | undefined,
    incumbent_performance_notes: s.incumbent_performance_notes ?? "",
  });
  const startInc = () => {
    setInc({
      has_incumbent: s.has_incumbent ?? false,
      incumbent_name: s.incumbent_name ?? "",
      incumbent_contract_number: s.incumbent_contract_number ?? "",
      incumbent_contract_value: s.incumbent_contract_value ?? undefined,
      incumbent_performance_notes: s.incumbent_performance_notes ?? "",
    });
    setEditing("incumbent");
  };

  // ---- Tags ----
  const [tagsDraft, setTagsDraft] = useState<string[]>(s.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const startTags = () => {
    setTagsDraft(s.tags ?? []);
    setTagInput("");
    setEditing("tags");
  };
  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tagsDraft.includes(t) || tagsDraft.length >= 20) return;
    setTagsDraft([...tagsDraft, t]);
    setTagInput("");
  };

  // ---- AI summary ----
  const [summaryDraft, setSummaryDraft] = useState(s.ai_summary ?? "");
  const startSummary = () => {
    setSummaryDraft(s.ai_summary ?? "");
    setEditing("summary");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        {/* Key dates */}
        <Card>
          <EditHeader
            title="Key dates"
            icon={<CalendarIcon className="h-4 w-4" />}
            editing={editing === "dates"}
            onEdit={startDates}
            onCancel={() => setEditing(null)}
            saving={updateMut.isPending}
            onSave={() =>
              save(
                {
                  release_date: dates.release_date || undefined,
                  questions_due_date: dates.questions_due_date || undefined,
                  proposal_due_date: dates.proposal_due_date || undefined,
                  expected_award_date: dates.expected_award_date || undefined,
                  period_of_performance_start: dates.period_of_performance_start || undefined,
                  period_of_performance_end: dates.period_of_performance_end || undefined,
                },
                "Dates updated"
              )
            }
          />
          <CardContent>
            {editing === "dates" ? (
              <>
                <InlineDate
                  label="Released"
                  value={dates.release_date}
                  onChange={(v) => setDates({ ...dates, release_date: v ?? "" })}
                />
                <InlineDate
                  label="Questions due"
                  value={dates.questions_due_date}
                  onChange={(v) => setDates({ ...dates, questions_due_date: v ?? "" })}
                />
                <InlineDate
                  label="Proposal due"
                  value={dates.proposal_due_date}
                  onChange={(v) => setDates({ ...dates, proposal_due_date: v ?? "" })}
                />
                <InlineDate
                  label="Expected award"
                  value={dates.expected_award_date}
                  onChange={(v) => setDates({ ...dates, expected_award_date: v ?? "" })}
                />
                <InlineDate
                  label="PoP start"
                  value={dates.period_of_performance_start}
                  onChange={(v) => setDates({ ...dates, period_of_performance_start: v ?? "" })}
                />
                <InlineDate
                  label="PoP end"
                  value={dates.period_of_performance_end}
                  onChange={(v) => setDates({ ...dates, period_of_performance_end: v ?? "" })}
                />
              </>
            ) : (
              <>
                <DateRow label="Released" value={s.release_date} />
                <DateRow label="Questions due" value={s.questions_due_date} />
                <DateRow label="Proposal due" value={s.proposal_due_date} />
                <DateRow label="Expected award" value={s.expected_award_date} />
                <DateRow label="PoP start" value={s.period_of_performance_start} />
                <DateRow label="PoP end" value={s.period_of_performance_end} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Financials */}
        <Card>
          <EditHeader
            title="Financials"
            icon={<DollarSign className="h-4 w-4" />}
            editing={editing === "financials"}
            onEdit={startFin}
            onCancel={() => setEditing(null)}
            saving={updateMut.isPending}
            onSave={() => {
              if (
                fin.estimated_value_low !== undefined &&
                fin.estimated_value_high !== undefined &&
                fin.estimated_value_low > fin.estimated_value_high
              ) {
                toast({ title: "High must be ≥ low", variant: "destructive" });
                return;
              }
              save(
                {
                  estimated_value_low: fin.estimated_value_low,
                  estimated_value_high: fin.estimated_value_high,
                  contract_type: (fin.contract_type || undefined) as
                    | (typeof CONTRACT_TYPES)[number]
                    | undefined,
                  agency_type: (fin.agency_type || undefined) as
                    | (typeof AGENCY_TYPES)[number]
                    | undefined,
                  set_aside: (fin.set_aside || undefined) as
                    | (typeof SET_ASIDE_TYPES)[number]
                    | undefined,
                },
                "Financials updated"
              );
            }}
          />
          <CardContent className="space-y-3 text-sm">
            {editing === "financials" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Value low</Label>
                    <Input
                      type="number"
                      min={0}
                      value={fin.estimated_value_low ?? ""}
                      onChange={(e) =>
                        setFin({
                          ...fin,
                          estimated_value_low:
                            e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Value high</Label>
                    <Input
                      type="number"
                      min={0}
                      value={fin.estimated_value_high ?? ""}
                      onChange={(e) =>
                        setFin({
                          ...fin,
                          estimated_value_high:
                            e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Contract type</Label>
                  <Select
                    value={fin.contract_type}
                    onValueChange={(v) => setFin({ ...fin, contract_type: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Agency type</Label>
                  <Select
                    value={fin.agency_type}
                    onValueChange={(v) => setFin({ ...fin, agency_type: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {AGENCY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Set-aside</Label>
                  <Select
                    value={fin.set_aside}
                    onValueChange={(v) => setFin({ ...fin, set_aside: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {SET_ASIDE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated value</span>
                  <span className="font-medium">
                    {formatRange(s.estimated_value_low, s.estimated_value_high)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contract type</span>
                  <span className="font-medium">{s.contract_type ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agency type</span>
                  <span className="font-medium">{s.agency_type ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Set-aside</span>
                  <span className="font-medium">{setAside ?? "—"}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Incumbent (always shown so users can toggle has_incumbent on) */}
        <Card>
          <EditHeader
            title="Incumbent"
            editing={editing === "incumbent"}
            onEdit={startInc}
            onCancel={() => setEditing(null)}
            saving={updateMut.isPending}
            onSave={() =>
              save(
                {
                  has_incumbent: inc.has_incumbent,
                  incumbent_name: inc.has_incumbent ? inc.incumbent_name || undefined : undefined,
                  incumbent_contract_number: inc.has_incumbent
                    ? inc.incumbent_contract_number || undefined
                    : undefined,
                  incumbent_contract_value: inc.has_incumbent
                    ? inc.incumbent_contract_value
                    : undefined,
                  incumbent_performance_notes: inc.has_incumbent
                    ? inc.incumbent_performance_notes || undefined
                    : undefined,
                },
                "Incumbent updated"
              )
            }
          />
          <CardContent className="space-y-3 text-sm">
            {editing === "incumbent" ? (
              <>
                <div className="flex items-center justify-between rounded-md border p-2">
                  <Label className="text-sm">Has incumbent</Label>
                  <Switch
                    checked={inc.has_incumbent}
                    onCheckedChange={(v) => setInc({ ...inc, has_incumbent: v })}
                  />
                </div>
                {inc.has_incumbent && (
                  <>
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={inc.incumbent_name}
                        onChange={(e) => setInc({ ...inc, incumbent_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Contract #</Label>
                      <Input
                        value={inc.incumbent_contract_number}
                        onChange={(e) =>
                          setInc({ ...inc, incumbent_contract_number: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Value</Label>
                      <Input
                        type="number"
                        min={0}
                        value={inc.incumbent_contract_value ?? ""}
                        onChange={(e) =>
                          setInc({
                            ...inc,
                            incumbent_contract_value:
                              e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Performance notes</Label>
                      <Textarea
                        rows={3}
                        value={inc.incumbent_performance_notes}
                        onChange={(e) =>
                          setInc({ ...inc, incumbent_performance_notes: e.target.value })
                        }
                      />
                    </div>
                  </>
                )}
              </>
            ) : s.has_incumbent ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{s.incumbent_name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contract #</span>
                  <span className="font-medium font-mono text-xs">
                    {s.incumbent_contract_number ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Value</span>
                  <span className="font-medium">
                    {formatCurrency(s.incumbent_contract_value)}
                  </span>
                </div>
                {s.incumbent_performance_notes && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Performance notes</p>
                    <p className="text-sm whitespace-pre-wrap">{s.incumbent_performance_notes}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No incumbent recorded.</p>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <EditHeader
            title="Tags"
            icon={<Tag className="h-4 w-4" />}
            editing={editing === "tags"}
            onEdit={startTags}
            onCancel={() => setEditing(null)}
            saving={updateMut.isPending}
            onSave={() => save({ tags: tagsDraft }, "Tags updated")}
          />
          <CardContent>
            {editing === "tags" ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    placeholder="Add a tag"
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tagsDraft.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button
                        type="button"
                        aria-label={`Remove ${t}`}
                        onClick={() => setTagsDraft(tagsDraft.filter((x) => x !== t))}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : s.tags && s.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {s.tags.map((t) => (
                  <Badge key={t} variant="secondary">{t}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tags.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-6">
        {/* AI summary */}
        <Card>
          <EditHeader
            title="AI summary"
            icon={<Sparkles className="h-4 w-4" />}
            editing={editing === "summary"}
            onEdit={startSummary}
            onCancel={() => setEditing(null)}
            saving={updateMut.isPending}
            onSave={() => save({ ai_summary: summaryDraft || null }, "Summary updated")}
          />
          <CardContent>
            {editing === "summary" ? (
              <Textarea
                rows={8}
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                placeholder="Write or paste the summary..."
              />
            ) : s.ai_summary ? (
              <p className="text-sm whitespace-pre-wrap">{s.ai_summary}</p>
            ) : (
              <div className="text-sm text-muted-foreground py-6 text-center border-2 border-dashed rounded-md">
                Analysis not yet run. Upload documents and run analysis to generate a summary.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Key requirements</CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(s.key_requirements) && s.key_requirements.length > 0 ? (
                (() => {
                  const reqs = s.key_requirements as Array<{
                    text?: string;
                    title?: string;
                    priority?: "critical" | "high" | "medium" | "low";
                    category?: string;
                    source?: { section?: string; page?: number };
                  }>;
                  const PRIORITY_CLASSES: Record<string, string> = {
                    critical: "bg-destructive/15 text-destructive border-destructive/20",
                    high: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
                    medium: "bg-primary/10 text-primary border-primary/20",
                    low: "bg-muted text-muted-foreground border-border",
                  };
                  const visible = reqs.slice(0, 5);
                  const remaining = reqs.length - visible.length;
                  return (
                    <ul className="space-y-3 text-sm">
                      {visible.map((r, i) => {
                        const label = r.text ?? r.title ?? `Requirement ${i + 1}`;
                        const cite = [r.source?.section, r.source?.page ? `p. ${r.source.page}` : null]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <li key={i} className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {r.priority && (
                                <Badge
                                  variant="outline"
                                  className={cn("text-[10px] capitalize", PRIORITY_CLASSES[r.priority])}
                                >
                                  {r.priority}
                                </Badge>
                              )}
                              {r.category && (
                                <Badge variant="secondary" className="text-[10px] capitalize">
                                  {r.category}
                                </Badge>
                              )}
                            </div>
                            <p className="leading-snug">{label}</p>
                            {cite && (
                              <p className="text-[11px] text-muted-foreground">{cite}</p>
                            )}
                          </li>
                        );
                      })}
                      {remaining > 0 && (
                        <li>
                          <Link
                            to={`/solicitations/${s.id}?tab=analysis`}
                            className="text-xs text-primary hover:underline"
                          >
                            +{remaining} more in Analysis →
                          </Link>
                        </li>
                      )}
                    </ul>
                  );
                })()
              ) : (
                <p className="text-sm text-muted-foreground">No requirements extracted yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Evaluation factors</CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(s.evaluation_factors) && s.evaluation_factors.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {(s.evaluation_factors as Array<{ name?: string; weight?: number }>).map((f, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{f.name ?? `Factor ${i + 1}`}</span>
                      {f.weight != null && (
                        <span className="text-muted-foreground">{f.weight}%</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No factors extracted yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <LensOverridePanel solicitationId={s.id} clientId={s.client_id} />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onUploadDocs}>
              <Upload className="mr-2 h-4 w-4" /> Upload documents
            </Button>
            <Button variant="outline" onClick={onRunAnalysis}>
              <Wand2 className="mr-2 h-4 w-4" /> Run analysis
            </Button>
            <Button variant="outline" onClick={onGenerateQuestions}>
              <FileText className="mr-2 h-4 w-4" /> Generate questions
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
