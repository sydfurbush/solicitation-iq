import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  FileText,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMembersMap, useOrgMembers } from "@/features/collaboration/hooks/useOrgMembers";
import { useActivityFeed } from "@/features/collaboration/hooks/useActivityFeed";

const EVENT_ICON: Record<string, LucideIcon> = {
  document_uploaded: FileText,
  annotation_added: MessageSquare,
  status_changed: Activity,
  analysis_completed: Sparkles,
  question_generated: HelpCircle,
  risk_identified: ShieldAlert,
  opportunity_identified: Lightbulb,
};

const EVENT_TYPES = [
  "document_uploaded",
  "annotation_added",
  "status_changed",
  "analysis_completed",
  "question_generated",
  "risk_identified",
  "opportunity_identified",
];

interface Props {
  solicitationId: string;
}

export function ActivityFeed({ solicitationId }: Props) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useActivityFeed(solicitationId);
  const { data: members = [] } = useOrgMembers();
  const { map } = useMembersMap();
  const [eventType, setEventType] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");

  const events = useMemo(() => {
    const all = data?.pages.flat() ?? [];
    return all.filter((e) => {
      if (eventType !== "all" && e.event_type !== eventType) return false;
      if (userId !== "all" && e.user_id !== userId) return false;
      return true;
    });
  }, [data, eventType, userId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="ml-auto">{events.length} events</Badge>
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No activity yet.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {events.map((e) => {
            const Icon = EVENT_ICON[e.event_type] ?? Activity;
            const author = e.user_id ? map.get(e.user_id) : null;
            return (
              <div key={e.id} className="flex items-start gap-3 p-3 rounded-md border bg-card">
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{e.event_description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {author ? (
                      <>
                        <Avatar className="h-4 w-4">
                          {author.avatar_url && <AvatarImage src={author.avatar_url} alt="" />}
                          <AvatarFallback className="text-[8px]">
                            {(author.full_name ?? author.email).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{author.full_name ?? author.email}</span>
                        <span>·</span>
                      </>
                    ) : null}
                    <span>{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
