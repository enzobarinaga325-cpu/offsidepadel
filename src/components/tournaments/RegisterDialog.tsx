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
import {
  formatCurrency,
  categoryLevelToInt,
  tournamentCategoryLabel,
  tournamentGenderLabels,
  type TournamentCategoryRow,
} from "@/lib/tournament-helpers";
import type { Tables } from "@/integrations/supabase/types";

type Tournament = Tables<"tournaments">;
type CategoryRow = Tables<"categories">;
type TournamentCategoryWithBase = TournamentCategoryRow & { category: CategoryRow | null };

type PartnerOption = {
  user_id: string;
  full_name: string;
  category: CategoryRow | null;
};

const schema = z.object({
  partner_id: z.string().uuid({ message: "Elegí un compañero" }),
});

export function RegisterDialog({
  tournament,
  tournamentCategory,
  open,
  onOpenChange,
  onSuccess,
}: {
  tournament: Tournament;
  tournamentCategory: TournamentCategoryWithBase;
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
  const [myCategory, setMyCategory] = useState<CategoryRow | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    void searchPlayers("");
    void loadMyCategory();
  }, [open, user]);

  async function loadMyCategory() {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("category:categories(*)")
      .eq("user_id", user.id)
      .maybeSingle();
    setMyCategory((data?.category as CategoryRow | null) ?? null);
  }

  async function searchPlayers(q: string) {
    let query = supabase
      .from("profiles")
      .select("user_id, full_name, category:categories(*)")
      .neq("user_id", user!.id)
      .order("full_name")
      .limit(30);
    if (q) query = query.ilike("full_name", `%${q}%`);
    const { data } = await query;
    setOptions(
      (data ?? [])
        .filter((p) => p.full_name && p.full_name.trim().length > 0)
        .map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name as string,
          category: (p.category as CategoryRow | null) ?? null,
        }))
    );
  }

  function clientValidate(partner: PartnerOption): string | null {
    if (!myCategory || !partner.category) {
      return "Ambos jugadores deben tener una categoría asignada en su perfil";
    }
    const tc = tournamentCategory;
    // Gender check
    if (tc.gender === "mens") {
      if (myCategory.gender !== "male" || partner.category.gender !== "male")
        return "Esta categoría es de Caballeros: ambos jugadores deben ser hombres";
    } else if (tc.gender === "womens") {
      if (myCategory.gender !== "female" || partner.category.gender !== "female")
        return "Esta categoría es de Damas: ambas jugadoras deben ser mujeres";
    } else if (tc.gender === "mixed") {
      const a = myCategory.gender, b = partner.category.gender;
      const isMixed = (a === "male" && b === "female") || (a === "female" && b === "male");
      if (!isMixed) return "Esta categoría es Mixta: la pareja debe ser un hombre y una mujer";
    }
    if (tc.mode === "normal" && tc.category_id) {
      if (myCategory.id !== tc.category_id || partner.category.id !== tc.category_id) {
        return "Ambos jugadores deben pertenecer a la categoría del torneo";
      }
    }
    if (tc.mode === "suma") {
      const l1 = categoryLevelToInt(myCategory.level);
      const l2 = categoryLevelToInt(partner.category.level);
      if (l1 == null || l2 == null) return "No se pudo determinar el nivel de uno de los jugadores";
      if (l1 + l2 !== tc.suma_value) {
        return `La suma de categorías (${l1} + ${l2} = ${l1 + l2}) no coincide con Suma ${tc.suma_value} de esta categoría`;
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ partner_id: partnerId });
    if (!parsed.success) {
      toast({ title: "Falta el compañero", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    const partner = options.find((o) => o.user_id === partnerId);
    if (!partner) return;
    const err = clientValidate(partner);
    if (err) {
      toast({ title: "No se puede inscribir", description: err, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
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

      const { error: regErr } = await supabase.from("registrations").insert({
        tournament_id: tournament.id,
        tournament_category_id: tournamentCategory.id,
        pair_id: pair.id,
        status: "pending",
        registered_by: user.id,
      });
      if (regErr) {
        // Cleanup orphan pair
        await supabase.from("pairs").delete().eq("id", pair.id);
        throw regErr;
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error al inscribirse", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const catLabel = tournamentCategoryLabel(tournamentCategory);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Inscripción a {tournament.name}</DialogTitle>
          <DialogDescription>
            Categoría: <strong>{catLabel}</strong>
            {tournamentCategory.mode === "suma" && (
              <> — La suma de niveles de ambos jugadores debe ser exactamente <strong>{tournamentCategory.suma_value}</strong>.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            Tu categoría: <strong>{myCategory ? `${myCategory.name}` : "sin categoría"}</strong>{" "}
            · Tipo torneo: <strong>{tournamentGenderLabels[tournamentCategory.gender]}</strong>
          </div>

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
                    <SelectItem key={o.user_id} value={o.user_id}>
                      {o.full_name}{o.category ? ` — ${o.category.name}` : " — sin categoría"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El compañero debe tener cuenta y categoría en la plataforma.
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
