import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trophy, Trash2 } from "lucide-react";
import {
  registrationStatusLabels,
  registrationStatusColors,
  formatDate,
  type RegistrationStatus,
} from "@/lib/tournament-helpers";
import type { Tables } from "@/integrations/supabase/types";

const playerSchema = z.object({
  full_name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres"),
  phone: z.string().trim().max(30, "Máximo 30 caracteres").optional().or(z.literal("")),
  city: z.string().trim().max(80, "Máximo 80 caracteres").optional().or(z.literal("")),
  level: z.string().trim().max(20, "Máximo 20 caracteres").optional().or(z.literal("")),
  preferred_side: z.enum(["drive", "reves", "ambos"]).optional().or(z.literal("")),
});

type MyRegistration = {
  id: string;
  status: RegistrationStatus;
  registered_at: string;
  tournament: Tables<"tournaments"> | null;
  partner_name: string | null;
};

export default function MyProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [player, setPlayer] = useState<Tables<"players"> | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [level, setLevel] = useState("");
  const [side, setSide] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [registrations, setRegistrations] = useState<MyRegistration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(true);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  async function load() {
    if (!user) return;
    const { data: p } = await supabase.from("players").select("*").eq("user_id", user.id).maybeSingle();
    setPlayer(p);
    setFullName(profile?.full_name ?? "");
    setPhone(p?.phone ?? "");
    setCity(p?.city ?? "");
    setLevel(p?.level ?? "");
    setSide(p?.preferred_side ?? "");

    await loadRegistrations();
  }

  async function loadRegistrations() {
    if (!user) return;
    setLoadingRegs(true);
    // Find pairs the user belongs to
    const { data: pairs } = await supabase
      .from("pairs")
      .select("id, player1_id, player2_id")
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`);
    const pairIds = (pairs ?? []).map((p) => p.id);
    if (pairIds.length === 0) {
      setRegistrations([]);
      setLoadingRegs(false);
      return;
    }
    const { data: regs } = await supabase
      .from("registrations")
      .select("id, status, registered_at, tournament:tournaments(*), pair_id")
      .in("pair_id", pairIds)
      .order("registered_at", { ascending: false });

    // Get partner names
    const partnerIds = (pairs ?? []).map((p) => (p.player1_id === user.id ? p.player2_id : p.player1_id));
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", partnerIds);
    const nameMap = new Map((profs ?? []).map((p) => [p.user_id, p.full_name ?? "Jugador"]));

    setRegistrations(
      (regs ?? []).map((r: any) => {
        const pair = pairs!.find((p) => p.id === r.pair_id)!;
        const partnerId = pair.player1_id === user.id ? pair.player2_id : pair.player1_id;
        return {
          id: r.id,
          status: r.status,
          registered_at: r.registered_at,
          tournament: r.tournament,
          partner_name: nameMap.get(partnerId) ?? "Jugador",
        };
      })
    );
    setLoadingRegs(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = playerSchema.safeParse({ full_name: fullName, phone, city, level, preferred_side: side });
    if (!parsed.success) {
      toast({ title: "Datos inválidos", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("user_id", user.id);

      const playerData = {
        user_id: user.id,
        phone: phone || null,
        city: city || null,
        level: level || null,
        preferred_side: (side || null) as any,
      };
      if (player) {
        await supabase.from("players").update(playerData).eq("user_id", user.id);
      } else {
        await supabase.from("players").insert(playerData);
      }
      await refreshProfile();
      await load();
      toast({ title: "Perfil actualizado" });
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(regId: string) {
    if (!confirm("¿Cancelar esta inscripción?")) return;
    const { error } = await supabase.from("registrations").delete().eq("id", regId);
    if (error) {
      toast({ title: "No se pudo cancelar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Inscripción cancelada" });
    await loadRegistrations();
  }

  const pending = registrations.filter((r) => r.status === "pending" || r.status === "waitlist");
  const approved = registrations.filter((r) => r.status === "approved");
  const past = registrations.filter((r) => r.tournament?.status === "finished");

  return (
    <AppLayout>
      <div className="max-w-[1000px] mx-auto p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
          <p className="text-sm text-muted-foreground">Tus datos y tus torneos.</p>
        </div>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Datos</TabsTrigger>
            <TabsTrigger value="registrations">
              Mis inscripciones {registrations.length > 0 && <span className="ml-1 text-muted-foreground">({registrations.length})</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <Card className="p-6 max-w-[600px]">
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nombre completo</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Teléfono</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ciudad</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nivel</Label>
                    <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Ej: 4ta, 6ta" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lado preferido</Label>
                    <Select value={side} onValueChange={setSide}>
                      <SelectTrigger><SelectValue placeholder="Elegí un lado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="drive">Drive</SelectItem>
                        <SelectItem value="reves">Revés</SelectItem>
                        <SelectItem value="ambos">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar cambios
                </Button>
              </form>
            </Card>

            <PlayerStatsCard userId={user?.id} />

          </TabsContent>

          <TabsContent value="registrations" className="mt-4 space-y-6">
            <Section title="Pendientes / lista de espera" items={pending} onCancel={handleCancel} />
            <Section title="Aprobadas" items={approved} />
            <Section title="Torneos finalizados" items={past} />
            {registrations.length === 0 && !loadingRegs && (
              <Card className="p-12 text-center">
                <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">Todavía no te inscribiste a ningún torneo.</p>
                <Button asChild><Link to="/tournaments">Ver torneos disponibles</Link></Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function Section({
  title,
  items,
  onCancel,
}: {
  title: string;
  items: MyRegistration[];
  onCancel?: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h2>
      <div className="space-y-2">
        {items.map((r) => (
          <Card key={r.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {r.tournament ? (
                  <Link to={`/tournaments/${r.tournament.id}`} className="font-medium text-sm hover:underline">
                    {r.tournament.name}
                  </Link>
                ) : <span className="font-medium text-sm">(torneo eliminado)</span>}
                <Badge variant="outline" className={registrationStatusColors[r.status]}>
                  {registrationStatusLabels[r.status]}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Compañero: {r.partner_name} {r.tournament && `· ${formatDate(r.tournament.start_date)} · ${r.tournament.location}`}
              </div>
            </div>
            {onCancel && r.status === "pending" && (
              <Button variant="ghost" size="icon" onClick={() => onCancel(r.id)} title="Cancelar inscripción">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function PlayerStatsCard({ userId }: { userId?: string }) {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    if (!userId) return;
    void supabase.rpc("get_player_stats", { _player_id: userId }).then(({ data }) => setStats(data));
  }, [userId]);
  if (!stats) {
    return (
      <Card className="p-6 mt-4 max-w-[600px] bg-muted/30">
        <h3 className="font-semibold mb-1 text-sm">Estadísticas</h3>
        <p className="text-xs text-muted-foreground">Se activan cuando jugás tu primer torneo.</p>
      </Card>
    );
  }
  const winRate = stats.matches_played > 0
    ? Math.round((stats.matches_won / stats.matches_played) * 100)
    : 0;
  return (
    <Card className="p-6 mt-4 max-w-[600px]">
      <h3 className="font-semibold mb-3 text-sm">Mis estadísticas</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Torneos" value={stats.tournaments_played} />
        <Stat label="Títulos" value={stats.tournaments_won} />
        <Stat label="Partidos ganados" value={`${stats.matches_won}/${stats.matches_played}`} />
        <Stat label="Puntos" value={stats.total_points} />
      </div>
      <div className="text-xs text-muted-foreground mt-3">Efectividad: {winRate}%</div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
