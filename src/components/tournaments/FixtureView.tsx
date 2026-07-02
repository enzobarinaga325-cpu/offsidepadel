import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roundLabels, roundOrder, matchStatusLabels, formatSetsScore } from "@/lib/match-helpers";
import { Calendar, Clock } from "lucide-react";
import { MatchResultDialog } from "@/components/admin/MatchResultDialog";
import { MatchScheduleDialog } from "@/components/admin/MatchScheduleDialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";


type Match = {
  id: string;
  round: string;
  bracket_position: number;
  group_id: string | null;
  pair_a_id: string | null;
  pair_b_id: string | null;
  winner_pair_id: string | null;
  score: any;
  status: string;
  court: string | null;
  scheduled_at: string | null;
};

type PairLabel = { id: string; label: string };

export function FixtureView({ tournamentId, tournamentCategoryId }: { tournamentId: string; tournamentCategoryId?: string }) {
  const { isAdmin } = useIsAdmin();
  const [matches, setMatches] = useState<Match[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [pairs, setPairs] = useState<Map<string, string>>(new Map());
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [scheduleMatch, setScheduleMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let mq = supabase.from("matches").select("*").eq("tournament_id", tournamentId).order("bracket_position");
    let gq = supabase.from("tournament_groups").select("id, name").eq("tournament_id", tournamentId).order("position");
    if (tournamentCategoryId) {
      mq = mq.eq("tournament_category_id", tournamentCategoryId);
      gq = gq.eq("tournament_category_id", tournamentCategoryId);
    }
    const [{ data: m }, { data: g }, { data: parts }] = await Promise.all([
      mq, gq,
      (supabase.rpc as any)("get_tournament_participants", { _tournament_id: tournamentId }),
    ]);
    setMatches((m ?? []) as Match[]);
    setGroups(g ?? []);

    const pairMap = new Map<string, string>();
    ((parts ?? []) as any[]).forEach((r) => {
      const a = r.player1_name ?? "Jugador";
      const b = r.player2_name ?? "Jugador";
      pairMap.set(r.pair_id, r.display_name?.trim() ? r.display_name : `${a} / ${b}`);
    });
    setPairs(pairMap);
    setLoading(false);
  }, [tournamentId, tournamentCategoryId]);


  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`matches:${tournamentId}:${tournamentCategoryId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tournamentId, tournamentCategoryId, load]);

  if (loading) return <p className="text-sm text-muted-foreground">Cargando fixture…</p>;
  if (matches.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">El fixture aún no fue generado.</p>
      </Card>
    );
  }

  const groupMatches = matches.filter((m) => m.group_id);
  const bracketMatches = matches.filter((m) => !m.group_id);
  const bracketByRound = bracketMatches.reduce<Record<string, Match[]>>((acc, m) => {
    (acc[m.round] ||= []).push(m);
    return acc;
  }, {});
  const rounds = Object.keys(bracketByRound).sort((a, b) => roundOrder[a] - roundOrder[b]);

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const ms = groupMatches.filter((m) => m.group_id === g.id);
        if (ms.length === 0) return null;
        return (
          <div key={g.id}>
            <h3 className="font-semibold mb-2">{g.name}</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {ms.map((m) => (
                <MatchCard key={m.id} m={m} pairs={pairs} isAdmin={isAdmin}
                  onEdit={() => setEditMatch(m)}
                  onSchedule={() => setScheduleMatch(m)} />
              ))}
            </div>
          </div>
        );
      })}

      {rounds.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Cuadro</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {rounds.map((r) => (
              <div key={r} className="min-w-[240px] flex-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{roundLabels[r]}</div>
                <div className="space-y-2">
                  {bracketByRound[r].sort((a, b) => a.bracket_position - b.bracket_position).map((m) => (
                    <MatchCard key={m.id} m={m} pairs={pairs} isAdmin={isAdmin}
                      onEdit={() => setEditMatch(m)}
                      onSchedule={() => setScheduleMatch(m)} compact />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {editMatch && (
        <MatchResultDialog
          match={editMatch}
          pairLabelA={editMatch.pair_a_id ? pairs.get(editMatch.pair_a_id) ?? "—" : "—"}
          pairLabelB={editMatch.pair_b_id ? pairs.get(editMatch.pair_b_id) ?? "—" : "—"}
          open={!!editMatch}
          onOpenChange={(o) => !o && setEditMatch(null)}
          onSuccess={() => { setEditMatch(null); void load(); }}
        />
      )}

      {scheduleMatch && (
        <MatchScheduleDialog
          match={scheduleMatch}
          pairLabelA={scheduleMatch.pair_a_id ? pairs.get(scheduleMatch.pair_a_id) ?? "—" : "—"}
          pairLabelB={scheduleMatch.pair_b_id ? pairs.get(scheduleMatch.pair_b_id) ?? "—" : "—"}
          open={!!scheduleMatch}
          onOpenChange={(o) => !o && setScheduleMatch(null)}
          onSuccess={() => { setScheduleMatch(null); void load(); }}
        />
      )}
    </div>
  );
}

function MatchCard({
  m, pairs, isAdmin, onEdit, onSchedule, compact,
}: {
  m: Match;
  pairs: Map<string, string>;
  isAdmin: boolean;
  onEdit: () => void;
  onSchedule: () => void;
  compact?: boolean;
}) {
  const a = m.pair_a_id ? pairs.get(m.pair_a_id) ?? "BYE" : "Por definir";
  const b = m.pair_b_id ? pairs.get(m.pair_b_id) ?? "BYE" : "Por definir";
  const aWon = m.winner_pair_id && m.winner_pair_id === m.pair_a_id;
  const bWon = m.winner_pair_id && m.winner_pair_id === m.pair_b_id;
  return (
    <Card className={`p-3 ${compact ? "text-xs" : "text-sm"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge variant="outline" className="text-[10px]">{matchStatusLabels[m.status] ?? m.status}</Badge>
        {m.court && <span className="text-[11px] text-muted-foreground">{m.court}</span>}
      </div>
      <div className="space-y-1">
        <div className={`flex justify-between gap-2 ${aWon ? "font-semibold" : ""}`}>
          <span className="truncate">{a}</span>
        </div>
        <div className={`flex justify-between gap-2 ${bWon ? "font-semibold" : ""}`}>
          <span className="truncate">{b}</span>
        </div>
      </div>
      {(m.status === "finished" || m.status === "walkover") && (
        <div className="text-[11px] text-muted-foreground mt-2 font-mono">{formatSetsScore(m.score)}</div>
      )}
      {m.scheduled_at && (
        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(m.scheduled_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
        </div>
      )}
      {isAdmin && (
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={onSchedule}>
            <Clock className="h-3 w-3 mr-1" />Programar
          </Button>
          {m.pair_a_id && m.pair_b_id && (
            <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={onEdit}>
              {m.status === "scheduled" ? "Resultado" : "Editar"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

