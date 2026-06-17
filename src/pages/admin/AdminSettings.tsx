import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Tag, Trophy, Users } from "lucide-react";

const shortcuts = [
  { path: "/admin/categories", label: "Gestionar categorías", icon: Tag },
  { path: "/admin/tournaments", label: "Gestionar torneos", icon: Trophy },
  { path: "/admin/players", label: "Gestionar jugadores", icon: Users },
];

export default function AdminSettings() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-[800px] px-4 md:px-6 py-6 md:py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 h-9">
          <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Volver</Link>
        </Button>
        <h1 className="text-2xl font-semibold mb-1">Configuración</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Accesos rápidos para administrar la plataforma.
        </p>
        <div className="grid gap-3">
          {shortcuts.map((s) => (
            <Link key={s.path} to={s.path}>
              <Card className="p-4 flex items-center gap-3 hover:border-primary transition-colors">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="font-medium">{s.label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
