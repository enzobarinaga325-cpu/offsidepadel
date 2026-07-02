import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, Trophy, BarChart3, User, Shield, LogOut, Home, Users } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { OffsideLogo } from "@/components/OffsideLogo";
import { CategoryGate } from "@/components/CategoryGate";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const baseNav = [
  { icon: Trophy, label: "Torneos", path: "/tournaments" },
  { icon: Users, label: "Participantes", path: "/participantes" },
  { icon: BarChart3, label: "Ranking", path: "/ranking" },
  { icon: User, label: "Mi perfil", path: "/me" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const navItems = [
    ...baseNav,
    ...(isAdmin ? [{ icon: Shield, label: "Admin", path: "/admin" }] : []),
  ];

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between gap-2 px-3 md:px-6">
          {/* Left: mobile menu + logo */}
          <div className="flex items-center gap-2 min-w-0">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 -ml-2 md:hidden" aria-label="Abrir menú">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-background">
                <MobileMenu
                  items={navItems}
                  onNavigate={() => setOpen(false)}
                  onSignOut={handleSignOut}
                  initials={initials}
                  fullName={profile?.full_name}
                  isAuthed={!!user}
                />
              </SheetContent>
            </Sheet>

            <Link to={user ? (isAdmin ? "/admin" : "/tournaments") : "/"} className="flex items-center">
              <OffsideLogo height={64} className="dark:invert-0 invert" />
            </Link>
          </div>

          {/* Center: desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-1">
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            {user && <NotificationBell />}
            {user ? (
              <Link to="/me" className="hidden md:inline-flex" aria-label="Mi perfil">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Link to="/auth">
                <Button size="sm" className="h-9">Ingresar</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden">{children}</main>

      {user && <CategoryGate />}
    </div>
  );
}

function MobileMenu({
  items,
  onNavigate,
  onSignOut,
  initials,
  fullName,
  isAuthed,
}: {
  items: { icon: any; label: string; path: string }[];
  onNavigate: () => void;
  onSignOut: () => void;
  initials: string;
  fullName: string | null | undefined;
  isAuthed: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <Link
        to="/"
        onClick={onNavigate}
        className="flex h-20 items-center justify-center border-b"
      >
        <OffsideLogo height={56} className="dark:invert-0 invert" />
      </Link>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-3 rounded-md text-base transition-colors min-h-11",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-foreground hover:bg-accent/60"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3 space-y-3">
        <ThemeToggle />
        {isAuthed && (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate text-sm">{fullName || "Usuario"}</span>
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onSignOut} aria-label="Cerrar sesión">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
