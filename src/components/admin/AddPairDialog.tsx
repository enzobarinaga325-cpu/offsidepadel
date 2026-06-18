import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { tournamentCategoryLabel, type TournamentCategoryRow } from "@/lib/tournament-helpers";

type CategoryRow = Tables<"categories">;
type TCat = TournamentCategoryRow & { category: CategoryRow | null };
type Player = { user_id: string; full_name: string; category_name?: string | null; category_level?: string | null };

export function AddPairDialog({
  tournament,
  initialCategoryId,
  open,
  onOpenChange,
  onSuccess,
}: {
  tournament: Tables<"tournaments">;
  initialCategoryId?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [cats, setCats] = useState<TCat[]>([]);
  const [catId, setCatId] = useState<string>(initialCategoryId ?? "");
  const [q1, setQ1] = useState(""); const [q2, setQ2] = useState("");
  const [opts1, setOpts1] = useState<Player[]>([]); const [opts2, setOpts2] = useState<Player[]>([]);
  const [p1, setP1] = useState<Player | null>(null); const [p2, setP2] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void supabase
      .from("tournament_categories")
      .select("*, category:categories(*)")
      .eq("tournament_id", tournament.id)
      .order("position")
      .then(({ data }) => {
        const arr = (data ?? []) as TCat[];
        setCats(arr);
        if (!catId && arr[0]) setCatId(arr[0].id);
      });
    void search("", setOpts1);
    void search("", setOpts2);
  }, [open]);

  async function search(q: string, setter: (p: Player[]) => void) {
    const { data } = await (supabase.rpc as any)("search_players", { _q: q });
    setter(((data ?? []) as any[]).map((p) => ({
      user_id: p.user_id, full_name: p.full_name,
      category_name: p.category_name, category_level: p.category_level,
    })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!catId) return toast({ title: "Elegí una categoría", variant: "destructive" });
    if (!p1 || !p2) return toast({ title: "Elegí ambos jugadores", variant: "destructive" });
    if (p1.user_id === p2.user_id) return toast({ title: "Los jugadores deben ser distintos", variant: "destructive" });
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)("admin_create_registration", {
        _tournament_category_id: catId,
        _player1: p1.user_id,
        _player2: p2.user_id,
      });
      if (error) throw error;
      toast({ title: "Pareja agregada" });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function PlayerPicker({ label, q, setQ, opts, setOpts, selected, setSelected }: any) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nombre, apellido o teléfono…"
            value={q}
            onChange={(e) => { setQ(e.target.value); void search(e.target.value, setOpts); }}
            className="pl-8 h-9"
          />
        </div>
        <div className="max-h-[140px] overflow-y-auto rounded-md border border-border">
          {opts.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">Sin resultados</div>
          ) : (
            <ul className="divide-y divide-border">
              {opts.map((o: Player) => (
                <li key={o.user_id}>
                  <button type="button" onClick={() => setSelected(o)}
                    className={`w-full text-left px-3 py-2 min-h-[40px] flex justify-between gap-2 hover:bg-muted/50 ${selected?.user_id === o.user_id ? "bg-primary/10" : ""}`}>
                    <span className="text-sm truncate">{o.full_name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{o.category_name ?? "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Agregar pareja manualmente</DialogTitle>
          <DialogDescription>La inscripción queda aprobada y se ignoran los cupos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Categoría del torneo</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger><SelectValue placeholder="Elegir categoría" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{tournamentCategoryLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <PlayerPicker label="Jugador 1" q={q1} setQ={setQ1} opts={opts1} setOpts={setOpts1} selected={p1} setSelected={setP1} />
          <PlayerPicker label="Jugador 2" q={q2} setQ={setQ2} opts={opts2} setOpts={setOpts2} selected={p2} setSelected={setP2} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !p1 || !p2 || !catId}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Agregar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
