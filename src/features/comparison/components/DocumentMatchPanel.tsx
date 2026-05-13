import { useState } from "react";
import { Eye, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentMatching } from "../hooks/useDocumentMatching";
import { DocumentDiffModal } from "./DocumentDiffModal";
import type { DocMatchStatus } from "../utils/documentMatcher";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<DocMatchStatus, string> = {
  unchanged: "bg-muted text-muted-foreground",
  modified: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  added: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  removed: "bg-destructive/15 text-destructive border-destructive/30",
};

type Props = {
  solicitationId: string;
  revisionAId: string | null;
  revisionBId: string | null;
};

export function DocumentMatchPanel({ solicitationId, revisionAId, revisionBId }: Props) {
  const { data: matches, isLoading } = useDocumentMatching(solicitationId, revisionAId, revisionBId);
  const [diffPair, setDiffPair] = useState<{ aId: string; bId: string; aName: string; bName: string } | null>(null);

  if (!revisionAId || !revisionBId) {
    return (
      <Card><CardContent className="py-6 text-sm text-muted-foreground">Pick two revisions to compare.</CardContent></Card>
    );
  }
  if (revisionAId === revisionBId) {
    return (
      <Card><CardContent className="py-6 text-sm text-muted-foreground">Pick two different revisions.</CardContent></Card>
    );
  }

  const counts = (matches ?? []).reduce(
    (acc, m) => { acc[m.status]++; return acc; },
    { unchanged: 0, modified: 0, added: 0, removed: 0 } as Record<DocMatchStatus, number>,
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Document changes</CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className={STATUS_TONE.modified}>{counts.modified} modified</Badge>
              <Badge variant="outline" className={STATUS_TONE.added}>{counts.added} added</Badge>
              <Badge variant="outline" className={STATUS_TONE.removed}>{counts.removed} removed</Badge>
              <Badge variant="outline" className={STATUS_TONE.unchanged}>{counts.unchanged} unchanged</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (matches ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents in either revision.</p>
          ) : (
            <ul className="divide-y">
              {(matches ?? []).map((m, i) => (
                <li key={i} className="py-2 flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {m.b?.file_name ?? m.a?.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.a && m.b && m.a.file_name !== m.b.file_name && (
                        <span className="line-through mr-2">{m.a.file_name}</span>
                      )}
                      {m.pageDelta !== null && m.pageDelta !== 0 && (
                        <span className={cn(m.pageDelta > 0 ? "text-emerald-600" : "text-destructive")}>
                          {m.pageDelta > 0 ? "+" : ""}{m.pageDelta} pages
                        </span>
                      )}
                      {m.similarity !== null && m.similarity < 1 && (
                        <span className="ml-2">match {Math.round(m.similarity * 100)}%</span>
                      )}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("capitalize", STATUS_TONE[m.status])}>{m.status}</Badge>
                  {m.status === "modified" && m.a && m.b && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDiffPair({ aId: m.a!.id, bId: m.b!.id, aName: m.a!.file_name, bName: m.b!.file_name })}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> View diff
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DocumentDiffModal
        open={!!diffPair}
        onClose={() => setDiffPair(null)}
        docAId={diffPair?.aId ?? null}
        docBId={diffPair?.bId ?? null}
        fileNameA={diffPair?.aName}
        fileNameB={diffPair?.bName}
      />
    </>
  );
}
