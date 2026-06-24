import { Trophy, User, Shield, LogOut, BarChart3, Mail } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OffsideLogo } from "@/components/OffsideLogo";

const baseNav = [
  { icon: Trophy, label: "Torneos", path: "/tournaments" },
  { icon: BarChart3, label: "Ranking", path: "/ranking" },
  { icon: Mail, label: "Invitaciones", path: "/my-invitations" },
  { icon: User, label: "Mi perfil", path: "/me" },
];

export function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const navItems = [...baseNav, ...(isAdmin ? [{ icon: Shield, label: "Admin", path: "/admin" }] : [])];

  return (
    <>
      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-center justify-center px-3 h-20 border-b border-sidebar-border hover:opacity-90 transition-opacity"
      >
        <OffsideLogo height={collapsed ? 40 : 64} className="dark:invert-0 invert" />
      </Link>

      <nav className="flex-1 py-2 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2 space-y-2">
        {!collapsed && (
          <div className="px-1">
            <ThemeToggle />
          </div>
        )}
        <div className="flex items-center gap-2 px-1">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[10px] leading-none">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <span className="text-xs text-sidebar-foreground truncate flex-1">
                {profile?.full_name || "Usuario"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="text-sidebar-foreground hover:bg-sidebar-accent h-7 w-7"
                title="Cerrar sesión"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0 w-56">
      <div className="flex flex-col flex-1 overflow-hidden">
        <SidebarContent />
      </div>
    </aside>
  );
}
