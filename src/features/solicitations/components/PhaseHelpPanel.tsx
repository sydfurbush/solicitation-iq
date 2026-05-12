import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BookOpen, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PhaseType } from "@/lib/validators/solicitation";
import { phase1Doc } from "../help/phase1";
import { phase2Doc } from "../help/phase2";
import { phase3Doc } from "../help/phase3";
import { phase4Doc } from "../help/phase4";

const DOCS = {
  phase_1_initial: phase1Doc,
  phase_2_deep_dive: phase2Doc,
  phase_3_outline: phase3Doc,
  phase_4_win_themes: phase4Doc,
} as const;

const PHASE_NUM: Record<PhaseType, number> = {
  phase_1_initial: 1,
  phase_2_deep_dive: 2,
  phase_3_outline: 3,
  phase_4_win_themes: 4,
};

export const PHASE_COLOR_TEXT: Record<PhaseType, string> = {
  phase_1_initial: "text-[hsl(var(--phase-1))]",
  phase_2_deep_dive: "text-[hsl(var(--phase-2))]",
  phase_3_outline: "text-[hsl(var(--phase-3))]",
  phase_4_win_themes: "text-[hsl(var(--phase-4))]",
};

export const PHASE_COLOR_BG: Record<PhaseType, string> = {
  phase_1_initial: "bg-[hsl(var(--phase-1))]",
  phase_2_deep_dive: "bg-[hsl(var(--phase-2))]",
  phase_3_outline: "bg-[hsl(var(--phase-3))]",
  phase_4_win_themes: "bg-[hsl(var(--phase-4))]",
};

export const PHASE_COLOR_BORDER: Record<PhaseType, string> = {
  phase_1_initial: "border-[hsl(var(--phase-1))]",
  phase_2_deep_dive: "border-[hsl(var(--phase-2))]",
  phase_3_outline: "border-[hsl(var(--phase-3))]",
  phase_4_win_themes: "border-[hsl(var(--phase-4))]",
};

export const PHASE_COLOR_SOFT: Record<PhaseType, string> = {
  phase_1_initial: "bg-[hsl(var(--phase-1)/0.12)]",
  phase_2_deep_dive: "bg-[hsl(var(--phase-2)/0.12)]",
  phase_3_outline: "bg-[hsl(var(--phase-3)/0.12)]",
  phase_4_win_themes: "bg-[hsl(var(--phase-4)/0.12)]",
};

export function PhaseHelpPanel({
  phase,
  size = "sm",
  label,
}: {
  phase: PhaseType;
  size?: "xs" | "sm";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const doc = DOCS[phase];
  const Body = doc.Body;
  const num = PHASE_NUM[phase];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          size === "xs" ? "h-6 w-6" : "h-7 w-7",
          PHASE_COLOR_TEXT[phase],
          "hover:bg-muted",
        )}
        title={`How Phase ${num} works`}
        aria-label={label ?? `Help: ${doc.title}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <BookOpen className={size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </Button>

      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b" data-print="hide">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white",
                PHASE_COLOR_BG[phase],
              )}
            >
              {num}
            </span>
            <div className="flex-1 text-left">
              <SheetTitle className="text-base">{doc.title}</SheetTitle>
              <SheetDescription className="text-xs">{doc.summary}</SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div id="phase-help-printable" className="p-6 space-y-6">
            <div className="hidden print:block mb-4">
              <h1 className="text-2xl font-bold">{doc.title}</h1>
              <p className="text-sm text-muted-foreground">{doc.summary}</p>
            </div>
            <Body />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
