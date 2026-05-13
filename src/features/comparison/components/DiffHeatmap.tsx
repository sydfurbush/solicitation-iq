import { cn } from "@/lib/utils";
import type { SectionPair } from "../utils/sectionMatcher";

type Props = {
  pairs: SectionPair[];
  onJump?: (index: number) => void;
  className?: string;
};

export function DiffHeatmap({ pairs, onJump, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-[2px] w-2", className)} aria-label="Change heatmap">
      {pairs.map((p, i) => {
        const tone =
          p.status === "added" ? "bg-emerald-500"
          : p.status === "removed" ? "bg-destructive"
          : p.status === "modified" ? "bg-amber-500"
          : "bg-muted";
        const opacity = p.status === "modified" ? 0.3 + Math.min(0.7, p.density) : 1;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onJump?.(i)}
            className={cn("h-2 rounded-sm hover:scale-x-150 transition", tone)}
            style={{ opacity }}
            title={`${p.b?.section_title ?? p.a?.section_title ?? "Section"} — ${p.status}`}
          />
        );
      })}
    </div>
  );
}
