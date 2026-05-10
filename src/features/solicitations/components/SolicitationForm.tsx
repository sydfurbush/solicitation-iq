import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import {
  AGENCY_TYPES,
  CONTRACT_TYPES,
  SET_ASIDE_TYPES,
  solicitationFullSchema,
  type SolicitationFullInput,
} from "@/lib/validators/solicitation";
import { useClients } from "@/features/clients/hooks/useClients";

interface Props {
  defaultValues?: Partial<SolicitationFullInput>;
  onSubmit: (values: SolicitationFullInput, asDraft?: boolean) => Promise<void> | void;
  onDirtyChange?: (dirty: boolean) => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

const STEPS = [
  { id: "basic", label: "Basics" },
  { id: "dates", label: "Dates" },
  { id: "financials", label: "Financials" },
  { id: "tags", label: "Tags & Notes" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const STEP_FIELDS: Record<StepId, (keyof SolicitationFullInput)[]> = {
  basic: ["client_id", "title", "solicitation_number", "issuing_agency", "agency_type", "contract_type", "set_aside"],
  dates: [
    "release_date",
    "questions_due_date",
    "proposal_due_date",
    "expected_award_date",
    "period_of_performance_start",
    "period_of_performance_end",
  ],
  financials: [
    "estimated_value_low",
    "estimated_value_high",
    "has_incumbent",
    "incumbent_name",
    "incumbent_contract_number",
    "incumbent_contract_value",
    "incumbent_performance_notes",
  ],
  tags: ["tags", "notes"],
};

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  const date = value ? new Date(value) : undefined;
  return (
    <FormItem className="flex flex-col">
      <FormLabel>{label}</FormLabel>
      <Popover>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              type="button"
              variant="outline"
              className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : "Pick a date"}
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => onChange(d ? d.toISOString() : undefined)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  );
}

export function SolicitationForm({
  defaultValues,
  onSubmit,
  onDirtyChange,
  submitLabel = "Create solicitation",
  isSubmitting,
}: Props) {
  const { data: clients = [] } = useClients();
  const [step, setStep] = useState<StepId>("basic");

  const form = useForm<SolicitationFullInput>({
    resolver: zodResolver(solicitationFullSchema),
    defaultValues: {
      client_id: defaultValues?.client_id ?? "",
      title: defaultValues?.title ?? "",
      solicitation_number: defaultValues?.solicitation_number ?? "",
      issuing_agency: defaultValues?.issuing_agency ?? "",
      agency_type: defaultValues?.agency_type,
      contract_type: defaultValues?.contract_type,
      set_aside: defaultValues?.set_aside,
      release_date: defaultValues?.release_date ?? "",
      questions_due_date: defaultValues?.questions_due_date ?? "",
      proposal_due_date: defaultValues?.proposal_due_date ?? "",
      expected_award_date: defaultValues?.expected_award_date ?? "",
      period_of_performance_start: defaultValues?.period_of_performance_start ?? "",
      period_of_performance_end: defaultValues?.period_of_performance_end ?? "",
      estimated_value_low: defaultValues?.estimated_value_low,
      estimated_value_high: defaultValues?.estimated_value_high,
      has_incumbent: defaultValues?.has_incumbent ?? false,
      incumbent_name: defaultValues?.incumbent_name ?? "",
      incumbent_contract_number: defaultValues?.incumbent_contract_number ?? "",
      incumbent_contract_value: defaultValues?.incumbent_contract_value,
      incumbent_performance_notes: defaultValues?.incumbent_performance_notes ?? "",
      tags: defaultValues?.tags ?? [],
      notes: defaultValues?.notes ?? "",
    },
  });

  // Notify dirty state for unsaved-changes detection
  const isDirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const hasIncumbent = form.watch("has_incumbent");
  const tags = form.watch("tags") ?? [];
  const [tagInput, setTagInput] = useState("");

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIdx === STEPS.length - 1;

  const goNext = async () => {
    const valid = await form.trigger(STEP_FIELDS[step] as never);
    if (valid) setStep(STEPS[stepIdx + 1].id);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (tags.includes(t) || tags.length >= 20) return;
    form.setValue("tags", [...tags, t], { shouldDirty: true });
    setTagInput("");
  };

  const removeTag = (t: string) => {
    form.setValue("tags", tags.filter((x) => x !== t), { shouldDirty: true });
  };

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => onSubmit(values, false))}
          className="space-y-6"
        >
          <Tabs value={step} onValueChange={(v) => setStep(v as StepId)}>
            <TabsList className="grid grid-cols-4">
              {STEPS.map((s, i) => (
                <TabsTrigger key={s.id} value={s.id} type="button">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px]">
                    {i + 1}
                  </span>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-6">
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.length === 0 && (
                          <div className="px-2 py-3 text-sm text-muted-foreground">
                            No clients yet. Create one first.
                          </div>
                        )}
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Cybersecurity Modernization Services" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="solicitation_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solicitation number</FormLabel>
                      <FormControl>
                        <Input placeholder="W56KGY-25-R-0001" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="issuing_agency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issuing agency</FormLabel>
                      <FormControl>
                        <Input placeholder="Department of Defense" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="agency_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agency type</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || undefined)}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AGENCY_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contract_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract type</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || undefined)}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONTRACT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="set_aside"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract set-aside</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || undefined)}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SET_ASIDE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>

            <TabsContent value="dates" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <FormField
                control={form.control}
                name="release_date"
                render={({ field }) => (
                  <DateField label="Release date" value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
              <FormField
                control={form.control}
                name="questions_due_date"
                render={({ field }) => (
                  <DateField label="Questions due" value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
              <FormField
                control={form.control}
                name="proposal_due_date"
                render={({ field }) => (
                  <DateField label="Proposal due" value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
              <FormField
                control={form.control}
                name="expected_award_date"
                render={({ field }) => (
                  <DateField label="Expected award" value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
              <FormField
                control={form.control}
                name="period_of_performance_start"
                render={({ field }) => (
                  <DateField label="PoP start" value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
              <FormField
                control={form.control}
                name="period_of_performance_end"
                render={({ field }) => (
                  <DateField label="PoP end" value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
            </TabsContent>

            <TabsContent value="financials" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="estimated_value_low"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated value (low)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder="500000"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimated_value_high"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated value (high)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder="1500000"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="has_incumbent"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Has incumbent</FormLabel>
                      <p className="text-xs text-muted-foreground">Is there a current contract holder?</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {hasIncumbent && (
                <div className="space-y-4 rounded-md border p-4 bg-muted/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="incumbent_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Incumbent name</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="incumbent_contract_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract number</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="incumbent_contract_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract value</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="incumbent_performance_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Performance notes</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="tags" className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    placeholder="Add a tag and press Enter"
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
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {tags.map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1">
                        {t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          className="hover:text-destructive"
                          aria-label={`Remove ${t}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial notes</FormLabel>
                    <FormControl>
                      <Textarea rows={5} placeholder="What's important to know?" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              disabled={stepIdx === 0}
              onClick={() => setStep(STEPS[stepIdx - 1].id)}
            >
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={form.handleSubmit((values) => onSubmit(values, true))}
              >
                Save draft
              </Button>
              {!isLast ? (
                <Button type="button" onClick={goNext}>
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : submitLabel}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </FormProvider>
  );
}
