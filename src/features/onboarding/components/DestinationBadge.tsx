import { Badge } from "@/components/ui/badge";
import { DESTINATION_LABELS, type Destination } from "../../../../supabase/functions/_shared/onboardingTriage";

export function DestinationBadge({ destination }: { destination: string }) {
  const label = DESTINATION_LABELS[destination as Destination] ?? destination;
  if (destination === "restricted") return <Badge variant="destructive">{label}</Badge>;
  if (destination === "partner_profile") return <Badge variant="outline" className="border-partner/40 bg-partner/10 text-partner">{label}</Badge>;
  if (destination === "not_needed") return <Badge variant="secondary" className="text-muted-foreground">{label}</Badge>;
  return <Badge variant="outline">{label}</Badge>;
}