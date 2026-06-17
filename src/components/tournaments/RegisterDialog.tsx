import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";
import { formatCurrency } from "@/lib/tournament-helpers";
import type { Tables } from "@/integrations/supabase/types";

type Tournament = Tables<"tournaments">;

type PartnerOption = { user_id: string; full_name: string };

const schema = z.object({
  partner_id: z.string().uuid({ message: "Elegí un compañero" }),
});

export function RegisterDialog({
  tournament,
  open,
  onOpenChange,
  onSuccess,
}: {
  tournament: Tournament;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<PartnerOption[]>([]);
  const [partnerId, setPartnerId] = useState<string>("");

  useEffect(() => {
    if (!open || !user) return;
    void searchPlayers("");
  }, [open, user]);

  async function searchPlayers(q: string) {
    let query = supabase
      .from("profiles")
      .select("user_id, full_name")
      .neq("user_id", user!.id)
      .order("full_name")
      .limit(20);
    if (q) query = query.ilike("full_name", `%${q}%`);
    const { data } = await query;
    setOptions(
      (data ?? [])
        .filter((p) => p.full_name && p.full_name.trim().length > 0)
        .map((p) => ({ user_id: p.user_id, full_name: p.full_name as string }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ partner_id: partnerId });
    if (!parsed.success) {
      toast({ title: "Falta el compañero", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Create pair
      const { data: pair, error: pairErr } = await supabase
        .from("pairs")
        .insert({
          tournament_id: tournament.id,
          player1_id: user.id,
          player2_id: partnerId,
          created_by: user.id,
        })
        .select()
        .single();
      if (pairErr) throw pairErr;

      // Create registration
      const { error: regErr } = await supabase.from("registrations").insert({
        tournament_id: tournament.id,
        pair_id: pair.id,
        status: "pending",
        registered_by: user.id,
      });
      if (regErr) throw regErr;

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error al inscribirse", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Inscripción a {tournament.name}</DialogTitle>
          <DialogDescription>
            Elegí tu compañero. La inscripción quedará pendiente de aprobación.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Buscar jugador</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nombre del compañero…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  void searchPlayers(e.target.value);
                }}
                className="pl-8 h-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Compañero</Label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná un jugador" />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {options.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No se encontraron jugadores
                  </div>
                ) : (
                  options.map((o) => (
                    <SelectItem key={o.user_id} value={o.user_id}>{o.full_name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El compañero debe tener cuenta en la plataforma.
            </p>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Valor de inscripción</span>
              <strong>{formatCurrency(tournament.registration_fee)}</strong>
            </div>
            <p className="text-xs text-muted-foreground">El cobro se coordina con la organización.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !partnerId}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar inscripción
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
