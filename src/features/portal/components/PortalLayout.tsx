import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PortalHeader } from "./PortalHeader";
import { PortalSidebar } from "./PortalSidebar";
import { SupportWidget } from "./SupportWidget";
import { useClientUser } from "../hooks/useClientUser";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthContext } from "@/features/auth/components/AuthProvider";

export default function PortalLayout() {
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuthContext();
  const { isClient, isLoading } = useClientUser();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen p-6 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/portal/login" state={{ from: location }} replace />;
  }

  if (!isClient) {
    // Authenticated but not a client portal user
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex bg-muted/20">
      <PortalSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <PortalHeader />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
        <footer className="px-6 py-3 text-xs text-muted-foreground border-t bg-background">
          Powered by Solicitation Intelligence Analyzer
        </footer>
      </div>
      <SupportWidget />
    </div>
  );
}
