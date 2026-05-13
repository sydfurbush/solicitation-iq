import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ComparisonMode = "incremental" | "cumulative";

type Props = {
  mode: ComparisonMode;
  onChange: (m: ComparisonMode) => void;
};

export function ComparisonModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Baseline:</span>
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && onChange(v as ComparisonMode)}
        size="sm"
      >
        <ToggleGroupItem value="incremental" className="text-xs">Incremental</ToggleGroupItem>
        <ToggleGroupItem value="cumulative" className="text-xs">Cumulative</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
