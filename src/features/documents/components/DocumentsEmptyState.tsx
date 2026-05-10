import { UploadCloud } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ALLOWED_EXTENSIONS } from "../utils/fileHelpers";
import { DocumentUploader } from "./DocumentUploader";

export function DocumentsEmptyState({ solicitationId }: { solicitationId: string }) {
  return (
    <Card>
      <CardContent className="p-8 space-y-6 text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <UploadCloud className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Upload solicitation documents to begin analysis</h3>
          <p className="text-sm text-muted-foreground">
            Supported types: {ALLOWED_EXTENSIONS.join(", ")} · up to 50MB each
          </p>
        </div>
        <DocumentUploader solicitationId={solicitationId} compact={false} />
      </CardContent>
    </Card>
  );
}
