import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import {
  CheckCircle2,
  Send,
  AlertCircle,
  Clock,
  PauseCircle,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  getCategoryColor,
  type QuestionRow,
} from "@/features/questions/utils/questionHelpers";
import {
  DECISION_LABEL,
  decisionBadgeClasses,
  type ClientDecision,
} from "@/features/questions/utils/clientDecisions";
import {
  useUpdateClientDecision,
  useSubmitClientReview,
} from "@/features/questions/hooks/useClientQuestionDecisions";
import { useClientUser } from "../hooks/useClientUser";

interface Props {
  solicitationId: string;
  solicitationTitle?: string | null;
  questionsDueDate?: string | null;
}

const DECISION_OPTIONS: { value: ClientDecision; label: string; icon: typeof Send; tone: string }[] = [
  { value: "clarify", label: "Clarify", icon: Send, tone: "text-emerald-600 dark:text-emerald-400" },
  { value: "hold", label: "Hold", icon: PauseCircle, tone: "text-amber-600 dark:text-amber-400" },
  { value: "remove", label: "Remove", icon: Trash2, tone: "text-destructive" },
  { value: "deferred", label: "Defer", icon: HelpCircle, tone: "text-blue-600 dark:text-blue-400" },
];

export function ClientQuestionTriage({ solicitationId, solicitationTitle, questionsDueDate }: Props) {
  const { clientUser } = useClientUser();

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["portal-questions", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategic_questions")
        .select("*")
        .eq("solicitation_id", solicitationId)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QuestionRow[];
    },
  });

  const decide = useUpdateClientDecision(solicitationId);
  const submit = useSubmitClientReview(solicitationId);

  // Local note state per question (uncommitted edits).
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const grouped = useMemo(() => {
    const map = new Map<string, QuestionRow[]>();
    for (const q of questions) {
      const k = q.category;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(q);
    }
    return Array.from(map.entries());
  }, [questions]);

  const counts = useMemo(() => {
    const c = { total: questions.length, decided: 0, clarify: 0, hold: 0, remove: 0, deferred: 0 };
    for (const q of questions) {
      const d = (q.client_decision ?? "pending") as ClientDecision;
      if (d !== "pending") c.decided += 1;
      if (d === "clarify") c.clarify += 1;
      else if (d === "hold") c.hold += 1;
      else if (d === "remove") c.remove += 1;
      else if (d === "deferred") c.deferred += 1;
    }
    return c;
  }, [questions]);

  const allDecided = counts.total > 0 && counts.decided === counts.total;
  const missingNotes = useMemo(
    () =>
      questions.filter(
        (q) =>
          (q.client_decision ?? "pending") === "clarify" &&
          !((q.client_note ?? noteDrafts[q.id] ?? "").trim()),
      ).length,
    [questions, noteDrafts],
  );

  const daysUntilDue = questionsDueDate
    ? differenceInCalendarDays(new Date(questionsDueDate), new Date())
    : null;

  const handleDecide = async (q: QuestionRow, decision: ClientDecision) => {
    if (!clientUser?.id) return;
    const note =
      decision === "clarify"
        ? noteDrafts[q.id] ?? q.client_note ?? ""
        : q.client_note ?? null;
    if (decision === "clarify" && !note.trim()) {
      toast.error("Add a note explaining your concern before marking Clarify.");
      return;
    }
    try {
      await decide.mutateAsync({
        questionId: q.id,
        decision,
        note: decision === "clarify" ? note : note ?? null,
        clientUserId: clientUser.id,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save decision");
    }
  };

  const handleSaveNote = async (q: QuestionRow) => {
    if (!clientUser?.id) return;
    const note = noteDrafts[q.id] ?? "";
    try {
      await decide.mutateAsync({
        questionId: q.id,
        decision: (q.client_decision ?? "pending") as ClientDecision,
        note,
        clientUserId: clientUser.id,
      });
      toast.success("Note saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save note");
    }
  };

  const handleSubmit = async () => {
    if (!clientUser?.id) return;
    if (!allDecided) {
      toast.error("Decide every question first.");
      return;
    }
    if (missingNotes > 0) {
      toast.error(`${missingNotes} clarification question${missingNotes === 1 ? "" : "s"} need a note.`);
      return;
    }
    try {
      await submit.mutateAsync({
        clientUserId: clientUser.id,
        clientUserName: clientUser.full_name ?? clientUser.email ?? "Client",
      });
      toast.success("Decisions sent to your analyst.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No strategic questions have been generated yet. Your analyst will share them here when ready.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky progress header */}
      <div className="sticky top-0 z-10 -mx-2 px-2 py-3 bg-background/95 backdrop-blur border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">
              Decided {counts.decided} of {counts.total}
              {questionsDueDate && (
                <span className="text-muted-foreground font-normal ml-2">
                  · Questions due {format(new Date(questionsDueDate), "PP")}
                  {daysUntilDue !== null && (
                    <span
                      className={cn(
                        "ml-1",
                        daysUntilDue < 3
                          ? "text-destructive font-medium"
                          : daysUntilDue < 7
                          ? "text-amber-600"
                          : "text-muted-foreground",
                      )}
                    >
                      ({daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : `in ${daysUntilDue} days`})
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {counts.clarify} clarify · {counts.hold} hold · {counts.remove} remove · {counts.deferred} defer
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!allDecided || submit.isPending || missingNotes > 0}
            className="ml-auto"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" /> Send decisions to analyst
          </Button>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${counts.total ? (counts.decided / counts.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {missingNotes > 0 && (
        <Alert variant="default" className="border-amber-500/50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Notes needed</AlertTitle>
          <AlertDescription>
            {missingNotes} question{missingNotes === 1 ? "" : "s"} marked Clarify still need a note explaining your
            concern.
          </AlertDescription>
        </Alert>
      )}

      {grouped.map(([category, items]) => (
        <div key={category} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
            {CATEGORY_LABEL[category as keyof typeof CATEGORY_LABEL] ?? category}
            <span className="ml-2 text-muted-foreground/70 font-normal">({items.length})</span>
          </h3>
          {items.map((q) => {
            const current = (q.client_decision ?? "pending") as ClientDecision;
            const noteValue = noteDrafts[q.id] ?? q.client_note ?? "";
            const noteDirty = (noteDrafts[q.id] ?? "") !== "" && noteDrafts[q.id] !== q.client_note;
            const showNote = current === "clarify" || (q.client_note ?? "").length > 0;
            return (
              <Card key={q.id} className={cn("border", current !== "pending" && "border-l-4 border-l-primary/50")}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className={getCategoryColor(q.category)}>
                        {CATEGORY_LABEL[q.category]}
                      </Badge>
                      <Badge variant="outline" className={decisionBadgeClasses(current)}>
                        {DECISION_LABEL[current]}
                      </Badge>
                      {q.priority != null && (
                        <span className="text-muted-foreground">Priority {q.priority}</span>
                      )}
                    </div>
                    {q.client_decided_at && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(q.client_decided_at), "PP p")}
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-medium">{q.question_text}</div>
                  {q.question_rationale && (
                    <div className="text-xs italic text-muted-foreground">{q.question_rationale}</div>
                  )}
                  {q.source_citation && (
                    <div className="text-xs">
                      <span className="font-semibold text-primary">Source:</span>{" "}
                      <span className="text-muted-foreground">{q.source_citation}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {DECISION_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const active = current === opt.value;
                      return (
                        <Button
                          key={opt.value}
                          size="sm"
                          variant={active ? "default" : "outline"}
                          onClick={() => handleDecide(q, opt.value)}
                          disabled={decide.isPending}
                        >
                          <Icon className={cn("h-4 w-4 mr-1", !active && opt.tone)} />
                          {opt.label}
                        </Button>
                      );
                    })}
                  </div>

                  {showNote && (
                    <div className="space-y-2 pt-1">
                      <Textarea
                        rows={2}
                        placeholder={
                          current === "clarify"
                            ? "What's unclear or what outcome do you want? (required)"
                            : "Optional note for the analyst"
                        }
                        value={noteValue}
                        onChange={(e) => setNoteDrafts((p) => ({ ...p, [q.id]: e.target.value }))}
                      />
                      {noteDirty && (
                        <Button size="sm" variant="ghost" onClick={() => handleSaveNote(q)}>
                          Save note
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
