import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  Lightbulb,
  Menu,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PhaseRail,
  MobilePhaseBar,
  useRailCollapsed,
} from "@/features/solicitations/components/workspace/PhaseRail";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  useDeleteSolicitation,
  useSolicitation,
  useUpdateSolicitationStatus,
} from "@/features/solicitations/hooks/useSolicitations";
import { useClient } from "@/features/clients/hooks/useClients";
import { PhaseIndicator } from "@/features/solicitations/components/PhaseIndicator";
import { PhaseHub, type HubStep } from "@/features/solicitations/components/PhaseHub";
import { PhaseShell } from "@/features/solicitations/components/PhaseShell";
import { SolicitationActionsMenu } from "@/features/solicitations/components/SolicitationActionsMenu";
import { StageBadge } from "@/features/solicitations/components/StageBadge";
import { AddFinalSolicitationDialog } from "@/features/solicitations/components/AddFinalSolicitationDialog";
import { useChildSolicitation } from "@/features/solicitations/hooks/useFinalFromPreSol";
import type { SolicitationStage } from "@/features/solicitations/lib/stage";
import { SolicitationOverview } from "@/features/solicitations/components/SolicitationOverview";
import {
  STATUS_CLASSES,
  STATUS_LABELS,
  daysUntil,
  dueUrgency,
} from "@/features/solicitations/lib/format";
import { SOLICITATION_STATUSES, PHASES, type PhaseType, type SolicitationStatus } from "@/lib/validators/solicitation";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useDocumentsReadiness } from "@/features/documents/hooks/useDocumentsReadiness";
import SolicitationDocuments from "./SolicitationDocuments";
import SolicitationAnalysis from "./SolicitationAnalysis";
import SolicitationQuestions from "./SolicitationQuestions";
import SolicitationRisksOpportunities from "./SolicitationRisksOpportunities";
import SolicitationActivity from "./SolicitationActivity";
import SolicitationComparison from "./SolicitationComparison";
import SolicitationReports from "./SolicitationReports";
import SolicitationDeepDive from "./SolicitationDeepDive";
import SolicitationOutline from "./SolicitationOutline";
import SolicitationWinThemes from "./SolicitationWinThemes";
import { ExhibitsTab } from "@/features/exhibits/components/ExhibitsTab";
import SolicitationWritingQueue from "./SolicitationWritingQueue";
import SolicitationAssistant from "./SolicitationAssistant";
import { AssistantLauncher } from "@/features/assistant/components/AssistantLauncher";
import { Phase5Workspace } from "@/features/drafting/components/Phase5Workspace";
import { PHASE_TAB } from "@/features/solicitations/hooks/usePhaseProgression";
import { AnnotationsSidebar } from "@/features/annotations/components/AnnotationsSidebar";
import { TeamPresence } from "@/features/collaboration/components/TeamPresence";
import { PhaseHelpPanel } from "@/features/solicitations/components/PhaseHelpPanel";

const PHASE_1_STEPS = [
  { key: "overview", label: "Overview" },
  { key: "documents", label: "Documents" },
  { key: "analysis", label: "Analysis" },
  { key: "questions", label: "Questions" },
  { key: "risks", label: "Risks & Opportunities" },
];

const PHASE_2_STEPS = [
  { key: "rtm", label: "Requirements (RTM)" },
  { key: "sections", label: "Section analysis" },
  { key: "gaps", label: "Gaps" },
  { key: "teaming", label: "Teaming" },
];

const PHASE_3_STEPS = [
  { key: "outline", label: "Proposal outline" },
  { key: "exhibits", label: "Exhibits & Attachments" },
];

// Maps any legacy ?tab= value (or pre-redesign deep links) to the new shape.
const LEGACY_TAB: Record<string, { tab: string; step?: string }> = {
  overview: { tab: "phase-1", step: "overview" },
  documents: { tab: "phase-1", step: "documents" },
  analysis: { tab: "phase-1", step: "analysis" },
  questions: { tab: "phase-1", step: "questions" },
  risks: { tab: "phase-1", step: "risks" },
  "deep-dive": { tab: "phase-2" },
  outline: { tab: "phase-3" },
  "win-themes": { tab: "phase-4" },
};

