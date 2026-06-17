import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { categoryGenderLabels, type CategoryGender } from "@/lib/tournament-helpers";
import type { Tables } from "@/integrations/supabase/types";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  gender: z.enum(["male", "female", "mixed"]),
  level: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export default function AdminCategories() {
  const { toast } = useToast();
  const [items, setItems] = useState<Tables<"categories">[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tables<"categories"> | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("categories").select("*").order("name");
    setItems(data ?? []);
    setLoading(false);
  }

  async function remove(c: Tables<"categories">) {
    if (!confirm(`¿Eliminar la categoría "${c.name}"?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Categoría eliminada" });
    void load();
  }

  return (
    <AppLayout>
      <div className="max-w-[900px] mx-auto p-4 md:p-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Panel</Link>
        </Button>
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
            <p className="text-sm text-muted-foreground">Niveles y géneros para clasificar los torneos.</p>
          </div>
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Nueva categoría</Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">No hay categorías creadas.</p>
            <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Crear la primera</Button>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium">Género</th>
                    <th className="text-left px-4 py-3 font-medium">Nivel</th>
                    <th className="text-left px-4 py-3 font-medium">Descripción</th>
                    <th className="text-right px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3"><Badge variant="secondary">{categoryGenderLabels[c.gender as CategoryGender]}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{c.level ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[300px]">{c.description ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {(creating || editing) && (
        <CategoryDialog
          item={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); void load(); }}
        />
      )}
    </AppLayout>
  );
}

function CategoryDialog({
  item,
  onClose,
  onSaved,
}: {
  item: Tables<"categories"> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(item?.name ?? "");
  const [gender, setGender] = useState<CategoryGender>((item?.gender as CategoryGender) ?? "mixed");
  const [level, setLevel] = useState(item?.level ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ name, gender, level, description });
    if (!parsed.success) {
      toast({ title: "Datos inválidos", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      gender,
      level: level.trim() || null,
      description: description.trim() || null,
    };
    const { error } = item
      ? await supabase.from("categories").update(payload).eq("id", item.id)
      : await supabase.from("categories").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: item ? "Categoría actualizada" : "Categoría creada" });
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Género</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as CategoryGender)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryGenderLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nivel</Label>
              <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Ej: 4ta" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
