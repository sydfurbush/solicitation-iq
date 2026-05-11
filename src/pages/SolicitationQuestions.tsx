import { useMemo, useState } from "react";
import { Download, History, LayoutGrid, List, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CreateQuestionDialog } from "@/features/questions/components/CreateQuestionDialog";
import { GenerateQuestionsDialog } from "@/features/questions/components/GenerateQuestionsDialog";
import { QuestionRunsHistorySheet } from "@/features/questions/components/QuestionRunsHistorySheet";
import { QuestionDetailPanel } from "@/features/questions/components/QuestionDetailPanel";
import { QuestionExport } from "@/features/questions/components/QuestionExport";
import { QuestionsFilters, type FilterCounts } from "@/features/questions/components/QuestionsFilters";
import { QuestionsList } from "@/features/questions/components/QuestionsList";
import { QuestionsMatrix } from "@/features/questions/components/QuestionsMatrix";
import { SubmittedQuestionsTracker } from "@/features/questions/components/SubmittedQuestionsTracker";
import {
  useBulkUpdateQuestions,
  useDeleteQuestion,
  useStrategicQuestions,
  useUpdateQuestion,
} from "@/features/questions/hooks/useStrategicQuestions";
import {
  filterQuestions,
  getPriorityLevel,
  type QuestionFilters,
  type QuestionRow,
} from "@/features/questions/utils/questionHelpers";

interface Props {
  solicitationId: string;
}

export default function SolicitationQuestions({ solicitationId }: Props) {
  const [filters, setFilters] = useState<QuestionFilters>({});
  const [view, setView] = useState<"list" | "matrix" | "submitted">("list");
  const [selected, setSelected] = useState<QuestionRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: filtered = [], isLoading } = useStrategicQuestions(solicitationId, filters);
  const { data: allQuestions = [] } = useStrategicQuestions(solicitationId);

  const { data: documents = [] } = useQuery({
    queryKey: ["docs-for-questions", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, status")
        .eq("solicitation_id", solicitationId)
        .is("deleted_at", null)
        .in("status", ["parsed", "analyzed"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useUpdateQuestion(solicitationId);
  const bulkUpdate = useBulkUpdateQuestions(solicitationId);
  const remove = useDeleteQuestion(solicitationId);

  const hasExistingAi = useMemo(() => allQuestions.some((q) => q.is_ai_generated), [allQuestions]);
  const filterCounts = useMemo<FilterCounts>(() => {
    const c: FilterCounts = {
      total: allQuestions.length,
      categories: {},
      recommendations: {},
      priorities: {},
      submitted: 0,
      notSubmitted: 0,
      ai: 0,
      manual: 0,
    };
    for (const q of allQuestions) {
      c.categories[q.category] = (c.categories[q.category] ?? 0) + 1;
      if (q.recommendation) c.recommendations[q.recommendation] = (c.recommendations[q.recommendation] ?? 0) + 1;
      const p = getPriorityLevel(q.priority);
      c.priorities[p] = (c.priorities[p] ?? 0) + 1;
      if (q.is_submitted) c.submitted++; else c.notSubmitted++;
      if (q.is_ai_generated) c.ai++; else c.manual++;
    }
    return c;
  }, [allQuestions]);
  const empty = !isLoading && allQuestions.length === 0;

  const handleUpdate = async (id: string, updates: Partial<QuestionRow>) => {
    try { await update.mutateAsync({ id, updates }); }
    catch (e) { toast({ title: "Update failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
  };
  const handleDelete = async (id: string) => {
    try { await remove.mutateAsync(id); toast({ title: "Question deleted" }); }
    catch (e) { toast({ title: "Delete failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
  };
  const handleBulkUpdate = async (ids: string[], updates: Partial<QuestionRow>) => {
    try { await bulkUpdate.mutateAsync({ ids, updates }); }
    catch (e) { toast({ title: "Bulk update failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Strategic questions</h2>
          <p className="text-sm text-muted-foreground">
            {allQuestions.length} total · {allQuestions.filter((q) => q.is_submitted).length} submitted
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="list"><List className="h-4 w-4 mr-1" /> List</TabsTrigger>
              <TabsTrigger value="matrix"><LayoutGrid className="h-4 w-4 mr-1" /> Matrix</TabsTrigger>
              <TabsTrigger value="submitted">Submitted</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4 mr-1" /> History
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} disabled={allQuestions.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add question
          </Button>
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="h-4 w-4 mr-1" /> Generate
          </Button>
        </div>
      </div>

      {empty ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center max-w-xl mx-auto space-y-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">No questions yet</h3>
            <p className="text-sm text-muted-foreground">
              Generate strategic questions from the documents you've processed, or add your own manually.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setGenerateOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" /> Generate questions
              </Button>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add manually
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {view !== "submitted" && <QuestionsFilters filters={filters} onChange={setFilters} counts={filterCounts} />}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : view === "list" ? (
            <QuestionsList
              questions={filtered}
              onSelect={setSelected}
              onUpdate={handleUpdate}
              onBulkUpdate={handleBulkUpdate}
              onDelete={handleDelete}
              onExportSelected={() => setExportOpen(true)}
            />
          ) : view === "matrix" ? (
            <QuestionsMatrix
              questions={allQuestions}
              onSelectCell={(f) => {
                setView("list");
                setFilters({ categories: [f.category], recommendations: [f.recommendation] });
              }}
            />
          ) : (
            <SubmittedQuestionsTracker questions={allQuestions} onSelect={setSelected} />
          )}
        </>
      )}

      <CreateQuestionDialog
        solicitationId={solicitationId}
        documents={documents}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <GenerateQuestionsDialog
        solicitationId={solicitationId}
        documents={documents}
        hasExistingAi={hasExistingAi}
        open={generateOpen}
        onOpenChange={setGenerateOpen}
      />
      <QuestionExport
        questions={allQuestions}
        open={exportOpen}
        onOpenChange={setExportOpen}
      />
      <QuestionRunsHistorySheet
        solicitationId={solicitationId}
        documents={documents}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      <QuestionDetailPanel
        question={selected}
        documents={documents}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
