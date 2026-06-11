import { UserCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERSONAS, type PersonaKey } from "../lib/personas";

type Props = {
  value: PersonaKey;
  onChange: (next: PersonaKey) => void;
  disabled?: boolean;
};

export function PersonaSelector({ value, onChange, disabled }: Props) {
  const current = PERSONAS.find((p) => p.key === value) ?? PERSONAS[0];
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PersonaKey)} disabled={disabled}>
      <SelectTrigger className="h-auto min-h-[3rem] w-[300px] py-1.5 text-xs [&>span]:flex-1">
        <UserCircle2 className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
        <SelectValue asChild>
          <div className="flex flex-col items-start text-left leading-tight">
            <span className="text-xs font-medium whitespace-nowrap">{current.label}</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[240px]">
              {current.description}
            </span>
          </div>
        </SelectValue>
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
