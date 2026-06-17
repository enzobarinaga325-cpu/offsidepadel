import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Loader2, ShieldAlert } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="mx-auto flex max-w-md flex-col items-center text-center px-6 py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold">Acceso restringido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No tenés permisos para entrar al panel de administración. Si creés que es un error, contactá al administrador.
          </p>
          <Button asChild className="mt-6 h-11">
            <Link to="/tournaments">Volver a Torneos</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return <>{children}</>;
}
