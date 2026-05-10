import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  riskSchema,
  RISK_SEVERITIES,
  type RiskFormValues,
} from "@/lib/validators/riskOpportunity";
import { SEVERITY_LABEL, type RiskSeverity } from "@/features/risks/utils/riskHelpers";
import type { RiskRow } from "@/features/risks/hooks/useRisks";

interface Props {
  initial?: Partial<RiskRow>;
  documents: Array<{ id: string; file_name: string }>;
  onSubmit: (values: RiskFormValues) => void;
  onCancel?: () => void;
  submitting?: boolean;
}

export function RiskForm({ initial, documents, onSubmit, onCancel, submitting }: Props) {
  const [values, setValues] = useState<RiskFormValues>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    severity: ((initial?.severity ?? "medium") as RiskSeverity),
    source_document_id: initial?.source_document_id ?? null,
    source_citation: initial?.source_citation ?? "",
    source_quote: initial?.source_quote ?? "",
    mitigation_strategy: initial?.mitigation_strategy ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = riskSchema.safeParse(values);
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
          placeholder="Brief risk title"
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          rows={3}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          placeholder="What is the risk and its potential impact?"
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <Select
            value={values.severity}
            onValueChange={(v) => setValues({ ...values, severity: v as RiskSeverity })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RISK_SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>{SEVERITY_LABEL[s]}</SelectItem>
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
        <Label>Mitigation strategy</Label>
        <Textarea
          rows={3}
          value={values.mitigation_strategy ?? ""}
          onChange={(e) => setValues({ ...values, mitigation_strategy: e.target.value })}
          placeholder="How will this risk be mitigated?"
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save risk"}
        </Button>
      </div>
    </form>
  );
}
