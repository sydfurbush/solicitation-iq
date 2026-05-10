import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  error?: Error | null;
  resetError?: () => void;
  title?: string;
  description?: string;
}

export function ErrorFallback({ error, resetError, title, description }: Props) {
  return (
    <Card className="max-w-lg mx-auto my-12">
      <CardContent className="p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 grid place-items-center text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title ?? "Something went wrong"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {description ?? error?.message ?? "An unexpected error occurred."}
          </p>
        </div>
        {resetError && (
          <Button onClick={resetError} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default ErrorFallback;
