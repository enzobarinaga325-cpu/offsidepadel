import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Profile = { user_id: string; full_name: string };

export function AddPairDialog({
  tournament,
  open,
  onOpenChange,
  onSuccess,
}: {
  tournament: Tables<"tournaments">;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [p1, setP1] = useState<string>("");
  const [p2, setP2] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void supabase
      .from("profiles")
      .select("user_id, full_name")
      .order("full_name")
      .limit(500)
      .then(({ data }) => {
        setProfiles(
          (data ?? [])
            .filter((p) => p.full_name && p.full_name.trim())
            .map((p) => ({ user_id: p.user_id, full_name: p.full_name as string }))
        );
      });
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!p1 || !p2 || p1 === p2) {
      toast({ title: "Elegí dos jugadores distintos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: pair, error: e1 } = await supabase
        .from("pairs")
        .insert({
          tournament_id: tournament.id,
          player1_id: p1,
          player2_id: p2,
          created_by: user!.id,
        })
        .select()
        .single();
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("registrations").insert({
        tournament_id: tournament.id,
        pair_id: pair.id,
        status: "approved",
        registered_by: user!.id,
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      });
      if (e2) throw e2;
      toast({ title: "Pareja agregada" });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar pareja manualmente</DialogTitle>
          <DialogDescription>La inscripción quedará aprobada directamente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Jugador 1</Label>
            <Select value={p1} onValueChange={setP1}>
              <SelectTrigger><SelectValue placeholder="Elegir jugador" /></SelectTrigger>
              <SelectContent className="max-h-[260px]">
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Jugador 2</Label>
            <Select value={p2} onValueChange={setP2}>
              <SelectTrigger><SelectValue placeholder="Elegir jugador" /></SelectTrigger>
              <SelectContent className="max-h-[260px]">
                {profiles.filter((p) => p.user_id !== p1).map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Agregar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
