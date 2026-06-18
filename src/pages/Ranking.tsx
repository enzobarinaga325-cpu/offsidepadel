import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Medal } from "lucide-react";
import { Seo } from "@/components/Seo";
import type { Tables } from "@/integrations/supabase/types";

type RankRow = {
  player_id: string;
  full_name: string;
  avatar_url: string | null;
  total_points: number;
  tournaments_played: number;
  wins: number;
};

export default function Ranking() {
  const [categories, setCategories] = useState<Tables<"categories">[]>([]);
  const [categoryId, setCategoryId] = useState<string>("all");
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.from("categories").select("*").order("name").then(({ data }) => setCategories(data ?? []));
  }, []);

  useEffect(() => {
    void load();
  }, [categoryId]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_ranking", {
      _category_id: categoryId === "all" ? null : categoryId,
    });
    if (!error) setRows((data ?? []) as any);
    setLoading(false);
  }

  return (
    <AppLayout>
      <Seo
        title="Ranking de Pádel — Off-Side"
        description="Tabla de posiciones de jugadores de pádel por categoría: puntos acumulados, torneos jugados y títulos."
        path="/ranking"
      />
      <div className="max-w-[1000px] mx-auto p-4 md:p-8">
        <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ranking</h1>
            <p className="text-sm text-muted-foreground">Puntos acumulados por jugador.</p>
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[220px]" aria-label="Filtrar ranking por categoría"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : rows.length === 0 ? (
          <Card className="p-12 text-center">
            <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Aún no hay puntos cargados.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium w-14">#</th>
                  <th className="text-left px-4 py-3 font-medium">Jugador</th>
                  <th className="text-right px-4 py-3 font-medium">Torneos</th>
                  <th className="text-right px-4 py-3 font-medium">Títulos</th>
                  <th className="text-right px-4 py-3 font-medium">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.player_id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono">
                      {idx === 0 ? <Medal className="h-4 w-4 text-yellow-500" /> :
                       idx === 1 ? <Medal className="h-4 w-4 text-gray-400" /> :
                       idx === 2 ? <Medal className="h-4 w-4 text-amber-700" /> :
                       <span className="text-muted-foreground">{idx + 1}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          {r.avatar_url && <img src={r.avatar_url} alt="" />}
                          <AvatarFallback className="text-[10px]">
                            {r.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{r.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.tournaments_played}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{r.wins}</td>
                    <td className="px-4 py-3 text-right font-semibold">{r.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
