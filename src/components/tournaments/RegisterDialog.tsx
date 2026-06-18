import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, AlertTriangle } from "lucide-react";
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
  category_name: string | null;
  category_level: string | null;
  category_gender: string | null;
};

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
  const [selected, setSelected] = useState<PartnerOption | null>(null);
  const [myCategory, setMyCategory] = useState<CategoryRow | null>(null);
  const [availability, setAvailability] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    setSearch(""); setSelected(null); setAvailability("");
    void doSearch("");
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

  async function doSearch(q: string) {
    const { data, error } = await (supabase.rpc as any)("search_players", { _q: q });
    if (error) {
      setOptions([]); return;
    }
    setOptions(
      ((data ?? []) as any[])
        .filter((p) => p.user_id !== user?.id && p.full_name?.trim())
        .map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          category_name: p.category_name,
          category_level: p.category_level,
          category_gender: p.category_gender,
        }))
    );
  }

  // returns { ok, warning } — warning = string si la inscripción quedará pendiente
  function preflight(partner: PartnerOption): { ok: boolean; error?: string; warning?: string } {
    if (!myCategory) return { ok: false, error: "No tenés categoría asignada en tu perfil." };
    if (!partner.category_level) return { ok: false, error: "Tu compañero no tiene categoría asignada." };
    const tc = tournamentCategory;
    if (tc.gender === "mens") {
      if (myCategory.gender !== "male" || partner.category_gender !== "male")
        return { ok: false, error: "Categoría de Caballeros: ambos deben ser hombres." };
    } else if (tc.gender === "womens") {
      if (myCategory.gender !== "female" || partner.category_gender !== "female")
        return { ok: false, error: "Categoría de Damas: ambas deben ser mujeres." };
    } else if (tc.gender === "mixed") {
      const isMixed = (myCategory.gender === "male" && partner.category_gender === "female")
                   || (myCategory.gender === "female" && partner.category_gender === "male");
      if (!isMixed) return { ok: false, error: "Categoría Mixta: un hombre y una mujer." };
    }
    if (tc.mode === "suma") {
      const l1 = categoryLevelToInt(myCategory.level);
      const l2 = categoryLevelToInt(partner.category_level);
      if (l1 == null || l2 == null) return { ok: false, error: "No se pudo determinar el nivel." };
      if (l1 + l2 !== tc.suma_value) {
        return { ok: false, error: `La suma de niveles (${l1}+${l2}=${l1+l2}) no coincide con Suma ${tc.suma_value}.` };
      }
    } else if (tc.mode === "normal" && tc.category_id && tc.category) {
      if (myCategory.id !== tc.category_id || (partner.category_level && partner.category_level !== tc.category.level)) {
        return {
          ok: true,
          warning: `Hay diferencia de categoría. Tu categoría: ${myCategory.name} (${myCategory.level}). Compañero: ${partner.category_name ?? "?"} (${partner.category_level ?? "?"}). Categoría del torneo: ${tc.category.name}. La inscripción quedará pendiente de aprobación del administrador.`,
        };
      }
    }
    return { ok: true };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selected) {
      toast({ title: "Elegí un compañero", variant: "destructive" });
      return;
    }
    const pf = preflight(selected);
    if (!pf.ok) {
      toast({ title: "No se puede inscribir", description: pf.error, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase.rpc as any)("request_pair_registration", {
        _tournament_category_id: tournamentCategory.id,
        _partner_user_id: selected.user_id,
        _availability: availability.trim() || null,
      });
      if (error) throw error;
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error al inscribirse", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const catLabel = tournamentCategoryLabel(tournamentCategory);
  const pf = selected ? preflight(selected) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Inscripción a {tournament.name}</DialogTitle>
          <DialogDescription>
            Categoría: <strong>{catLabel}</strong>
            {tournamentCategory.mode === "suma" && (
              <> — La suma de niveles debe ser exactamente <strong>{tournamentCategory.suma_value}</strong>.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            Tu categoría: <strong>{myCategory ? myCategory.name : "sin categoría"}</strong>
            {" · "}Tipo: <strong>{tournamentGenderLabels[tournamentCategory.gender]}</strong>
          </div>

          <div className="space-y-2">
            <Label>Buscar compañero (nombre, apellido o teléfono)</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ej: Juan Pérez o 11..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); void doSearch(e.target.value); }}
                className="pl-8 h-9"
              />
            </div>
          </div>

          <div className="max-h-[220px] overflow-y-auto rounded-md border border-border">
            {options.length === 0 ? (
              <div className="px-3 py-6 text-sm text-muted-foreground text-center">No se encontraron jugadores.</div>
            ) : (
              <ul className="divide-y divide-border">
                {options.map((o) => (
                  <li key={o.user_id}>
                    <button
                      type="button"
                      onClick={() => setSelected(o)}
                      className={`w-full text-left px-3 py-2 min-h-[44px] flex justify-between items-center gap-2 hover:bg-muted/50 transition ${selected?.user_id === o.user_id ? "bg-primary/10" : ""}`}
                    >
                      <span className="text-sm font-medium truncate">{o.full_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {o.category_name ?? "sin categoría"}{o.category_level ? ` · ${o.category_level}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && pf?.warning && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs flex gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <span>{pf.warning}</span>
            </div>
          )}
          {selected && pf && !pf.ok && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
              {pf.error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="availability">Disponibilidad (opcional)</Label>
            <Textarea
              id="availability"
              placeholder="Ej: Sábados por la tarde, solo después de las 19 hs, cualquier horario…"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Indicale al administrador qué días y horarios podés jugar.
            </p>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor de inscripción</span>
              <strong>{formatCurrency(tournament.registration_fee)}</strong>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tu solicitud quedará <strong>pendiente</strong> hasta que el administrador la apruebe.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !selected || (pf && !pf.ok)}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
