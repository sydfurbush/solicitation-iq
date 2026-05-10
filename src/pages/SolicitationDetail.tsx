import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  Archive,
  ChevronRight,
  Clock,
  FileBarChart,
  FileText,
  HelpCircle,
  Lightbulb,
  Pencil,
  Share2,
  ShieldAlert,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useSolicitation, useUpdateSolicitationStatus } from "@/features/solicitations/hooks/useSolicitations";
import { PhaseIndicator } from "@/features/solicitations/components/PhaseIndicator";
import { SolicitationOverview } from "@/features/solicitations/components/SolicitationOverview";
import {
  STATUS_CLASSES,
  STATUS_LABELS,
  daysUntil,
  dueUrgency,
} from "@/features/solicitations/lib/format";
import { SOLICITATION_STATUSES, type SolicitationStatus } from "@/lib/validators/solicitation";
import { toast } from "@/hooks/use-toast";
import SolicitationDocuments from "./SolicitationDocuments";
import SolicitationAnalysis from "./SolicitationAnalysis";
import SolicitationQuestions from "./SolicitationQuestions";
import SolicitationRisksOpportunities from "./SolicitationRisksOpportunities";
import SolicitationActivity from "./SolicitationActivity";
import SolicitationComparison from "./SolicitationComparison";
import SolicitationReports from "./SolicitationReports";
import { AnnotationsSidebar } from "@/features/annotations/components/AnnotationsSidebar";
import { TeamPresence } from "@/features/collaboration/components/TeamPresence";

export default function SolicitationDetail() {
  const { solicitationId } = useParams<{ solicitationId: string }>();
  const navigate = useNavigate();
  const { data: s, isLoading } = useSolicitation(solicitationId);
  const updateStatus = useUpdateSolicitationStatus();

  const urgency = useMemo(() => dueUrgency(s?.proposal_due_date), [s?.proposal_due_date]);
  const days = useMemo(() => daysUntil(s?.proposal_due_date), [s?.proposal_due_date]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
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

  const handleStatusChange = async (next: SolicitationStatus) => {
    try {
      await updateStatus.mutateAsync({ id: s.id, status: next });
      toast({ title: `Status updated`, description: STATUS_LABELS[next] });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied", description: "Share with your team." });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
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
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
          {s.issuing_agency && (
            <p className="text-sm text-muted-foreground">{s.issuing_agency}</p>
          )}
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
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleStatusChange("archived")}>
            <Archive className="mr-2 h-4 w-4" /> Archive
          </Button>
          <Button variant="outline" size="sm">
            <FileBarChart className="mr-2 h-4 w-4" /> Generate report
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
        </div>
      </div>

      {/* Phase + countdown */}
      <Card>
        <CardContent className="p-5 flex flex-col lg:flex-row gap-6 lg:items-center">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Phase</p>
            <PhaseIndicator current={s.current_phase} status={s.status} />
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
                      : ""
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

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Documents" value={s.documents_count} />
        <StatCard icon={HelpCircle} label="Questions" value={s.questions_count} />
        <StatCard icon={ShieldAlert} label="Risks" value={s.risks_count} accent="warning" />
        <StatCard icon={Lightbulb} label="Opportunities" value={s.opportunities_count} accent="accent" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="risks">Risks &amp; Opportunities</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <SolicitationOverview solicitation={s} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <SolicitationDocuments solicitationId={s.id} />
        </TabsContent>

        <TabsContent value="analysis" className="mt-6">
          <SolicitationAnalysis solicitationId={s.id} />
        </TabsContent>

        <TabsContent value="questions" className="mt-6">
          <SolicitationQuestions solicitationId={s.id} />
        </TabsContent>

        <TabsContent value="risks" className="mt-6">
          <SolicitationRisksOpportunities solicitationId={s.id} />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <SolicitationActivity solicitationId={s.id} />
        </TabsContent>

        <TabsContent value="comparison" className="mt-6">
          <SolicitationComparison solicitationId={s.id} />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Reports tab is coming soon.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
                : "bg-primary/10 text-primary"
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
