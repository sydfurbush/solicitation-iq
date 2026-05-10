import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembersMap } from "@/features/collaboration/hooks/useOrgMembers";
import { AnnotationBadge } from "./AnnotationBadge";
import {
  ANNOTATION_LABEL,
  type AnnotationRow,
} from "../utils/annotationHelpers";

interface Props {
  annotation: AnnotationRow;
  documentName?: string;
  isAdmin?: boolean;
  onUpdate?: (id: string, content: string) => void;
  onDelete?: (a: AnnotationRow) => void;
  onResolveToggle?: (id: string, resolved: boolean) => void;
}

export function AnnotationCard({
  annotation: a,
  documentName,
  isAdmin,
  onUpdate,
  onDelete,
  onResolveToggle,
}: Props) {
  const { user } = useAuth();
  const { map } = useMembersMap();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.content);

  const author = a.user_id ? map.get(a.user_id) : null;
  const resolver = a.resolved_by ? map.get(a.resolved_by) : null;
  const isOwner = user?.id === a.user_id;
  const canEdit = isOwner;
  const canDelete = isOwner || isAdmin;

  return (
    <Card className={cn(a.is_resolved && "opacity-70")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <Avatar className="h-7 w-7">
              {author?.avatar_url && <AvatarImage src={author.avatar_url} alt="" />}
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {(author?.full_name ?? author?.email ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium truncate">
                  {author?.full_name ?? author?.email ?? "Unknown"}
                </span>
                <AnnotationBadge type={a.annotation_type} />
              </div>
              <p className="text-xs text-muted-foreground">
                {a.created_at && formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                {documentName && (
                  <>
                    {" · "}
                    <span>{documentName}</span>
                  </>
                )}
                {a.page_number && <span> · p.{a.page_number}</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {canEdit && !editing && !a.is_resolved && (
              <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button size="icon" variant="ghost" onClick={() => onDelete?.(a)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(a.content); }}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => { onUpdate?.(a.id, draft.trim()); setEditing(false); }}
                disabled={!draft.trim() || draft === a.content}
              >
                <Check className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        ) : (
          <p className={cn("text-sm whitespace-pre-line", a.is_resolved && "line-through")}>
            {a.content}
          </p>
        )}

        <div className="flex items-center justify-between">
          {a.is_resolved ? (
            <p className="text-xs text-muted-foreground">
              Resolved
              {resolver && ` by ${resolver.full_name ?? resolver.email}`}
              {a.resolved_at && ` · ${format(new Date(a.resolved_at), "PP")}`}
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">{ANNOTATION_LABEL[a.annotation_type]}</span>
          )}
          {onResolveToggle && (
            <Button
              size="sm"
              variant={a.is_resolved ? "ghost" : "outline"}
              onClick={() => onResolveToggle(a.id, !a.is_resolved)}
            >
              {a.is_resolved ? "Reopen" : "Resolve"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
