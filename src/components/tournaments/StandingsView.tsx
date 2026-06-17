import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

type Group = { id: string; name: string };
type Standing = {
  pair_id: string; played: number; won: number; lost: number;
  sets_for: number; sets_against: number; games_for: number; games_against: number; points: number;
};

export function StandingsView({ tournamentId }: { tournamentId: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [standings, setStandings] = useState<Map<string, Standing[]>>(new Map());
  const [pairs, setPairs] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    const { data: g } = await supabase.from("tournament_groups").select("id, name").eq("tournament_id", tournamentId).order("position");
    setGroups(g ?? []);
    if (!g || g.length === 0) return;
    const groupIds = g.map((x) => x.id);
    const { data: s } = await supabase
      .from("standings")
      .select("*, group_id")
      .in("group_id", groupIds)
      .order("points", { ascending: false });
    const map = new Map<string, Standing[]>();
    (s ?? []).forEach((row: any) => {
      const arr = map.get(row.group_id) ?? [];
      arr.push(row);
      map.set(row.group_id, arr);
    });
    setStandings(map);
    const { data: p } = await supabase.from("pairs").select("id, player1_id, player2_id").eq("tournament_id", tournamentId);
    const userIds = new Set<string>();
    (p ?? []).forEach((pr: any) => { userIds.add(pr.player1_id); userIds.add(pr.player2_id); });
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", Array.from(userIds));
    const nm = new Map<string, string>();
    (profs ?? []).forEach((pp) => nm.set(pp.user_id, pp.full_name ?? "Jugador"));
    const pm = new Map<string, string>();
    (p ?? []).forEach((pr: any) => pm.set(pr.id, `${nm.get(pr.player1_id) ?? "?"} / ${nm.get(pr.player2_id) ?? "?"}`));
    setPairs(pm);
  }, [tournamentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(`standings:${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "standings" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tournamentId, load]);

  if (groups.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Sin tabla de posiciones (este torneo no tiene fase de grupos).</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const rows = standings.get(g.id) ?? [];
        return (
          <Card key={g.id} className="overflow-hidden">
            <div className="px-4 py-2 bg-muted/40 font-semibold text-sm border-b border-border">{g.name}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Pareja</th>
                    <th className="px-2 py-2">PJ</th>
                    <th className="px-2 py-2">G</th>
                    <th className="px-2 py-2">P</th>
                    <th className="px-2 py-2">Sets</th>
                    <th className="px-2 py-2">Games</th>
                    <th className="px-2 py-2">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pair_id} className="border-t border-border">
                      <td className="px-3 py-2">{pairs.get(r.pair_id) ?? "—"}</td>
                      <td className="px-2 py-2 text-center">{r.played}</td>
                      <td className="px-2 py-2 text-center">{r.won}</td>
                      <td className="px-2 py-2 text-center">{r.lost}</td>
                      <td className="px-2 py-2 text-center text-xs">{r.sets_for}-{r.sets_against}</td>
                      <td className="px-2 py-2 text-center text-xs">{r.games_for}-{r.games_against}</td>
                      <td className="px-2 py-2 text-center font-semibold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
