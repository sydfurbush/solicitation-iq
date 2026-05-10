import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-1/3" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export default CardSkeleton;
