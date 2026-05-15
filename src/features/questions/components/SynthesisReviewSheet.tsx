import { useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  useSuppressedQuestions,
  useRestoreSuppressedQuestion,
} from "../hooks/useStrategicQuestions";

interface Props {
  solicitationId: string;
}

export function SynthesisReviewSheet({ solicitationId }: Props) {
  const [open, setOpen] = useState(false);
  const { data: suppressed = [], isLoading } = useSuppressedQuestions(solicitationId);
  const restore = useRestoreSuppressedQuestion(solicitationId);

  const handleRestore = async (id: string) => {
    try {
      await restore.mutateAsync(id);
      toast({ title: "Question restored", description: "It is now visible in the main list." });
    } catch (e) {
      toast({
        title: "Restore failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-1" />
          Synthesis review
          {suppressed.length > 0 && (
            <Badge variant="secondary" className="ml-2">{suppressed.length}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Questions hidden by synthesis</SheetTitle>
          <SheetDescription>
            The synthesis pass hid these as duplicates, boilerplate, or self-answering. Restore any
            you want back in the main list.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 mt-4 pr-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && suppressed.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nothing has been suppressed by synthesis on this solicitation.
            </p>
          )}
          <div className="space-y-3">
            {suppressed.map((q) => (
              <div key={q.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {q.synthesis_status === "merged" ? "Merged" : "Removed"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{q.category}</Badge>
                    </div>
                    <p className="text-sm font-medium">{q.question_text}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRestore(q.id)}
                    disabled={restore.isPending}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                  </Button>
                </div>
                {q.synthesis_reason && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Reason:</span> {q.synthesis_reason}
                  </p>
                )}
                {q.source_citation && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Source:</span> {q.source_citation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
