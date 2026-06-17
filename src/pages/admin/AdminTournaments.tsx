import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Copy, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  statusLabels,
  statusColors,
  formatDate,
  formatCurrency,
  type TournamentStatus,
} from "@/lib/tournament-helpers";
import type { Tables } from "@/integrations/supabase/types";

type Tournament = Tables<"tournaments"> & { category: Tables<"categories"> | null };

export default function AdminTournaments() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("tournaments")
      .select("*, category:categories(*)")
      .order("start_date", { ascending: false });
    setItems((data ?? []) as Tournament[]);
    setLoading(false);
  }

  async function toggleRegistration(t: Tournament) {
    const newOpen = !t.registration_open;
    const { error } = await supabase
      .from("tournaments")
      .update({ registration_open: newOpen, status: newOpen ? "open" : t.status })
      .eq("id", t.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    void load();
  }

  async function duplicate(t: Tournament) {
    const { id, created_at, updated_at, category, ...rest } = t as any;
    const copy = { ...rest, name: `${t.name} (copia)`, status: "upcoming", registration_open: false };
    const { error } = await supabase.from("tournaments").insert(copy);
    if (error) {
      toast({ title: "Error al duplicar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Torneo duplicado" });
    void load();
  }

  async function remove(t: Tournament) {
    if (!confirm(`¿Eliminar el torneo "${t.name}"? Se borrarán también inscripciones y parejas.`)) return;
    const { error } = await supabase.from("tournaments").delete().eq("id", t.id);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Torneo eliminado" });
    void load();
  }

  return (
    <AppLayout>
      <div className="max-w-[1200px] mx-auto p-4 md:p-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Panel</Link>
        </Button>

        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Torneos</h1>
            <p className="text-sm text-muted-foreground">Crear, editar y administrar torneos.</p>
          </div>
          <Button onClick={() => navigate("/admin/tournaments/new")}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo torneo
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">No hay torneos todavía.</p>
            <Button onClick={() => navigate("/admin/tournaments/new")}>
              <Plus className="h-4 w-4 mr-1" />Crear el primero
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium">Categoría</th>
                    <th className="text-left px-4 py-3 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 font-medium">Precio</th>
                    <th className="text-left px-4 py-3 font-medium">Inscripciones</th>
                    <th className="text-right px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{t.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(t.start_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.category?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusColors[t.status as TournamentStatus]}>
                          {statusLabels[t.status as TournamentStatus]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{formatCurrency(t.registration_fee)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Switch checked={t.registration_open} onCheckedChange={() => toggleRegistration(t)} />
                          <span className="text-xs text-muted-foreground">{t.registration_open ? "Abiertas" : "Cerradas"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/registrations/${t.id}`)} title="Ver inscriptos">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/tournaments/${t.id}/edit`)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => duplicate(t)} title="Duplicar">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(t)} title="Eliminar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
