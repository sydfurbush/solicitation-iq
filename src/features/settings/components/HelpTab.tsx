import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Bell, BookOpen, ClipboardCheck, Users } from "lucide-react";
import { RevisionNotificationFlowArticle } from "../help/RevisionNotificationFlowArticle";
import { KnowledgeLibraryArticle } from "../help/KnowledgeLibraryArticle";
import { TeamAccessArticle } from "../help/TeamAccessArticle";
import { ClientQuestionWorkflowArticle } from "../help/ClientQuestionWorkflowArticle";

type Article = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  body: React.ReactNode;
};

const ARTICLES: Article[] = [
  {
    id: "team-access",
    title: "How team access works",
    description: "Org → Client → Solicitation, the Lead/Analyst/Contributor model, and recommended team patterns.",
    icon: Users,
    body: <TeamAccessArticle />,
  },
  {
    id: "client-question-workflow",
    title: "Client question review & clarification workflow",
    description: "Triage → AI-drafted clarifications → analyst-compiled package → client submission to the agency.",
    icon: ClipboardCheck,
    body: <ClientQuestionWorkflowArticle />,
  },
  {
    id: "knowledge-library",
    title: "Client Knowledge Library",
    description: "Scope, ingestion, RAG retrieval, and impact on win rate and analysis quality.",
    icon: BookOpen,
    body: <KnowledgeLibraryArticle />,
  },
  {
    id: "revision-flow",
    title: "Handling a revision notification",
    description: "Step-by-step: notification → comparison → impact → reviewed.",
    icon: Bell,
    body: <RevisionNotificationFlowArticle />,
  },
];

export function HelpTab() {
  const [activeId, setActiveId] = useState(ARTICLES[0].id);
  const active = ARTICLES.find((a) => a.id === activeId)!;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
      <aside className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2">
          Articles
        </p>
        <nav className="space-y-1">
          {ARTICLES.map((a) => {
            const Icon = a.icon;
            const isActive = a.id === activeId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveId(a.id)}
                className={cn(
                  "w-full text-left rounded-md px-3 py-2 transition border border-transparent",
                  isActive
                    ? "bg-muted border-border"
                    : "hover:bg-muted/60",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{a.title}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
              </button>
            );
          })}
        </nav>
      </aside>

      <Card>
        <CardContent className="pt-6">{active.body}</CardContent>
      </Card>
    </div>
  );
}
