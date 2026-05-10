import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePresence } from "../hooks/usePresence";

interface Props {
  solicitationId: string;
  max?: number;
  className?: string;
}

export function TeamPresence({ solicitationId, max = 4, className }: Props) {
  const present = usePresence(solicitationId);
  if (present.length === 0) return null;
  const visible = present.slice(0, max);
  const extra = present.length - visible.length;

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("flex -space-x-2", className)}>
        {visible.map((p) => (
          <Tooltip key={p.user_id}>
            <TooltipTrigger asChild>
              <div className="relative">
                <Avatar className="h-7 w-7 border-2 border-background">
                  {p.avatar_url && <AvatarImage src={p.avatar_url} alt="" />}
                  <AvatarFallback className="text-[10px]">
                    {(p.full_name ?? p.email ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-background" />
              </div>
            </TooltipTrigger>
            <TooltipContent>{p.full_name ?? p.email ?? "Someone"}</TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && (
          <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium">
            +{extra}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
