import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Revision } from "../hooks/useRevisions";

type Props = {
  revisions: Revision[];
  aId: string | null;
  bId: string | null;
  onChange: (next: { aId: string | null; bId: string | null }) => void;
};

export function RevisionPicker({ revisions, aId, bId, onChange }: Props) {
  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div className="space-y-1">
        <Label className="text-xs">Compare from (A)</Label>
        <Select value={aId ?? ""} onValueChange={(v) => onChange({ aId: v || null, bId })}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Pick a revision" /></SelectTrigger>
          <SelectContent>
            {revisions.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="text-muted-foreground pb-2">→</div>
      <div className="space-y-1">
        <Label className="text-xs">To (B)</Label>
        <Select value={bId ?? ""} onValueChange={(v) => onChange({ aId, bId: v || null })}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Pick a revision" /></SelectTrigger>
          <SelectContent>
            {revisions.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
