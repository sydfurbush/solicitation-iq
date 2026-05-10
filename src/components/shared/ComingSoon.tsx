import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <Card>
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <CardTitle className="mt-2">Coming soon</CardTitle>
          <CardDescription>
            This area is being built. Check back shortly.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
