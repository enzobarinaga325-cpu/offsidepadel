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
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { tournamentTypeLabels, statusLabels, type TournamentStatus, type TournamentType } from "@/lib/tournament-helpers";
import type { Tables } from "@/integrations/supabase/types";

const schema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120, "Máximo 120"),
  start_date: z.string().min(1, "Fecha requerida"),
  location: z.string().trim().min(2, "Lugar requerido").max(120),
  max_pairs: z.number().int().min(2, "Mínimo 2").max(256),
  registration_fee: z.number().min(0, "No puede ser negativo"),
});

export default function AdminTournamentForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Tables<"categories">[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [type, setType] = useState<TournamentType>("elimination");
  const [fee, setFee] = useState<string>("0");
  const [maxPairs, setMaxPairs] = useState<string>("16");
  const [rules, setRules] = useState("");
  const [prizes, setPrizes] = useState("");
  const [status, setStatus] = useState<TournamentStatus>("upcoming");
  const [regOpen, setRegOpen] = useState(false);
  const [regDeadline, setRegDeadline] = useState("");

  useEffect(() => {
    void supabase.from("categories").select("*").order("name").then(({ data }) => setCategories(data ?? []));
    if (isEdit && id) void loadTournament(id);
  }, [id]);

  async function loadTournament(tid: string) {
    setLoading(true);
    const { data: t } = await supabase.from("tournaments").select("*").eq("id", tid).maybeSingle();
    if (t) {
      setName(t.name);
      setDescription(t.description ?? "");
      setImageUrl(t.image_url ?? "");
      setStartDate(t.start_date);
      setStartTime(t.start_time ?? "");
      setEndDate(t.end_date ?? "");
      setLocation(t.location);
      setCategoryId(t.category_id ?? "none");
      setType(t.tournament_type as TournamentType);
      setFee(String(t.registration_fee));
      setMaxPairs(String(t.max_pairs));
      setRules(t.rules ?? "");
      setPrizes(t.prizes ?? "");
      setStatus(t.status as TournamentStatus);
      setRegOpen(t.registration_open);
      setRegDeadline(t.registration_deadline ? t.registration_deadline.slice(0, 16) : "");
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      name,
      start_date: startDate,
      location,
      max_pairs: Number(maxPairs),
      registration_fee: Number(fee),
    });
    if (!parsed.success) {
      toast({ title: "Datos inválidos", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        start_date: startDate,
        start_time: startTime || null,
        end_date: endDate || null,
        location: location.trim(),
        category_id: categoryId === "none" ? null : categoryId,
        tournament_type: type,
        registration_fee: Number(fee),
        max_pairs: Number(maxPairs),
        rules: rules.trim() || null,
        prizes: prizes.trim() || null,
        status,
        registration_open: regOpen,
        registration_deadline: regDeadline ? new Date(regDeadline).toISOString() : null,
      };
      if (isEdit) {
        const { error } = await supabase.from("tournaments").update(payload).eq("id", id!);
        if (error) throw error;
        toast({ title: "Torneo actualizado" });
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("tournaments").insert(payload);
        if (error) throw error;
        toast({ title: "Torneo creado" });
      }
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
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <Label>Cupos (máx parejas) *</Label>
                <Input type="number" min={2} value={maxPairs} onChange={(e) => setMaxPairs(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Valor inscripción *</Label>
                <Input type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} required />
              </div>
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
              <Label htmlFor="regopen" className="cursor-pointer">Inscripciones abiertas</Label>
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
