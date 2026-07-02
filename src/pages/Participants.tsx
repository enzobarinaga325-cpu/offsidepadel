import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Seo } from "@/components/Seo";
import { Users } from "lucide-react";
import { tournamentCategoryLabel } from "@/lib/tournament-helpers";

type Tournament = { id: string; name: string; start_date: string | null; status: string };
type Category = { id: string; name: string; level: string | null };
type TC = {
  id: string;
  tournament_id: string;
  category_id: string | null;
  mode: any;
  suma_value: number | null;
  gender: any;
  label: string | null;
  position: number | null;
  category: Category | null;
};
type Pair = { id: string; player1_id: string | null; player2_id: string | null; display_name: string | null };
type Profile = { user_id: string; full_name: string | null; avatar_url: string | null };
type Reg = { id: string; tournament_category_id: string; pair_id: string };

export default function Participants() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [tcs, setTcs] = useState<TC[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [pairs, setPairs] = useState<Record<string, Pair>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id,name,start_date,status")
        .in("status", ["open", "full", "in_progress", "upcoming", "finished"])
        .order("start_date", { ascending: false });
      const list = (data ?? []) as Tournament[];
      setTournaments(list);
      const active = list.find((t) => t.status !== "finished") ?? list[0];
      if (active) setSelected(active.id);
      else setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      setLoading(true);
      const [{ data: tcData }, { data: regData }] = await Promise.all([
        supabase
          .from("tournament_categories")
          .select("id,tournament_id,category_id,mode,suma_value,gender,label,position, category:categories(id,name,level)")
          .eq("tournament_id", selected)
          .order("position"),
        supabase
          .from("public_registrations")
          .select("id,tournament_category_id,pair_id")
          .eq("tournament_id", selected)
          .eq("status", "approved"),
      ]);
      const tcRows = (tcData ?? []) as any as TC[];
      const regRows = (regData ?? []).filter((r) => r.pair_id && r.tournament_category_id) as any as Reg[];
      setTcs(tcRows);
      setRegs(regRows);

      const pairIds = Array.from(new Set(regRows.map((r) => r.pair_id)));
      let pairMap: Record<string, Pair> = {};
      let profMap: Record<string, Profile> = {};
      if (pairIds.length) {
        const { data: pd } = await supabase
          .from("pairs")
          .select("id,player1_id,player2_id,display_name")
          .in("id", pairIds);
        (pd ?? []).forEach((p: any) => (pairMap[p.id] = p));
        const userIds = Array.from(
          new Set(
            (pd ?? []).flatMap((p: any) => [p.player1_id, p.player2_id]).filter(Boolean)
          )
        );
        if (userIds.length) {
          const { data: prof } = await supabase
            .from("profiles_public")
            .select("user_id,full_name,avatar_url")
            .in("user_id", userIds);
          (prof ?? []).forEach((p: any) => {
            if (p.user_id) profMap[p.user_id] = p;
          });
        }
      }
      setPairs(pairMap);
      setProfiles(profMap);
      setLoading(false);
    })();
  }, [selected]);

  const grouped = useMemo(() => {
    return tcs
      .map((tc) => ({
        tc,
        pairs: regs
          .filter((r) => r.tournament_category_id === tc.id)
          .map((r) => pairs[r.pair_id])
          .filter(Boolean) as Pair[],
      }))
      .filter((g) => g.pairs.length > 0);
  }, [tcs, regs, pairs]);

  const initials = (name?: string | null) =>
    name ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : "?";

  const playerName = (uid: string | null | undefined) =>
    (uid && profiles[uid]?.full_name) || "Jugador";

  return (
    <AppLayout>
      <Seo
        title="Participantes — Off-Side"
        description="Consultá los jugadores inscriptos en cada torneo de pádel, agrupados por categoría."
        path="/participantes"
      />
      <div className="max-w-[1000px] mx-auto p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Participantes</h1>
          <p className="text-sm text-muted-foreground">
            Jugadores inscriptos en cada torneo, agrupados por categoría.
          </p>
        </div>

        <div className="mb-6 max-w-md">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Elegí un torneo" />
            </SelectTrigger>
            <SelectContent>
              {tournaments.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : grouped.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-6 w-6 opacity-60" />
            No hay parejas inscriptas todavía en este torneo.
          </Card>
        ) : (
          <div className="space-y-8">
            {grouped.map(({ tc, pairs: gp }) => (
              <section key={tc.id}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">
                    {tournamentCategoryLabel(tc as any)}
                  </h2>
                  <span className="text-xs text-muted-foreground">{gp.length} parejas</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {gp.map((pair) => {
                    const p1 = profiles[pair.player1_id || ""];
                    const p2 = profiles[pair.player2_id || ""];
                    const label =
                      pair.display_name?.trim() ||
                      `${playerName(pair.player1_id)} / ${playerName(pair.player2_id)}`;
                    return (
                      <Card key={pair.id} className="flex items-center gap-3 p-3">
                        <div className="flex -space-x-2">
                          <Avatar className="h-9 w-9 border-2 border-background">
                            {p1?.avatar_url && <AvatarImage src={p1.avatar_url} />}
                            <AvatarFallback className="text-xs">
                              {initials(p1?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <Avatar className="h-9 w-9 border-2 border-background">
                            {p2?.avatar_url && <AvatarImage src={p2.avatar_url} />}
                            <AvatarFallback className="text-xs">
                              {initials(p2?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{label}</p>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
