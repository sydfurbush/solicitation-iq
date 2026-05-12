import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Search, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useClients } from "@/features/clients/hooks/useClients";
import {
  PHASES,
  SOLICITATION_STATUSES,
  type SolicitationStatus,
} from "@/lib/validators/solicitation";
import { STATUS_LABELS } from "../lib/format";
import type { SolicitationFilters } from "../hooks/useSolicitations";

const PRESETS_KEY = "solicitation-filter-presets";

interface Props {
  value: SolicitationFilters;
  onChange: (v: SolicitationFilters) => void;
}

interface Preset {
  name: string;
  filters: SolicitationFilters;
}

export function SolicitationFilters({ value, onChange }: Props) {
  const { data: clients = [] } = useClients();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (raw) setPresets(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const savePresets = (next: Preset[]) => {
    setPresets(next);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  };

  const set = (patch: Partial<SolicitationFilters>) => onChange({ ...value, ...patch });

  const clear = () => onChange({});

  const toggleStatus = (s: SolicitationStatus) => {
    const list = new Set(value.statuses ?? []);
    if (list.has(s)) list.delete(s);
    else list.add(s);
    set({ statuses: Array.from(list) });
  };

  const toggleClient = (id: string) => {
    const list = new Set(value.clientIds ?? []);
    if (list.has(id)) list.delete(id);
    else list.add(id);
    set({ clientIds: Array.from(list) });
  };

  const togglePhase = (p: string) => {
    const list = new Set(value.phases ?? []);
    if (list.has(p)) list.delete(p);
    else list.add(p);
    set({ phases: Array.from(list) });
  };

  const hasFilters =
    !!value.search ||
    (value.clientIds?.length ?? 0) > 0 ||
    (value.statuses?.length ?? 0) > 0 ||
    (value.phases?.length ?? 0) > 0 ||
    !!value.dueFrom ||
    !!value.dueTo;

  return (
    <div className="space-y-3 p-4 border rounded-md bg-muted/20">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search title, number, agency..."
            className="pl-8"
            value={value.search ?? ""}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>

        <Select
          value=""
          onValueChange={(v) => {
            if (v === "__clear__") set({ clientIds: [] });
            else toggleClient(v);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={`Clients${value.clientIds?.length ? ` (${value.clientIds.length})` : ""}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">Clear clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {value.clientIds?.includes(c.id) ? "✓ " : ""}
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value=""
          onValueChange={(v) => {
            if (v === "__clear__") set({ phases: [] });
            else togglePhase(v);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={`Phase${value.phases?.length ? ` (${value.phases.length})` : ""}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">Clear phases</SelectItem>
            {PHASES.map((p) => (
              <SelectItem key={p} value={p}>
                {value.phases?.includes(p) ? "✓ " : ""}
                {p.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangeButton
          label="Due from"
          value={value.dueFrom}
          onChange={(v) => set({ dueFrom: v })}
        />
        <DateRangeButton
          label="Due to"
          value={value.dueTo}
          onChange={(v) => set({ dueTo: v })}
        />

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-primary"
            checked={!!value.includeDeleted}
            onChange={(e) => set({ includeDeleted: e.target.checked })}
          />
          Show deleted
        </label>

        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clear}>
            Clear all
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SOLICITATION_STATUSES.map((s) => {
          const active = value.statuses?.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border"
              )}
            >
              {STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
        <Label className="text-xs text-muted-foreground">Presets</Label>
        {presets.map((p) => (
          <Badge key={p.name} variant="secondary" className="gap-1 cursor-pointer" onClick={() => onChange(p.filters)}>
            {p.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                savePresets(presets.filter((x) => x.name !== p.name));
              }}
              className="hover:text-destructive"
              aria-label={`Remove preset ${p.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <Input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            className="h-7 w-32 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={!presetName.trim() || !hasFilters}
            onClick={() => {
              const name = presetName.trim();
              savePresets([...presets.filter((p) => p.name !== name), { name, filters: value }]);
              setPresetName("");
            }}
          >
            <Save className="h-3 w-3 mr-1" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function DateRangeButton({
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
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(!date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "MMM d, yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(d ? d.toISOString() : undefined)}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        {date && (
          <div className="p-2 border-t">
            <Button size="sm" variant="ghost" className="w-full" onClick={() => onChange(undefined)}>
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
