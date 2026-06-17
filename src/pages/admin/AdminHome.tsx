import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { OffsideLogo } from "@/components/OffsideLogo";
import { useAuth } from "@/contexts/AuthContext";
import {
  Trophy,
  Users,
  BarChart3,
  ClipboardList,
  Tag,
  LineChart,
  Settings,
  ListChecks,
} from "lucide-react";

const tiles = [
  {
    path: "/admin/tournaments",
    label: "Torneos",
    desc: "Crear, editar y gestionar tus torneos",
    icon: Trophy,
    accent: "from-amber-500/20 to-amber-500/0 text-amber-500",
  },
  {
    path: "/admin/players",
    label: "Jugadores",
    desc: "Buscar jugadores y asignar categoría",
    icon: Users,
    accent: "from-sky-500/20 to-sky-500/0 text-sky-500",
  },
  {
    path: "/ranking",
    label: "Ranking",
    desc: "Ver el ranking oficial por categoría",
    icon: BarChart3,
    accent: "from-violet-500/20 to-violet-500/0 text-violet-500",
  },
  {
    path: "/admin/registrations",
    label: "Inscripciones",
    desc: "Aprobar, rechazar y mover a espera",
    icon: ClipboardList,
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-500",
  },
  {
    path: "/admin/categories",
    label: "Categorías",
    desc: "Niveles, género y descripciones",
    icon: Tag,
    accent: "from-pink-500/20 to-pink-500/0 text-pink-500",
  },
  {
    path: "/admin/tournaments",
    label: "Resultados",
    desc: "Cargar resultados y avanzar el cuadro",
    icon: ListChecks,
    accent: "from-cyan-500/20 to-cyan-500/0 text-cyan-500",
  },
  {
    path: "/admin/stats",
    label: "Estadísticas",
    desc: "Resumen general de la plataforma",
    icon: LineChart,
    accent: "from-orange-500/20 to-orange-500/0 text-orange-500",
  },
  {
    path: "/admin/settings",
    label: "Configuración",
    desc: "Preferencias y datos generales",
    icon: Settings,
    accent: "from-zinc-400/20 to-zinc-400/0 text-zinc-300",
  },
];

export default function AdminHome() {
  const { profile } = useAuth();
  const name = profile?.full_name?.split(" ")[0] || "Administrador";

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-8 md:py-12">
        {/* Hero */}
        <div className="mb-8 md:mb-10 flex flex-col items-center text-center">
          <div className="mb-4 rounded-2xl bg-black px-4 py-3">
            <OffsideLogo height={32} className="[filter:none] dark:[filter:none]" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Hola, {name} 👋
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-md">
            Bienvenido al panel de OFFSIDE. Elegí qué querés gestionar hoy.
          </p>
        </div>

        {/* Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {tiles.map((t, i) => (
            <Link
              key={t.label}
              to={t.path}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 md:p-6 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{ animation: `fade-in 0.4s ease both ${i * 0.04}s` }}
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity group-hover:opacity-100 ${t.accent}`}
              />
              <div className="relative flex flex-col gap-3 min-h-[120px]">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-background/80 backdrop-blur ${t.accent.split(' ').pop()}`}>
                  <t.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-semibold">{t.label}</h3>
                  <p className="mt-1 text-xs md:text-sm text-muted-foreground">{t.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
