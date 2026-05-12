import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import RootLayout from "./components/layout/RootLayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { GlobalSearch } from "@/features/search/components/GlobalSearch";
import { KeyboardShortcutsHelp } from "@/components/shared/KeyboardShortcutsHelp";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { initErrorTracking } from "@/lib/errorTracking";
import "@/styles/print.css";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Solicitations = lazy(() => import("./pages/Solicitations"));
const SolicitationDetail = lazy(() => import("./pages/SolicitationDetail"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const Help = lazy(() => import("./pages/Help"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PortalLogin = lazy(() => import("./pages/portal/PortalLogin"));
const PortalAcceptInvite = lazy(() => import("./pages/portal/PortalAcceptInvite"));
const PortalLayout = lazy(() => import("./features/portal/components/PortalLayout"));
const PortalDashboard = lazy(() => import("./pages/portal/PortalDashboard"));
const PortalSolicitations = lazy(() => import("./pages/portal/PortalSolicitations"));
const PortalSolicitationDetail = lazy(() => import("./pages/portal/PortalSolicitationDetail"));
const PortalReports = lazy(() => import("./pages/portal/PortalReports"));
const PortalProfile = lazy(() => import("./pages/portal/PortalProfile"));
const PortalSupport = lazy(() => import("./pages/portal/PortalSupport"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

initErrorTracking();

function GlobalShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onCmd = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onCmd);
    return () => window.removeEventListener("keydown", onCmd);
  }, []);

  useKeyboardShortcuts([
    { key: "?", shift: true, handler: () => setHelpOpen(true) },
    { key: "Escape", handler: () => { setSearchOpen(false); setHelpOpen(false); } },
  ]);

  return (
    <>
      {children}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="bottom-right" />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <GlobalShell>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/portal/login" element={<PortalLogin />} />
                  <Route path="/portal/accept-invite" element={<PortalAcceptInvite />} />
                  <Route path="/portal" element={<PortalLayout />}>
                    <Route index element={<PortalDashboard />} />
                    <Route path="solicitations" element={<PortalSolicitations />} />
                    <Route path="solicitations/:id" element={<PortalSolicitationDetail />} />
                    <Route path="solicitations/:id/reports" element={<PortalReports />} />
                    <Route path="reports" element={<PortalSolicitations />} />
                    <Route path="profile" element={<PortalProfile />} />
                    <Route path="support" element={<PortalSupport />} />
                  </Route>
                  <Route element={<RootLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/clients/:clientId" element={<ClientDetail />} />
                    <Route path="/solicitations" element={<Solicitations />} />
                    <Route path="/solicitations/:solicitationId" element={<SolicitationDetail />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/help" element={<Help />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </GlobalShell>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
