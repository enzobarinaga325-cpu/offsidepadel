import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Users, ClipboardList, Tag, Loader2 } from "lucide-react";

type Stats = {
  tournaments: number;
  players: number;
  registrations: number;
  categories: number;
  in_progress: number;
  finished: number;
};

export default function AdminStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [t, p, r, c, ip, fn] = await Promise.all([
        supabase.from("tournaments").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("registrations").select("id", { count: "exact", head: true }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("tournaments").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
        supabase.from("tournaments").select("id", { count: "exact", head: true }).eq("status", "finished"),
      ]);
      setStats({
        tournaments: t.count || 0,
        players: p.count || 0,
        registrations: r.count || 0,
        categories: c.count || 0,
        in_progress: ip.count || 0,
        finished: fn.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  const items = [
    { label: "Torneos totales", value: stats?.tournaments, icon: Trophy },
    { label: "Jugadores", value: stats?.players, icon: Users },
    { label: "Inscripciones", value: stats?.registrations, icon: ClipboardList },
    { label: "Categorías", value: stats?.categories, icon: Tag },
    { label: "En curso", value: stats?.in_progress, icon: Trophy },
    { label: "Finalizados", value: stats?.finished, icon: Trophy },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1000px] px-4 md:px-6 py-6 md:py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 h-9">
          <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Volver</Link>
        </Button>
        <h1 className="text-2xl font-semibold mb-1">Estadísticas</h1>
        <p className="text-sm text-muted-foreground mb-6">Resumen general de la plataforma.</p>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {items.map((s) => (
              <Card key={s.label} className="p-5">
                <s.icon className="h-5 w-5 text-primary mb-3" />
                <div className="text-3xl font-bold">{s.value ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
