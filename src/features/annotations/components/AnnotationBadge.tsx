import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ANNOTATION_BADGE,
  ANNOTATION_ICON,
  ANNOTATION_LABEL,
  type AnnotationType,
} from "../utils/annotationHelpers";

interface Props {
  type: AnnotationType;
  preview?: string;
  showLabel?: boolean;
  className?: string;
}

export function AnnotationBadge({ type, preview, showLabel, className }: Props) {
  const Icon = ANNOTATION_ICON[type];
  const node = (
    <Badge variant="outline" className={cn("gap-1 border", ANNOTATION_BADGE[type], className)}>
      <Icon className="h-3 w-3" />
      {showLabel && <span className="text-xs">{ANNOTATION_LABEL[type]}</span>}
    </Badge>
  );
  if (!preview) return node;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs font-medium mb-1">{ANNOTATION_LABEL[type]}</p>
          <p className="text-xs text-muted-foreground line-clamp-3">{preview}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
