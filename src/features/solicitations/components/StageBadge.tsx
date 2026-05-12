import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STAGE_BADGE_CLASSES, STAGE_LABELS, type SolicitationStage } from "../lib/stage";

interface Props {
  stage: SolicitationStage | string | null | undefined;
  label?: string | null;
  className?: string;
}

export function StageBadge({ stage, label, className }: Props) {
  const s = (stage ?? "final") as SolicitationStage;
  const cls = STAGE_BADGE_CLASSES[s] ?? STAGE_BADGE_CLASSES.final;
  const text = label?.trim() ? label : STAGE_LABELS[s] ?? s;
  return (
    <Badge variant="outline" className={cn("uppercase tracking-wide text-[10px]", cls, className)}>
      {text}
    </Badge>
  );
}
