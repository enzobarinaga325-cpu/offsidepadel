import { Link, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Trophy, Tag, ClipboardList } from "lucide-react";

const sections = [
  { path: "/admin/tournaments", label: "Torneos", desc: "Crear, editar, abrir/cerrar inscripciones", icon: Trophy },
  { path: "/admin/categories", label: "Categorías", desc: "Niveles, género y descripciones", icon: Tag },
  { path: "/admin/registrations", label: "Inscripciones", desc: "Aprobar, rechazar o mover a lista de espera", icon: ClipboardList },
];

export default function AdminHome() {
  return (
    <AppLayout>
      <div className="max-w-[1000px] mx-auto p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
          <p className="text-sm text-muted-foreground">Gestioná torneos, categorías e inscripciones.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((s) => (
            <Link key={s.path} to={s.path}>
              <Card className="p-5 hover:border-primary transition-colors cursor-pointer h-full">
                <s.icon className="h-6 w-6 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{s.label}</h3>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
