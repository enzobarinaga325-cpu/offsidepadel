import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OffsideLogo } from "@/components/OffsideLogo";

type Category = { id: string; name: string; level: string | null };

export function CategoryGate() {
  const { user, profile, refreshProfile } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsCategory = !!user && !isAdmin && !!profile && !(profile as any).category_id;

  useEffect(() => {
    if (!needsCategory) return;
    void supabase
      .from("categories")
      .select("id, name, level")
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
  }, [needsCategory]);

  async function handleSave() {
    if (!selected || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ category_id: selected } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" });
      return;
    }
    await refreshProfile();
    toast({ title: "¡Listo!", description: "Tu categoría quedó registrada." });
  }

  if (!needsCategory) return null;

  return (
    <Dialog open onOpenChange={() => { /* blocking */ }}>
      <DialogContent
        className="sm:max-w-[440px] p-0 overflow-hidden [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="bg-black px-6 py-5 flex items-center justify-center">
          <OffsideLogo height={36} />
        </div>
        <div className="p-6 space-y-5">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl">Elegí tu categoría</DialogTitle>
            <DialogDescription className="text-[13px]">
              Es importante para inscribirte a los torneos correctos. Una vez elegida solo el administrador podrá modificarla.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
            {categories.length === 0 && (
              <div className="col-span-2 flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {categories.map((c) => {
              const isSelected = selected === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className={`min-h-[56px] px-3 py-2.5 rounded-lg border text-left text-sm font-medium transition-all active:scale-[0.98] ${
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                      : "border-border hover:border-primary/60 bg-card text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Trophy className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="truncate">{c.name}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            onClick={handleSave}
            disabled={!selected || saving}
            className="w-full h-11 text-[14px]"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar categoría
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            ¿Te equivocaste? Tu administrador puede ajustarla más tarde.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
