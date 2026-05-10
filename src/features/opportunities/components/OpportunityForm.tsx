import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  opportunitySchema,
  OPPORTUNITY_TYPES,
  type OpportunityFormValues,
} from "@/lib/validators/riskOpportunity";
import {
  OPPORTUNITY_LABEL,
  type OpportunityType,
} from "@/features/risks/utils/riskHelpers";
import type { OpportunityRow } from "@/features/opportunities/hooks/useOpportunities";

interface Props {
  initial?: Partial<OpportunityRow>;
  documents: Array<{ id: string; file_name: string }>;
  onSubmit: (values: OpportunityFormValues) => void;
  onCancel?: () => void;
  submitting?: boolean;
}

export function OpportunityForm({ initial, documents, onSubmit, onCancel, submitting }: Props) {
  const [values, setValues] = useState<OpportunityFormValues>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    opportunity_type: ((initial?.opportunity_type ?? "innovation") as OpportunityType),
    impact_score: initial?.impact_score ?? 50,
    source_document_id: initial?.source_document_id ?? null,
    source_citation: initial?.source_citation ?? "",
    source_quote: initial?.source_quote ?? "",
    recommended_approach: initial?.recommended_approach ?? "",
    client_capability_match: initial?.client_capability_match ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = opportunitySchema.safeParse(values);
    if (!result.success) {
      const flat: Record<string, string> = {};
      result.error.issues.forEach((i) => { flat[i.path.join(".")] = i.message; });
      setErrors(flat);
      return;
    }
    setErrors({});
    onSubmit(result.data);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
          placeholder="Brief opportunity title"
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          rows={3}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          placeholder="What is the opportunity and its potential impact?"
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={values.opportunity_type}
            onValueChange={(v) => setValues({ ...values, opportunity_type: v as OpportunityType })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPPORTUNITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{OPPORTUNITY_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Source document</Label>
          <Select
            value={values.source_document_id ?? "none"}
            onValueChange={(v) => setValues({ ...values, source_document_id: v === "none" ? null : v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {documents.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.file_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Impact score</Label>
          <span className="text-sm font-semibold">{values.impact_score}/100</span>
        </div>
        <Slider
          min={1}
          max={100}
          step={1}
          value={[values.impact_score]}
          onValueChange={([v]) => setValues({ ...values, impact_score: v })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Source citation</Label>
        <Input
          value={values.source_citation ?? ""}
          onChange={(e) => setValues({ ...values, source_citation: e.target.value })}
          placeholder="e.g., Section 3.2, p.12"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Source quote</Label>
        <Textarea
          rows={2}
          value={values.source_quote ?? ""}
          onChange={(e) => setValues({ ...values, source_quote: e.target.value })}
          placeholder="Verbatim quote from the source"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Recommended approach</Label>
        <Textarea
          rows={3}
          value={values.recommended_approach ?? ""}
          onChange={(e) => setValues({ ...values, recommended_approach: e.target.value })}
          placeholder="How can the proposer capitalize on this?"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Client capability match</Label>
        <Textarea
          rows={2}
          value={values.client_capability_match ?? ""}
          onChange={(e) => setValues({ ...values, client_capability_match: e.target.value })}
          placeholder="Which client capabilities map to this opportunity?"
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save opportunity"}
        </Button>
      </div>
    </form>
  );
}
