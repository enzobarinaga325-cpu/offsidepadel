import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Tournaments from "./pages/Tournaments";
import TournamentDetail from "./pages/TournamentDetail";
import MyProfile from "./pages/MyProfile";
import MyInvitations from "./pages/MyInvitations";
import Ranking from "./pages/Ranking";
import Participants from "./pages/Participants";
import Notifications from "./pages/Notifications";
import AdminHome from "./pages/admin/AdminHome";
import AdminTournaments from "./pages/admin/AdminTournaments";
import AdminTournamentForm from "./pages/admin/AdminTournamentForm";
import AdminTournamentManage from "./pages/admin/AdminTournamentManage";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminPlayers from "./pages/admin/AdminPlayers";
import AdminRegistrations from "./pages/admin/AdminRegistrations";
import AdminStats from "./pages/admin/AdminStats";
import AdminSettings from "./pages/admin/AdminSettings";
import NotFound from "./pages/NotFound";
import CategoriasGuide from "./pages/CategoriasGuide";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/tournaments/:id" element={<TournamentDetail />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/participantes" element={<Participants />} />
              <Route path="/guias/categorias" element={<CategoriasGuide />} />
              <Route path="/me" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
              <Route path="/my-invitations" element={<ProtectedRoute><MyInvitations /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminHome /></AdminRoute>} />
              <Route path="/admin/tournaments" element={<AdminRoute><AdminTournaments /></AdminRoute>} />
              <Route path="/admin/tournaments/new" element={<AdminRoute><AdminTournamentForm /></AdminRoute>} />
              <Route path="/admin/tournaments/:id/edit" element={<AdminRoute><AdminTournamentForm /></AdminRoute>} />
              <Route path="/admin/tournaments/:id/manage" element={<AdminRoute><AdminTournamentManage /></AdminRoute>} />
              <Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
              <Route path="/admin/players" element={<AdminRoute><AdminPlayers /></AdminRoute>} />
              <Route path="/admin/registrations" element={<AdminRoute><AdminRegistrations /></AdminRoute>} />
              <Route path="/admin/registrations/:tournamentId" element={<AdminRoute><AdminRegistrations /></AdminRoute>} />
              <Route path="/admin/stats" element={<AdminRoute><AdminStats /></AdminRoute>} />
              <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