type WorkspaceKey = "writing-queue" | "reports" | "comparison" | "activity" | "assistant";
const WORKSPACE_LABELS: Record<WorkspaceKey, string> = {
  "writing-queue": "Writing Queue",
  reports: "Reports",
  comparison: "Comparison",
  activity: "Activity",
  assistant: "AI Assistant",
};

function ParentChildLinks({ solId, parentId }: { solId: string; parentId: string | null }) {
  const { data: child } = useChildSolicitation(parentId ? undefined : solId);
  return (
    <>
      {parentId && (
        <Link
          to={`/solicitations/${parentId}`}
          className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          ← Linked from earlier stage
        </Link>
      )}
      {!parentId && child && (
        <Link
          to={`/solicitations/${child.id}`}
          className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Continued in {child.stage_label || child.stage} →
        </Link>
      )}
    </>
  );
}

export default function SolicitationDetail() {
  const { solicitationId } = useParams<{ solicitationId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get("tab");
  const tab = rawTab ?? "workflow";
  const step = searchParams.get("step");

  const { data: s, isLoading } = useSolicitation(solicitationId);
  const { data: client } = useClient(s?.client_id ?? undefined);
  const clientName = client?.name ?? undefined;
  const updateStatus = useUpdateSolicitationStatus();
  const deleteMut = useDeleteSolicitation();

  // Realtime watch: notify when every document for this solicitation hits "analyzed".
  useDocumentsReadiness(solicitationId, (r) => {
    toast({
      title: "All documents ready",
      description: `${r.analyzed} of ${r.total} analyzed. You can now generate strategic questions.`,
      action: (
        <ToastAction
          altText="Generate questions"
          onClick={() => {
            const next = new URLSearchParams();
            next.set("tab", "phase-1");
            next.set("step", "questions");
            next.set("autoOpenGenerate", "1");
            setSearchParams(next);
          }}
        >
          Generate questions
        </ToastAction>
      ),
    });
  });

  const urgency = useMemo(() => dueUrgency(s?.proposal_due_date), [s?.proposal_due_date]);
  const days = useMemo(() => daysUntil(s?.proposal_due_date), [s?.proposal_due_date]);

  // One-time legacy ?tab= redirect
  useEffect(() => {
    if (!rawTab) return;
    const mapped = LEGACY_TAB[rawTab];
    if (!mapped) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", mapped.tab);
    if (mapped.step) next.set("step", mapped.step);
    else next.delete("step");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTab]);

  const goTab = (t: string, st?: string) => {
    const next = new URLSearchParams();
    next.set("tab", t);
    if (st) next.set("step", st);
    setSearchParams(next);
  };

  // Track the last non-assistant tab so the collapse button can return there.
  const previousTabRef = useRef<string>("phase-1");
  useEffect(() => {
    if (tab && tab !== "assistant") previousTabRef.current = tab;
  }, [tab]);

  const exitAssistant = () => {
    const next = new URLSearchParams();
    next.set("tab", previousTabRef.current || "phase-1");
    setSearchParams(next);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!s) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Solicitation not found.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/solicitations")}>
          Back to solicitations
        </Button>
      </div>
    );
  }

  const status = (s.status ?? "intake") as SolicitationStatus;
  const currentPhase: PhaseType = (s.current_phase ?? "phase_1_initial") as PhaseType;
  const currentPhaseIdx = PHASES.indexOf(currentPhase);

  // Full-bleed assistant mode: takes over the page content area with a collapse trigger.
  if (tab === "assistant") {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[520px] border rounded-lg overflow-hidden bg-card">
        <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">AI Assistant</div>
              <div className="text-xs text-muted-foreground truncate">{s.title}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={exitAssistant} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Exit assistant</span>
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <SolicitationAssistant solicitationId={s.id} />
        </div>
      </div>
    );
  }

  const handleStatusChange = async (next: SolicitationStatus) => {
    try {
      await updateStatus.mutateAsync({ id: s.id, status: next });
      toast({ title: "Status updated", description: STATUS_LABELS[next] });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync(s.id);
      toast({ title: "Solicitation deleted", description: s.title });
      navigate("/solicitations");
    } catch (e) {
      toast({
        title: "Failed to delete",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  // Build hub step lists (light guidance: state derived from current phase position only)
  const buildHubSteps = (phase: PhaseType): HubStep[] => {
    const idx = PHASES.indexOf(phase);
    const phaseDone = idx < currentPhaseIdx;
    const phaseActive = idx === currentPhaseIdx;
    const stepState = (active = false): HubStep["state"] =>
      phaseDone ? "done" : phaseActive && active ? "active" : phaseActive ? "todo" : "todo";

    if (phase === "phase_1_initial") {
      return [
        { key: "overview", label: "Overview", state: stepState(true), onClick: () => goTab("phase-1", "overview") },
        { key: "documents", label: "Documents", count: s.documents_count, state: stepState(), onClick: () => goTab("phase-1", "documents") },
        { key: "analysis", label: "Analysis", state: stepState(), onClick: () => goTab("phase-1", "analysis") },
        { key: "questions", label: "Questions", count: s.questions_count, state: stepState(), onClick: () => goTab("phase-1", "questions") },
        { key: "risks", label: "Risks & Opportunities", count: (s.risks_count ?? 0) + (s.opportunities_count ?? 0), state: stepState(), onClick: () => goTab("phase-1", "risks") },
      ];
    }
    if (phase === "phase_2_deep_dive") {
      return [
        { key: "rtm", label: "Requirements (RTM)", state: stepState(true), onClick: () => goTab("phase-2") },
        { key: "sections", label: "Section analysis", state: stepState(), onClick: () => goTab("phase-2") },
        { key: "gaps", label: "Capability gaps", state: stepState(), onClick: () => goTab("phase-2") },
      ];
    }
    if (phase === "phase_3_outline") {
      return [
        { key: "outline", label: "Proposal outline", state: stepState(true), onClick: () => goTab("phase-3") },
      ];
    }
    return [
      { key: "themes", label: "Win themes", state: stepState(true), onClick: () => goTab("phase-4") },
    ];
  };

  const phaseLabelByKey: Record<string, string> = {
    "phase-1": "Phase 1 · Initial",
    "phase-2": "Phase 2 · Deep Dive",
    "phase-3": "Phase 3 · Outline",
    "phase-4": "Phase 4 · Win Themes",
    "phase-5": "Phase 5 · Drafting",
  };

  const renderPhase1 = () => {
    const sub = step ?? "overview";
    return (
      <PhaseShell
        solicitationId={s.id}
        phase="phase_1_initial"
        currentPhase={currentPhase}
        subSteps={PHASE_1_STEPS}
        activeStep={sub}
        onStepChange={(k) => goTab("phase-1", k)}
      >
        {/* Phase 1 KPIs live here only */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={FileText} label="Documents" value={s.documents_count} />
          <StatCard icon={HelpCircle} label="Questions" value={s.questions_count} />
          <StatCard icon={ShieldAlert} label="Risks" value={s.risks_count} accent="warning" />
          <StatCard icon={Lightbulb} label="Opportunities" value={s.opportunities_count} accent="accent" />
        </div>

        {sub === "overview" && <SolicitationOverview solicitation={s} />}
        {sub === "documents" && <SolicitationDocuments solicitationId={s.id} />}
        {sub === "analysis" && <SolicitationAnalysis solicitationId={s.id} />}
        {sub === "questions" && <SolicitationQuestions solicitationId={s.id} />}
        {sub === "risks" && <SolicitationRisksOpportunities solicitationId={s.id} />}
      </PhaseShell>
    );
  };

  return (
    <div className="space-y-6">
      <nav className="flex items-center text-sm text-muted-foreground">
        <Link to="/solicitations" className="hover:text-foreground">
          Solicitations
        </Link>
        <ChevronRight className="h-4 w-4 mx-1" />
        <span className="text-foreground font-medium truncate max-w-[60ch]">{s.title}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="h-5 w-5">
              {s.client?.logo_url ? <AvatarImage src={s.client.logo_url} alt={s.client.name} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                {(s.client?.name ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {s.client?.id ? (
              <Link to={`/clients/${s.client.id}`} className="hover:text-foreground">
                {s.client.name}
              </Link>
            ) : (
              <span>Unknown client</span>
            )}
            {s.solicitation_number && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {s.solicitation_number}
              </Badge>
            )}
            <StageBadge stage={(s as { stage?: string }).stage} label={(s as { stage_label?: string | null }).stage_label} />
            <ParentChildLinks
              solId={s.id}
              parentId={(s as { parent_solicitation_id?: string | null }).parent_solicitation_id ?? null}
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            {s.issuing_agency && (
              <p className="text-sm text-muted-foreground">{s.issuing_agency}</p>
            )}
            {(s as { sam_url?: string | null }).sam_url && (
              <a
                href={(s as { sam_url: string }).sam_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View on SAM.gov
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <TeamPresence solicitationId={s.id} />
          <AnnotationsSidebar solicitationId={s.id} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Badge variant="outline" className={cn("mr-1 capitalize", STATUS_CLASSES[status])}>
                  {STATUS_LABELS[status]}
                </Badge>
                Change
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SOLICITATION_STATUSES.map((st) => (
                <DropdownMenuItem key={st} onClick={() => handleStatusChange(st)}>
                  {STATUS_LABELS[st]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {((s as { stage?: string }).stage === "pre_solicitation" ||
            (s as { stage?: string }).stage === "draft_rfp") && (
            <AddFinalSolicitationDialog
              sourceId={s.id}
              sourceTitle={s.title}
              sourceStage={(s as { stage: SolicitationStage }).stage}
            />
          )}
          <SolicitationActionsMenu
            solicitation={s}
            onArchive={() => handleStatusChange("archived")}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* Phase strip + countdown */}
      <Card>
        <CardContent className="p-5 flex flex-col lg:flex-row gap-6 lg:items-center">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Phase</p>
            <PhaseIndicator
              current={s.current_phase}
              status={s.status}
              onPhaseClick={(p: PhaseType) => goTab(PHASE_TAB[p])}
            />
          </div>
          <div className="lg:border-l lg:pl-6">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Proposal due</p>
            {s.proposal_due_date ? (
              <div
                className={cn(
                  "flex items-center gap-2",
                  urgency === "danger" || urgency === "overdue"
                    ? "text-destructive"
                    : urgency === "warning"
                      ? "text-amber-600 dark:text-amber-500"
                      : "",
                )}
              >
                <Clock className="h-4 w-4" />
                <div>
                  <p className="font-semibold">{format(new Date(s.proposal_due_date), "PPP")}</p>
                  {days !== null && (
                    <p className="text-xs">
                      {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No due date set</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Slim top nav */}
      <div className="border-b">
        <div className="flex flex-wrap items-center gap-1">
          <NavBtn active={tab === "workflow"} onClick={() => goTab("workflow")}>
            Workflow
          </NavBtn>

          {/* Phase 1 with sub-step menu */}
          <div className="inline-flex items-center">
            <PhaseNavMenu
              label={phaseLabelByKey["phase-1"]}
              active={tab === "phase-1"}
              steps={PHASE_1_STEPS}
              activeStep={tab === "phase-1" ? (step ?? "overview") : undefined}
              onPick={(k) => goTab("phase-1", k)}
              onOpen={() => goTab("phase-1", "overview")}
              phase="phase_1_initial"
            />
            <PhaseHelpPanel phase="phase_1_initial" />
          </div>

          {/* Phase 2 with sub-step menu */}
          <div className="inline-flex items-center">
            <PhaseNavMenu
              label={phaseLabelByKey["phase-2"]}
              active={tab === "phase-2"}
              steps={PHASE_2_STEPS}
              activeStep={tab === "phase-2" ? (step ?? "rtm") : undefined}
              onPick={(k) => goTab("phase-2", k)}
              onOpen={() => goTab("phase-2", "rtm")}
              phase="phase_2_deep_dive"
            />
            <PhaseHelpPanel phase="phase_2_deep_dive" />
          </div>
          <div className="inline-flex items-center">
            <PhaseNavMenu
              label={phaseLabelByKey["phase-3"]}
              active={tab === "phase-3"}
              steps={PHASE_3_STEPS}
              activeStep={tab === "phase-3" ? (step ?? "outline") : undefined}
              onPick={(k) => goTab("phase-3", k)}
              onOpen={() => goTab("phase-3", "outline")}
              phase="phase_3_outline"
            />
            <PhaseHelpPanel phase="phase_3_outline" />
          </div>
          <PhaseNavBtn phase="phase_4_win_themes" active={tab === "phase-4"} onClick={() => goTab("phase-4")}>
            {phaseLabelByKey["phase-4"]}
          </PhaseNavBtn>
          <PhaseNavBtn phase="phase_5_drafting" active={tab === "phase-5"} onClick={() => goTab("phase-5")}>
            {phaseLabelByKey["phase-5"]}
          </PhaseNavBtn>

          <WorkspaceNavMenu
            active={tab === "writing-queue" || tab === "reports" || tab === "comparison" || tab === "activity" || tab === "assistant"}
            currentKey={(tab as WorkspaceKey) || undefined}
            onPick={(k) => goTab(k)}
          />
        </div>
      </div>

      {/* Content */}
      <div>
        {tab === "workflow" && (
          <PhaseHub
            currentPhase={currentPhase}
            phaseStatusByPhase={{}}
            buildSteps={buildHubSteps}
            onOpenPhase={(p) => goTab(PHASE_TAB[p])}
            onWorkspace={(k) => goTab(k)}
            solicitationId={s.id}
            solicitation={{
              title: s.title,
              solicitation_number: s.solicitation_number,
              issuing_agency: s.issuing_agency,
              client: { name: clientName },
            }}
          />
        )}

        {tab === "phase-1" && renderPhase1()}

        {tab === "phase-2" && (
          <PhaseShell
            solicitationId={s.id}
            phase="phase_2_deep_dive"
            currentPhase={currentPhase}
            subSteps={PHASE_2_STEPS}
            activeStep={step ?? "rtm"}
            onStepChange={(k) => goTab("phase-2", k)}
          >
            <SolicitationDeepDive
              solicitationId={s.id}
              clientId={s.client_id}
              currentPhase={currentPhase}
              solicitationTitle={s.title}
              clientName={clientName}
              step={step ?? "rtm"}
              onStepChange={(k) => goTab("phase-2", k)}
            />
          </PhaseShell>
        )}

        {tab === "phase-3" && (
          <PhaseShell
            solicitationId={s.id}
            phase="phase_3_outline"
            currentPhase={currentPhase}
            subSteps={PHASE_3_STEPS}
            activeStep={step ?? "outline"}
            onStepChange={(k) => goTab("phase-3", k)}
          >
            {(step ?? "outline") === "exhibits" ? (
              <ExhibitsTab solicitationId={s.id} />
            ) : (
              <SolicitationOutline
                solicitationId={s.id}
                currentPhase={currentPhase}
                solicitationTitle={s.title}
                solicitationNumber={s.solicitation_number}
                clientName={clientName}
              />
            )}
          </PhaseShell>
        )}


        {tab === "phase-4" && (
          <PhaseShell solicitationId={s.id} phase="phase_4_win_themes" currentPhase={currentPhase}>
            <SolicitationWinThemes
              solicitationId={s.id}
              currentPhase={currentPhase}
              solicitationTitle={s.title}
              clientName={clientName}
            />
          </PhaseShell>
        )}

        {tab === "phase-5" && (
          <PhaseShell solicitationId={s.id} phase="phase_5_drafting" currentPhase={currentPhase}>
            <Phase5Workspace solicitationId={s.id} />
          </PhaseShell>
        )}

        {tab === "writing-queue" && (
          <SolicitationWritingQueue
            solicitationId={s.id}
            currentPhase={currentPhase}
            solicitationTitle={s.title}
            clientName={clientName}
          />
        )}
        {tab === "reports" && <SolicitationReports solicitationId={s.id} />}
        {tab === "comparison" && <SolicitationComparison solicitationId={s.id} />}
        {tab === "activity" && <SolicitationActivity solicitationId={s.id} />}
        {tab === "assistant" && <SolicitationAssistant solicitationId={s.id} />}
      </div>

      <AssistantLauncher solicitationId={s.id} />
    </div>
  );
}

/* -------------------- Sub-components -------------------- */

function NavBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-10 px-3 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {active && (
        <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-primary rounded-full" />
      )}
    </button>
  );
}

function PhaseNavBtn({
  phase,
  active,
  onClick,
  children,
}: {
  phase: PhaseType;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const colorBar: Record<PhaseType, string> = {
    phase_1_initial: "bg-[hsl(var(--phase-1))]",
    phase_2_deep_dive: "bg-[hsl(var(--phase-2))]",
    phase_3_outline: "bg-[hsl(var(--phase-3))]",
    phase_4_win_themes: "bg-[hsl(var(--phase-4))]",
    phase_5_drafting: "bg-[hsl(var(--phase-5))]",
  };
  const colorText: Record<PhaseType, string> = {
    phase_1_initial: "text-[hsl(var(--phase-1))]",
    phase_2_deep_dive: "text-[hsl(var(--phase-2))]",
    phase_3_outline: "text-[hsl(var(--phase-3))]",
    phase_4_win_themes: "text-[hsl(var(--phase-4))]",
    phase_5_drafting: "text-[hsl(var(--phase-5))]",
  };
  return (
    <div className="inline-flex items-center">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative h-10 px-3 text-sm font-medium transition-colors inline-flex items-center gap-1.5",
          active ? colorText[phase] : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", colorBar[phase])} />
        {children}
        {active && (
          <span className={cn("absolute left-2 right-2 -bottom-px h-0.5 rounded-full", colorBar[phase])} />
        )}
      </button>
      <PhaseHelpPanel phase={phase} />
    </div>
  );
}

function PhaseNavMenu({
  label,
  active,
  steps,
  activeStep,
  onPick,
  onOpen,
  phase,
}: {
  label: string;
  active: boolean;
  steps: { key: string; label: string }[];
  activeStep?: string;
  onPick: (k: string) => void;
  onOpen: () => void;
  phase: PhaseType;
}) {
  const colorBar: Record<PhaseType, string> = {
    phase_1_initial: "bg-[hsl(var(--phase-1))]",
    phase_2_deep_dive: "bg-[hsl(var(--phase-2))]",
    phase_3_outline: "bg-[hsl(var(--phase-3))]",
    phase_4_win_themes: "bg-[hsl(var(--phase-4))]",
    phase_5_drafting: "bg-[hsl(var(--phase-5))]",
  };
  const colorText: Record<PhaseType, string> = {
    phase_1_initial: "text-[hsl(var(--phase-1))]",
    phase_2_deep_dive: "text-[hsl(var(--phase-2))]",
    phase_3_outline: "text-[hsl(var(--phase-3))]",
    phase_4_win_themes: "text-[hsl(var(--phase-4))]",
    phase_5_drafting: "text-[hsl(var(--phase-5))]",
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative h-10 px-3 text-sm font-medium transition-colors inline-flex items-center gap-1.5",
            active ? colorText[phase] : "text-muted-foreground hover:text-foreground",
          )}
          onDoubleClick={onOpen}
        >
          <span className={cn("h-2 w-2 rounded-full", colorBar[phase])} />
          {label}
          {activeStep && (
            <span className="text-muted-foreground/80">
              · {steps.find((s) => s.key === activeStep)?.label}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          {active && (
            <span className={cn("absolute left-2 right-2 -bottom-px h-0.5 rounded-full", colorBar[phase])} />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {steps.map((s) => (
          <DropdownMenuItem
            key={s.key}
            onClick={() => onPick(s.key)}
            className={cn(s.key === activeStep && "bg-accent/50 font-medium")}
          >
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceNavMenu({
  active,
  currentKey,
  onPick,
}: {
  active: boolean;
  currentKey?: WorkspaceKey;
  onPick: (k: WorkspaceKey) => void;
}) {
  return (
    <div className="ml-auto">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "relative h-10 px-3 text-sm font-medium transition-colors inline-flex items-center gap-1",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Workspace
            {currentKey && (
              <span className="text-muted-foreground/80">· {WORKSPACE_LABELS[currentKey]}</span>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            {active && (
              <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onPick("assistant")}>AI Assistant</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPick("writing-queue")}>Writing Queue</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPick("reports")}>Reports</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPick("comparison")}>Comparison</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPick("activity")}>Activity</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  accent?: "warning" | "accent";
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-md flex items-center justify-center",
            accent === "warning"
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-500"
              : accent === "accent"
                ? "bg-accent/15 text-accent"
                : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
