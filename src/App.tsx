import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Queue from "./pages/Queue";
import Lobby from "./pages/Lobby";
import MapBan from "./pages/MapBan";
import Leaderboard from "./pages/Leaderboard";
import MatchHistory from "./pages/MatchHistory";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPlayers from "./pages/admin/AdminPlayers";
import AdminMatches from "./pages/admin/AdminMatches";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import { Loader2 } from "lucide-react";
import { X1InviteListener } from "@/components/X1InviteListener";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <>
  <X1InviteListener />
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/queue" element={<ProtectedRoute><Queue /></ProtectedRoute>} />
    <Route path="/lobby" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
    <Route path="/match/:matchId/lobby" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
    <Route path="/match/:matchId/ban" element={<ProtectedRoute><MapBan /></ProtectedRoute>} />
    <Route path="/leaderboard" element={<Leaderboard />} />
    <Route path="/history" element={<ProtectedRoute><MatchHistory /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
    <Route path="/admin/players" element={<AdminRoute><AdminPlayers /></AdminRoute>} />
    <Route path="/admin/matches" element={<AdminRoute><AdminMatches /></AdminRoute>} />
    <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
    <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
