import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Match = {
  id: string;
  scheduled_at: string | null;
  court: string | null;
};

function isoToLocalParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function MatchScheduleDialog({
  match, pairLabelA, pairLabelB, open, onOpenChange, onSuccess,
}: {
  match: Match;
  pairLabelA: string;
  pairLabelB: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const initial = isoToLocalParts(match.scheduled_at);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [court, setCourt] = useState(match.court ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    let scheduled_at: string | null = null;
    if (date && time) {
      const d = new Date(`${date}T${time}:00`);
      if (Number.isNaN(d.getTime())) {
        setSaving(false);
        toast({ title: "Fecha/hora inválida", variant: "destructive" });
        return;
      }
      scheduled_at = d.toISOString();
    } else if (date || time) {
      setSaving(false);
      toast({ title: "Completá fecha y hora", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("matches")
      .update({ scheduled_at, court: court.trim() || null })
      .eq("id", match.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Horario guardado" });
    onSuccess();
  }

  async function clearSchedule() {
    setSaving(true);
    const { error } = await supabase
      .from("matches")
      .update({ scheduled_at: null, court: null })
      .eq("id", match.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Horario borrado" });
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Programar partido</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{pairLabelA}</strong> vs <strong className="text-foreground">{pairLabelB}</strong>
        </p>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Hora</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Cancha / lugar</Label>
          <Input value={court} onChange={(e) => setCourt(e.target.value)} placeholder="Ej: Cancha 3" maxLength={80} />
        </div>
        <DialogFooter className="gap-2">
          {(match.scheduled_at || match.court) && (
            <Button variant="ghost" onClick={clearSchedule} disabled={saving}>Borrar</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
