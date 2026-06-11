import { UserCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERSONAS, type PersonaKey } from "../lib/personas";

type Props = {
  value: PersonaKey;
  onChange: (next: PersonaKey) => void;
  disabled?: boolean;
};

export function PersonaSelector({ value, onChange, disabled }: Props) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PersonaKey)} disabled={disabled}>
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <UserCircle2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERSONAS.map((p) => (
          <SelectItem key={p.key} value={p.key} className="text-xs">
            <div className="flex flex-col">
              <span className="font-medium">{p.label}</span>
              <span className="text-[10px] text-muted-foreground">{p.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
