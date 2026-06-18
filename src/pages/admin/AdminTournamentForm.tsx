import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  tournamentTypeLabels,
  statusLabels,
  tournamentGenderLabels,
  tournamentCategoryLabel,
  type TournamentStatus,
  type TournamentType,
  type TournamentGender,
  type TournamentCategoryMode,
} from "@/lib/tournament-helpers";
import type { Tables } from "@/integrations/supabase/types";

const schema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120, "Máximo 120"),
  start_date: z.string().min(1, "Fecha requerida"),
  location: z.string().trim().min(2, "Lugar requerido").max(120),
  registration_fee: z.number().min(0, "No puede ser negativo"),
});

type CatRow = Tables<"categories">;

type DraftCat = {
  id?: string; // existing tournament_categories.id
  gender: TournamentGender;
  mode: TournamentCategoryMode;
  category_id: string | null;
  suma_value: number | null;
  max_pairs: number;
  registration_open: boolean;
};

export default function AdminTournamentForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [categories, setCategories] = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<TournamentType>("elimination");
  const [fee, setFee] = useState<string>("0");
  const [rules, setRules] = useState("");
  const [prizes, setPrizes] = useState("");
  const [status, setStatus] = useState<TournamentStatus>("upcoming");
  const [regOpen, setRegOpen] = useState(false);
  const [regDeadline, setRegDeadline] = useState("");

  const [draftCats, setDraftCats] = useState<DraftCat[]>([
    { gender: "mens", mode: "normal", category_id: null, suma_value: null, max_pairs: 16, registration_open: true },
  ]);
  const [existingIdsLoaded, setExistingIdsLoaded] = useState<string[]>([]);

  useEffect(() => {
    void supabase.from("categories").select("*").order("name").then(({ data }) => setCategories(data ?? []));
    if (isEdit && id) void loadTournament(id);
  }, [id]);

  async function loadTournament(tid: string) {
    setLoading(true);
    const [{ data: t }, { data: tc }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tid).maybeSingle(),
      supabase.from("tournament_categories").select("*").eq("tournament_id", tid).order("position"),
    ]);
    if (t) {
      setName(t.name);
      setDescription(t.description ?? "");
      setImageUrl(t.image_url ?? "");
      setStartDate(t.start_date);
      setStartTime(t.start_time ?? "");
      setEndDate(t.end_date ?? "");
      setLocation(t.location);
      setType(t.tournament_type as TournamentType);
      setFee(String(t.registration_fee));
      setRules(t.rules ?? "");
      setPrizes(t.prizes ?? "");
      setStatus(t.status as TournamentStatus);
      setRegOpen(t.registration_open);
      setRegDeadline(t.registration_deadline ? t.registration_deadline.slice(0, 16) : "");
    }
    if (tc && tc.length > 0) {
      setDraftCats(tc.map((c) => ({
        id: c.id,
        gender: c.gender,
        mode: c.mode,
        category_id: c.category_id,
        suma_value: c.suma_value,
        max_pairs: c.max_pairs,
        registration_open: c.registration_open,
      })));
      setExistingIdsLoaded(tc.map((c) => c.id));
    }
    setLoading(false);
  }

  function updateDraft(i: number, patch: Partial<DraftCat>) {
    setDraftCats((arr) => arr.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  }

  function addDraft() {
    setDraftCats((arr) => [...arr, { gender: "mens", mode: "normal", category_id: null, suma_value: null, max_pairs: 16, registration_open: true }]);
  }

  function removeDraft(i: number) {
    setDraftCats((arr) => arr.filter((_, idx) => idx !== i));
  }

  function categoriesForGender(g: TournamentGender): CatRow[] {
    if (g === "mens") return categories.filter((c) => c.gender === "male");
    if (g === "womens") return categories.filter((c) => c.gender === "female");
    return categories;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      name, start_date: startDate, location, registration_fee: Number(fee),
    });
    if (!parsed.success) {
      toast({ title: "Datos inválidos", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (draftCats.length === 0) {
      toast({ title: "Categorías", description: "Agregá al menos una categoría al torneo.", variant: "destructive" });
      return;
    }
    for (const d of draftCats) {
      if (d.mode === "normal" && d.gender !== "mixed" && !d.category_id) {
        toast({ title: "Categoría incompleta", description: "Seleccioná la categoría base (3ª–8ª).", variant: "destructive" });
        return;
      }
      if (d.mode === "suma" && (!d.suma_value || d.suma_value < 2)) {
        toast({ title: "Categoría incompleta", description: "Ingresá un valor de Suma válido (≥ 2).", variant: "destructive" });
        return;
      }
      if (d.max_pairs < 2) {
        toast({ title: "Cupos inválidos", description: "Mínimo 2 cupos por categoría.", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      const firstCatId = draftCats.find((d) => d.category_id)?.category_id ?? null;
      const totalCupos = draftCats.reduce((s, d) => s + d.max_pairs, 0);
      const payload: any = {
        name: name.trim(),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        start_date: startDate,
        start_time: startTime || null,
        end_date: endDate || null,
        location: location.trim(),
        category_id: firstCatId,
        tournament_type: type,
        registration_fee: Number(fee),
        max_pairs: totalCupos,
        rules: rules.trim() || null,
        prizes: prizes.trim() || null,
        status,
        registration_open: regOpen,
        registration_deadline: regDeadline ? new Date(regDeadline).toISOString() : null,
      };

      let tournamentId = id ?? null;
      if (isEdit) {
        const { error } = await supabase.from("tournaments").update(payload).eq("id", id!);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { data, error } = await supabase.from("tournaments").insert(payload).select("id").single();
        if (error) throw error;
        tournamentId = data.id;
      }

      // Sync tournament_categories
      const keepIds = new Set<string>();
      for (let i = 0; i < draftCats.length; i++) {
        const d = draftCats[i];
        const row: any = {
          tournament_id: tournamentId,
          gender: d.gender,
          mode: d.mode,
          category_id: d.mode === "normal" ? d.category_id : null,
          suma_value: d.mode === "suma" ? d.suma_value : null,
          max_pairs: d.max_pairs,
          registration_open: d.registration_open,
          position: i,
        };
        if (d.id) {
          keepIds.add(d.id);
          const { error } = await supabase.from("tournament_categories").update(row).eq("id", d.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("tournament_categories").insert(row).select("id").single();
          if (error) throw error;
          if (data) keepIds.add(data.id);
        }
      }
      // Delete removed
      const toDelete = existingIdsLoaded.filter((eid) => !keepIds.has(eid));
      if (toDelete.length > 0) {
        const { error } = await supabase.from("tournament_categories").delete().in("id", toDelete);
        if (error) throw error;
      }

      toast({ title: isEdit ? "Torneo actualizado" : "Torneo creado" });
      navigate("/admin/tournaments");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AppLayout><div className="p-8 text-sm text-muted-foreground">Cargando…</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-[900px] mx-auto p-4 md:p-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/admin/tournaments"><ArrowLeft className="h-4 w-4 mr-1" />Torneos</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight mb-6">
          {isEdit ? "Editar torneo" : "Nuevo torneo"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Información básica</h2>
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Imagen (URL)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              {imageUrl && (
                <img src={imageUrl} alt="preview" className="mt-2 rounded-md max-h-32 object-cover" />
              )}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Fecha y lugar</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Fecha inicio *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Hora</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha fin</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Lugar *</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} required />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Formato</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de torneo</Label>
                <Select value={type} onValueChange={(v) => setType(v as TournamentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(tournamentTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor inscripción *</Label>
                <Input type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} required />
              </div>
            </div>
          </Card>

          {/* CATEGORIES SECTION */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Categorías del torneo</h2>
              <Button type="button" variant="outline" size="sm" onClick={addDraft}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Un torneo puede tener varias categorías (ej: 5ª Damas, 7ª Caballeros, Suma 8 Caballeros, Suma 10 Mixto). Cada categoría tiene cupos y fixture independientes.
            </p>
            <div className="space-y-3">
              {draftCats.map((d, i) => {
                const fakeForLabel: any = {
                  mode: d.mode, gender: d.gender, suma_value: d.suma_value, label: null,
                  category: d.category_id ? categories.find((c) => c.id === d.category_id) : null,
                };
                return (
                  <div key={i} className="rounded-lg border border-border p-3 md:p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm">{tournamentCategoryLabel(fakeForLabel)}</strong>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeDraft(i)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Género</Label>
                        <Select value={d.gender} onValueChange={(v) => updateDraft(i, { gender: v as TournamentGender, category_id: null })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(tournamentGenderLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Modo</Label>
                        <Select value={d.mode} onValueChange={(v) => updateDraft(i, { mode: v as TournamentCategoryMode })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Categoría normal</SelectItem>
                            <SelectItem value="suma">Suma</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {d.mode === "normal" ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Categoría base</Label>
                          <Select
                            value={d.category_id ?? ""}
                            onValueChange={(v) => updateDraft(i, { category_id: v || null })}
                          >
                            <SelectTrigger className="h-9"><SelectValue placeholder="Elegir…" /></SelectTrigger>
                            <SelectContent>
                              {categoriesForGender(d.gender).map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Valor suma</Label>
                          <Input
                            type="number"
                            min={2}
                            max={16}
                            value={d.suma_value ?? ""}
                            onChange={(e) => updateDraft(i, { suma_value: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="ej: 8, 10, 12"
                            className="h-9"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cupos (parejas)</Label>
                        <Input
                          type="number"
                          min={2}
                          value={d.max_pairs}
                          onChange={(e) => updateDraft(i, { max_pairs: parseInt(e.target.value) || 2 })}
                          className="h-9"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <Switch
                          checked={d.registration_open}
                          onCheckedChange={(v) => updateDraft(i, { registration_open: v })}
                          id={`rego-${i}`}
                        />
                        <Label htmlFor={`rego-${i}`} className="text-xs cursor-pointer">Inscripciones abiertas</Label>
                      </div>
                    </div>
                  </div>
                );
              })}
              {draftCats.length === 0 && (
                <p className="text-sm text-muted-foreground">Agregá al menos una categoría.</p>
              )}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Reglamento y premios</h2>
            <div className="space-y-1.5">
              <Label>Reglamento</Label>
              <Textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Premios</Label>
              <Textarea value={prizes} onChange={(e) => setPrizes(e.target.value)} rows={3} />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Estado e inscripciones</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TournamentStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cierre de inscripciones</Label>
                <Input type="datetime-local" value={regDeadline} onChange={(e) => setRegDeadline(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={regOpen} onCheckedChange={setRegOpen} id="regopen" />
              <Label htmlFor="regopen" className="cursor-pointer">Inscripciones abiertas (torneo)</Label>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/admin/tournaments")}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear torneo"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
