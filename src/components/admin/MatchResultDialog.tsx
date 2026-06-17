import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X } from "lucide-react";

type Match = {
  id: string;
  pair_a_id: string | null;
  pair_b_id: string | null;
  score: any;
};

export function MatchResultDialog({
  match, pairLabelA, pairLabelB, open, onOpenChange, onSuccess,
}: {
  match: Match;
  pairLabelA: string;
  pairLabelB: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const initial = Array.isArray(match.score) && match.score.length > 0
    ? match.score.map((s: any) => ({ a: String(s.a ?? ""), b: String(s.b ?? "") }))
    : [{ a: "", b: "" }, { a: "", b: "" }];
  const [sets, setSets] = useState<{ a: string; b: string }[]>(initial);
  const [walkover, setWalkover] = useState<"none" | "a" | "b">("none");
  const [submitting, setSubmitting] = useState(false);

  function update(i: number, key: "a" | "b", val: string) {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)));
  }
  function addSet() { setSets((p) => [...p, { a: "", b: "" }]); }
  function removeSet(i: number) { setSets((p) => p.filter((_, idx) => idx !== i)); }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      let payload: any = { _match_id: match.id, _sets: [], _walkover_winner: null };
      if (walkover !== "none") {
        payload._walkover_winner = walkover === "a" ? match.pair_a_id : match.pair_b_id;
      } else {
        const parsed = sets
          .filter((s) => s.a !== "" || s.b !== "")
          .map((s) => ({ a: parseInt(s.a, 10), b: parseInt(s.b, 10) }));
        if (parsed.length === 0 || parsed.some((s) => isNaN(s.a) || isNaN(s.b))) {
          toast({ title: "Sets inválidos", description: "Cargá los games de cada set.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        payload._sets = parsed;
      }
      const { error } = await supabase.rpc("submit_match_result", payload);
      if (error) throw error;
      toast({ title: "Resultado guardado" });
      onSuccess();
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Cargar resultado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm">
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="font-medium">A</span><span>{pairLabelA}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="font-medium">B</span><span>{pairLabelB}</span>
            </div>
          </div>

          <div>
            <Label className="text-xs">Walkover</Label>
            <div className="flex gap-2 mt-1">
              <Button type="button" variant={walkover === "none" ? "default" : "outline"} size="sm" onClick={() => setWalkover("none")}>Por sets</Button>
              <Button type="button" variant={walkover === "a" ? "default" : "outline"} size="sm" onClick={() => setWalkover("a")}>Gana A</Button>
              <Button type="button" variant={walkover === "b" ? "default" : "outline"} size="sm" onClick={() => setWalkover("b")}>Gana B</Button>
            </div>
          </div>

          {walkover === "none" && (
            <div className="space-y-2">
              <Label className="text-xs">Sets</Label>
              {sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12">Set {i + 1}</span>
                  <Input type="number" min="0" max="20" value={s.a} onChange={(e) => update(i, "a", e.target.value)} className="h-9 w-16 text-center" placeholder="A" />
                  <span className="text-muted-foreground">-</span>
                  <Input type="number" min="0" max="20" value={s.b} onChange={(e) => update(i, "b", e.target.value)} className="h-9 w-16 text-center" placeholder="B" />
                  {sets.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSet(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addSet}>
                <Plus className="h-3 w-3 mr-1" /> Agregar set
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
