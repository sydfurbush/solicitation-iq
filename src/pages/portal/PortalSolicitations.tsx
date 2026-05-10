import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientSolicitations } from "@/features/portal/hooks/useClientPortal";

export default function PortalSolicitations() {
  const { data: solicitations = [], isLoading } = useClientSolicitations();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Solicitations</h1>
        <p className="text-muted-foreground">All solicitations linked to your account.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : solicitations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No solicitations available yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {solicitations.map((s: any) => (
            <Link key={s.id} to={`/portal/solicitations/${s.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{s.title}</h3>
                      <div className="text-sm text-muted-foreground mt-1 space-x-3">
                        {s.solicitation_number && <span>{s.solicitation_number}</span>}
                        {s.issuing_agency && <span>· {s.issuing_agency}</span>}
                      </div>
                      {s.ai_summary && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{s.ai_summary}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant="outline" className="capitalize">{s.status}</Badge>
                      {s.proposal_due_date && (
                        <span className="text-xs text-muted-foreground">
                          Due {format(new Date(s.proposal_due_date), "PP")}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
