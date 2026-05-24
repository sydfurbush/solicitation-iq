import { cn } from "@/lib/utils";
import { STATUS_COLOR_VAR, STATUS_LABEL, type DraftStatus } from "../utils/draftStatus";

interface Props {
  status: DraftStatus;
  className?: string;
  title?: string;
}

export function SectionStatusDot({ status, className, title }: Props) {
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full shrink-0", status === "none" && "ring-1 ring-inset ring-border", className)}
      style={{ backgroundColor: `hsl(var(${STATUS_COLOR_VAR[status]}))` }}
      title={title ?? STATUS_LABEL[status]}
      aria-label={STATUS_LABEL[status]}
    />
  );
}
