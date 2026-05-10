import { ActivityFeed } from "@/features/collaboration/components/ActivityFeed";

interface Props { solicitationId: string }

export default function SolicitationActivity({ solicitationId }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Activity</h2>
        <p className="text-sm text-muted-foreground">All recent events on this solicitation.</p>
      </div>
      <ActivityFeed solicitationId={solicitationId} />
    </div>
  );
}
