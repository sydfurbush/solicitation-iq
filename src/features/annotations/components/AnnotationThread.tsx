import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useMembersMap } from "@/features/collaboration/hooks/useOrgMembers";
import { AnnotationBadge } from "./AnnotationBadge";
import type { AnnotationRow } from "../utils/annotationHelpers";

interface Props {
  parent: AnnotationRow;
  replies?: AnnotationRow[];
}

/**
 * Placeholder threaded view. Replies are not yet persisted as a separate
 * relation; this component renders a single thread shape so future reply
 * support can be added without changing call sites.
 */
export function AnnotationThread({ parent, replies = [] }: Props) {
  const { map } = useMembersMap();
  const author = parent.user_id ? map.get(parent.user_id) : null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Avatar className="h-7 w-7">
            {author?.avatar_url && <AvatarImage src={author.avatar_url} alt="" />}
            <AvatarFallback className="text-[10px]">
              {(author?.full_name ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{author?.full_name ?? "Unknown"}</span>
              <AnnotationBadge type={parent.annotation_type} />
              <span className="text-xs text-muted-foreground">
                {parent.created_at && formatDistanceToNow(new Date(parent.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm mt-1 whitespace-pre-line">{parent.content}</p>
          </div>
        </div>

        {replies.length > 0 && (
          <div className="ml-9 space-y-2 border-l-2 pl-3">
            {replies.map((r) => {
              const ra = r.user_id ? map.get(r.user_id) : null;
              return (
                <div key={r.id} className="flex items-start gap-2">
                  <Avatar className="h-6 w-6">
                    {ra?.avatar_url && <AvatarImage src={ra.avatar_url} alt="" />}
                    <AvatarFallback className="text-[9px]">
                      {(ra?.full_name ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-sm">
                    <span className="font-medium">{ra?.full_name ?? "Unknown"}</span>
                    <p className="text-muted-foreground">{r.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
