import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Users, Search, Trophy } from "lucide-react";
import {
  statusLabels,
  statusColors,
  tournamentTypeLabels,
  formatDate,
  formatCurrency,
  type TournamentStatus,
} from "@/lib/tournament-helpers";
import type { Tables } from "@/integrations/supabase/types";

type Tournament = Tables<"tournaments"> & {
  category: Tables<"categories"> | null;
  approved_count: number;
};

export default function Tournaments() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [categories, setCategories] = useState<Tables<"categories">[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: tData }, { data: cData }] = await Promise.all([
      supabase
        .from("tournaments")
        .select("*, category:categories(*)")
        .order("start_date", { ascending: true }),
      supabase.from("categories").select("*").order("name"),
    ]);

    // counts of approved registrations per tournament
    const { data: regs } = await supabase
      .from("registrations")
      .select("tournament_id")
      .eq("status", "approved");
    const counts = new Map<string, number>();
    (regs ?? []).forEach((r) => counts.set(r.tournament_id, (counts.get(r.tournament_id) ?? 0) + 1));

    setTournaments(
      (tData ?? []).map((t: any) => ({ ...t, approved_count: counts.get(t.id) ?? 0 }))
    );
    setCategories(cData ?? []);
    setLoading(false);
  }

  const filtered = tournaments.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (categoryFilter !== "all" && t.category_id !== categoryFilter) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="max-w-[1200px] mx-auto p-4 md:p-8">
        <div className="flex flex-col gap-1 mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Torneos</h1>
          <p className="text-sm text-muted-foreground">
            Explorá los torneos disponibles e inscribite con tu compañero.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar torneo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[200px] h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-[200px] h-9">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando torneos…</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No hay torneos que coincidan con tus filtros.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => (
              <Card
                key={t.id}
                className="overflow-hidden cursor-pointer hover:border-primary transition-colors flex flex-col"
                onClick={() => navigate(`/tournaments/${t.id}`)}
              >
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30">
                      <Trophy className="h-10 w-10 text-primary/60" />
                    </div>
                  )}
                  <Badge
                    variant="outline"
                    className={`absolute top-2 right-2 ${statusColors[t.status as TournamentStatus]}`}
                  >
                    {statusLabels[t.status as TournamentStatus]}
                  </Badge>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <h3 className="font-semibold text-base line-clamp-2">{t.name}</h3>
                  {t.category && (
                    <Badge variant="secondary" className="w-fit text-[11px]">
                      {t.category.name}
                    </Badge>
                  )}
                  <div className="space-y-1.5 text-[12px] text-muted-foreground mt-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(t.start_date)} {t.start_time && `· ${t.start_time.slice(0, 5)} hs`}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate">{t.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>{t.approved_count} / {t.max_pairs} parejas</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                    <span className="text-[11px] text-muted-foreground">{tournamentTypeLabels[t.tournament_type as keyof typeof tournamentTypeLabels]}</span>
                    <span className="text-sm font-medium">{formatCurrency(t.registration_fee)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
