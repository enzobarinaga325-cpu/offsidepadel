import { useState } from "react";
import { Link } from "react-router-dom";
import { AppSidebar, SidebarContent } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { OffsideLogo } from "@/components/OffsideLogo";
import { CategoryGate } from "@/components/CategoryGate";


export function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-3 md:px-4">
          <div className="flex items-center gap-2 md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 -ml-2" aria-label="Abrir menú">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-sidebar">
                <div className="flex flex-col h-full">
                  <SidebarContent onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Link to="/" className="flex items-center bg-black rounded-md px-2 py-1">
              <OffsideLogo height={20} className="[filter:none] dark:[filter:none]" />
            </Link>
          </div>
          <div className="hidden md:block" />
          {user && <NotificationBell />}
        </header>

        <main className="flex-1 overflow-auto overflow-x-hidden">
          {children}
        </main>
      </div>

      {user && <CategoryGate />}
    </div>
  );
}
