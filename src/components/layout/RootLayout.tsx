import { Outlet } from "react-router-dom";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { UserMenu } from "./UserMenu";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { UploadProgress } from "@/features/documents/components/UploadProgress";

export default function RootLayout() {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />

          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center justify-between border-b bg-background px-4 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
              </div>
              <UserMenu />
            </header>

            <main className="flex-1">
              <div className="container max-w-7xl py-6">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
