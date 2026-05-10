import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import RootLayout from "./components/layout/RootLayout";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Solicitations from "./pages/Solicitations";
import SolicitationDetail from "./pages/SolicitationDetail";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound.tsx";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalLayout from "./features/portal/components/PortalLayout";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalSolicitations from "./pages/portal/PortalSolicitations";
import PortalSolicitationDetail from "./pages/portal/PortalSolicitationDetail";
import PortalReports from "./pages/portal/PortalReports";
import PortalProfile from "./pages/portal/PortalProfile";
import PortalSupport from "./pages/portal/PortalSupport";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/portal/login" element={<PortalLogin />} />
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
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
