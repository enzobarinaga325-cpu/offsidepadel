import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Shuffle, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Participant = {
  registration_id: string;
  tournament_category_id: string | null;
  pair_id: string;
  player1_name: string | null;
  player2_name: string | null;
  display_name: string | null;
};

type GroupDraft = { id?: string; name: string; pair_ids: string[] };

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function labelForPair(p: Participant | undefined): string {
  if (!p) return "Pareja";
  if (p.display_name && p.display_name.trim()) return p.display_name;
  const a = p.player1_name ?? "Jugador";
  const b = p.player2_name ?? "Jugador";
  return `${a} / ${b}`;
}

export function GroupsManager({
  tournamentId, tournamentCategoryId,
}: {
  tournamentId: string;
  tournamentCategoryId: string;
}) {
  const { toast } = useToast();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [draft, setDraft] = useState<GroupDraft[]>([]);
  const [groupsCount, setGroupsCount] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, [tournamentId, tournamentCategoryId]);

  async function load() {
    setLoading(true);
    const [{ data: parts }, { data: groups }, { data: st }] = await Promise.all([
      (supabase.rpc as any)("get_tournament_participants", { _tournament_id: tournamentId }),
      supabase.from("tournament_groups").select("id, name, position")
        .eq("tournament_category_id", tournamentCategoryId).order("position"),
      supabase.from("standings").select("group_id, pair_id"),
    ]);
    const filtered = ((parts ?? []) as Participant[]).filter(
      (p) => p.tournament_category_id === tournamentCategoryId
    );
    setParticipants(filtered);

    const stByGroup = new Map<string, string[]>();
    (st ?? []).forEach((row: any) => {
      const arr = stByGroup.get(row.group_id) ?? [];
      arr.push(row.pair_id);
      stByGroup.set(row.group_id, arr);
    });

    if ((groups ?? []).length > 0) {
      setDraft((groups ?? []).map((g: any) => ({
        id: g.id,
        name: g.name,
        pair_ids: (stByGroup.get(g.id) ?? []).filter((pid) => filtered.some((p) => p.pair_id === pid)),
      })));
    } else {
      setDraft([]);
    }
    setLoading(false);
  }

  const assigned = new Set(draft.flatMap((g) => g.pair_ids));
  const unassigned = participants.filter((p) => !assigned.has(p.pair_id));

  function drawGroups() {
    if (participants.length < 2) {
      toast({ title: "Necesitás al menos 2 parejas aprobadas", variant: "destructive" });
      return;
    }
    const n = Math.max(1, Math.min(groupsCount, participants.length));
    const shuffled = shuffle(participants);
    const groups: GroupDraft[] = Array.from({ length: n }, (_, i) => ({
      name: `Grupo ${String.fromCharCode(65 + i)}`,
      pair_ids: [],
    }));
    shuffled.forEach((p, i) => {
      groups[i % n].pair_ids.push(p.pair_id);
    });
    setDraft(groups);
  }

  function movePair(pairId: string, targetGroupIdx: number) {
    setDraft((prev) => {
      const next = prev.map((g) => ({ ...g, pair_ids: g.pair_ids.filter((id) => id !== pairId) }));
      if (targetGroupIdx >= 0 && next[targetGroupIdx]) {
        next[targetGroupIdx].pair_ids.push(pairId);
      }
      return next;
    });
  }

  function addUnassigned(pairId: string, groupIdx: number) {
    movePair(pairId, groupIdx);
  }

  function renameGroup(idx: number, name: string) {
    setDraft((prev) => prev.map((g, i) => (i === idx ? { ...g, name } : g)));
  }

  function removeGroup(idx: number) {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function addGroup() {
    setDraft((prev) => [...prev, { name: `Grupo ${String.fromCharCode(65 + prev.length)}`, pair_ids: [] }]);
  }

  async function save() {
    setSaving(true);
    const payload = draft.map((g) => ({ name: g.name, pair_ids: g.pair_ids }));
    const { error } = await (supabase.rpc as any)("admin_set_category_groups", {
      _tournament_category_id: tournamentCategoryId,
      _groups: payload,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Zonas guardadas", description: "Se generaron los partidos todos contra todos." });
    void load();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando parejas…</p>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="text-sm">
            <div className="font-semibold">{participants.length} parejas aprobadas</div>
            <div className="text-xs text-muted-foreground">Sorteo aleatorio en zonas iguales.</div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cantidad de zonas</Label>
            <Input type="number" min={1} max={Math.max(participants.length, 1)} value={groupsCount}
              onChange={(e) => setGroupsCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 h-9" />
          </div>
          <Button onClick={drawGroups} variant="outline">
            <Shuffle className="h-4 w-4 mr-2" />Sortear zonas
          </Button>
          <Button onClick={addGroup} variant="ghost">+ Zona vacía</Button>
          <Button onClick={save} disabled={saving || draft.length === 0} className="ml-auto">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar zonas
          </Button>
        </div>
      </Card>

      {unassigned.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">Sin asignar ({unassigned.length})</h3>
          <ul className="space-y-1.5">
            {unassigned.map((p) => (
              <li key={p.pair_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{labelForPair(p)}</span>
                {draft.length > 0 && (
                  <Select onValueChange={(v) => addUnassigned(p.pair_id, parseInt(v))}>
                    <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Asignar a…" /></SelectTrigger>
                    <SelectContent>
                      {draft.map((g, i) => (
                        <SelectItem key={i} value={String(i)}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {draft.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Todavía no hay zonas. Sorteá o creá una zona vacía para empezar.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {draft.map((g, idx) => (
            <Card key={g.id ?? idx} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Input value={g.name} onChange={(e) => renameGroup(idx, e.target.value)}
                  className="h-8 font-semibold" />
                <Badge variant="secondary">{g.pair_ids.length}</Badge>
                <Button variant="ghost" size="icon" onClick={() => removeGroup(idx)} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {g.pair_ids.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin parejas.</p>
              ) : (
                <ul className="space-y-1.5">
                  {g.pair_ids.map((pid) => {
                    const p = participants.find((x) => x.pair_id === pid);
                    return (
                      <li key={pid} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{labelForPair(p)}</span>
                        <Select value={String(idx)} onValueChange={(v) => movePair(pid, parseInt(v))}>
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-1">Sin asignar</SelectItem>
                            {draft.map((gg, gi) => (
                              <SelectItem key={gi} value={String(gi)}>{gg.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
