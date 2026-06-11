import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/features/auth/hooks/useUser";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

export function AssistantAnalyticsButton() {
  const { role } = useUser();
  const [open, setOpen] = useState(false);
  if (role !== "owner" && role !== "admin") return null;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => setOpen(true)}
        title="Assistant analytics"
        aria-label="Assistant analytics"
      >
        <BarChart3 className="h-3.5 w-3.5" />
      </Button>
      <AnalyticsDashboard open={open} onOpenChange={setOpen} />
    </>
  );
}
