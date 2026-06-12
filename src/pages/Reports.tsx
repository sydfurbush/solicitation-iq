import { ComingSoon } from "@/components/shared/ComingSoon";
import { PdfToolsMenu } from "@/features/exports/components/PdfToolsMenu";

export default function Reports() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-2 flex items-center justify-end gap-2 bg-background">
        <PdfToolsMenu />
      </div>
      <div className="flex-1 min-h-0">
        <ComingSoon
          title="Reports"
          description="Generate strategic intelligence reports for clients."
        />
      </div>
    </div>
  );
}
