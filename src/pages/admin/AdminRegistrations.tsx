import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, X, AlertCircle, UserMinus, UserPlus, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  registrationStatusLabels,
  registrationStatusColors,
  formatDate,
  tournamentCategoryLabel,
  type RegistrationStatus,
  type TournamentCategoryRow,
} from "@/lib/tournament-helpers";
import type { Tables } from "@/integrations/supabase/types";
import { AddPairDialog } from "@/components/admin/AddPairDialog";

type CatRow = Tables<"categories">;
type TCat = TournamentCategoryRow & { category: CatRow | null };

type Row = {
  id: string;
  status: RegistrationStatus;
  registered_at: string;
  pair_id: string;
  tournament_id: string;
  tournament_name: string | null;
  tournament_category_id: string | null;
  approval_reason: string | null;
  admin_comment: string | null;
  availability: string | null;
  partner_confirmed: boolean;
  player1_name: string | null;
  player2_name: string | null;
  player1_cat: string | null;
  player2_cat: string | null;
};

export default function AdminRegistrations() {
  const { tournamentId } = useParams<{ tournamentId?: string }>();
  const { toast } = useToast();

  const [tournaments, setTournaments] = useState<Tables<"tournaments">[]>([]);
  const [selectedId, setSelectedId] = useState<string>(tournamentId ?? "");
  const [tournament, setTournament] = useState<Tables<"tournaments"> | null>(null);
  const [cats, setCats] = useState<TCat[]>([]);
  const [activeCatId, setActiveCatId] = useState<string>("all");
  const ALL = "__all__";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [comment, setComment] = useState<Record<string, string>>({});

  useEffect(() => {
    void supabase.from("tournaments").select("*").order("start_date", { ascending: false }).then(({ data }) => {
      setTournaments(data ?? []);
      if (!selectedId) setSelectedId(ALL);
    });
  }, []);

  useEffect(() => {
    if (selectedId) void load(selectedId);
  }, [selectedId]);

  async function load(tid: string) {
    setLoading(true);
    const isAll = tid === ALL;
    const [tRes, tcRes, regsRes] = await Promise.all([
      isAll
        ? Promise.resolve({ data: null })
        : supabase.from("tournaments").select("*").eq("id", tid).maybeSingle(),
      isAll
        ? supabase.from("tournament_categories").select("*, category:categories(*)").order("position")
        : supabase.from("tournament_categories").select("*, category:categories(*)").eq("tournament_id", tid).order("position"),
      (isAll
        ? supabase.from("registrations")
            .select("id, status, registered_at, pair_id, tournament_id, tournament_category_id, approval_reason, admin_comment, availability, partner_confirmed, pairs!inner(player1_id, player2_id)")
            .order("registered_at", { ascending: false })
        : supabase.from("registrations")
            .select("id, status, registered_at, pair_id, tournament_id, tournament_category_id, approval_reason, admin_comment, availability, partner_confirmed, pairs!inner(player1_id, player2_id)")
            .eq("tournament_id", tid)
            .order("registered_at", { ascending: false })
      ),
    ]);
    const t = (tRes as any).data;
    const tc = (tcRes as any).data;
    const regs = (regsRes as any).data;
    setTournament(t);
    setCats((tc ?? []) as TCat[]);

    const userIds = new Set<string>();
    (regs ?? []).forEach((r: any) => {
      userIds.add(r.pairs.player1_id); userIds.add(r.pairs.player2_id);
    });
    const { data: profs } = userIds.size
      ? await supabase.from("profiles").select("user_id, full_name, category:categories(name)").in("user_id", Array.from(userIds))
      : { data: [] as any[] };
    const map = new Map<string, { full_name: string | null; cat: string | null }>();
    (profs ?? []).forEach((p: any) => map.set(p.user_id, {
      full_name: p.full_name, cat: p.category?.name ?? null,
    }));
    const tMap = new Map<string, string>();
    tournaments.forEach((tt) => tMap.set(tt.id, tt.name));
    if (t) tMap.set(t.id, t.name);

    setRows((regs ?? []).map((r: any) => ({
      id: r.id, status: r.status, registered_at: r.registered_at, pair_id: r.pair_id,
      tournament_id: r.tournament_id,
      tournament_name: tMap.get(r.tournament_id) ?? null,
      tournament_category_id: r.tournament_category_id,
      approval_reason: r.approval_reason, admin_comment: r.admin_comment,
      availability: r.availability ?? null,
      partner_confirmed: r.partner_confirmed,
      player1_name: map.get(r.pairs.player1_id)?.full_name ?? "—",
      player2_name: map.get(r.pairs.player2_id)?.full_name ?? "—",
      player1_cat: map.get(r.pairs.player1_id)?.cat ?? null,
      player2_cat: map.get(r.pairs.player2_id)?.cat ?? null,
    })));
    setLoading(false);
  }

  async function review(reg: Row, approve: boolean) {
    const { error } = await (supabase.rpc as any)("admin_review_registration", {
      _registration_id: reg.id, _approve: approve, _comment: comment[reg.id] ?? null,
    });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: approve ? "Aprobada" : "Rechazada" });
    if (selectedId) void load(selectedId);
  }

  async function move(reg: Row, newCatId: string) {
    if (!newCatId || newCatId === reg.tournament_category_id) return;
    const { error } = await (supabase.rpc as any)("admin_move_registration", {
      _registration_id: reg.id, _new_tournament_category_id: newCatId,
    });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Pareja movida" });
    if (selectedId) void load(selectedId);
  }

  async function removeReg(reg: Row) {
    if (!confirm("¿Eliminar esta inscripción y la pareja asociada?")) return;
    await supabase.from("registrations").delete().eq("id", reg.id);
    await supabase.from("pairs").delete().eq("id", reg.pair_id);
    toast({ title: "Inscripción eliminada" });
    if (selectedId) void load(selectedId);
  }

  const filtered = activeCatId === "all" ? rows : rows.filter((r) => r.tournament_category_id === activeCatId);
  const counts = filtered.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {} as Record<string, number>);
  const activeCat = cats.find((c) => c.id === activeCatId) ?? null;

  return (
    <AppLayout>
      <div className="max-w-[1200px] mx-auto p-4 md:p-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Panel</Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Inscripciones</h1>
            <p className="text-sm text-muted-foreground">Aprobá o rechazá manualmente cuando hay diferencia de categoría.</p>
          </div>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full md:w-[320px]"><SelectValue placeholder="Elegí un torneo" /></SelectTrigger>
            <SelectContent>
              {tournaments.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {formatDate(t.start_date)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {tournament && cats.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Button size="sm" variant={activeCatId === "all" ? "default" : "outline"} className="min-h-[40px]" onClick={() => setActiveCatId("all")}>
              Todas ({rows.length})
            </Button>
            {cats.map((c) => {
              const approved = rows.filter((r) => r.tournament_category_id === c.id && r.status === "approved").length;
              return (
                <Button key={c.id} size="sm" variant={activeCatId === c.id ? "default" : "outline"} className="min-h-[40px]" onClick={() => setActiveCatId(c.id)}>
                  {tournamentCategoryLabel(c)} <span className="ml-2 text-xs opacity-70">{approved}/{c.max_pairs}</span>
                </Button>
              );
            })}
          </div>
        )}

        {tournament && (
          <Card className="p-4 mb-4 flex flex-wrap gap-2 text-xs items-center">
            <Stat label="Total" value={filtered.length} />
            <Stat label="Pendientes" value={counts.pending ?? 0} />
            <Stat label="Aprobadas" value={counts.approved ?? 0} />
            <Stat label="Rechazadas" value={counts.rejected ?? 0} />
            {activeCat && <Stat label="Cupos" value={`${counts.approved ?? 0}/${activeCat.max_pairs}`} />}
            <Button size="sm" className="ml-auto" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" />Agregar pareja
            </Button>
          </Card>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center"><p className="text-sm text-muted-foreground">No hay inscripciones.</p></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const catLabel = cats.find((c) => c.id === r.tournament_category_id);
              const needsReview = r.status === "pending" && !!r.approval_reason;
              return (
                <Card key={r.id} className={`p-4 ${needsReview ? "border-warning/50" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <strong className="text-sm">{r.player1_name} <span className="text-muted-foreground">/</span> {r.player2_name}</strong>
                        <Badge variant="outline" className={registrationStatusColors[r.status]}>{registrationStatusLabels[r.status]}</Badge>
                        {catLabel && <Badge variant="secondary">{tournamentCategoryLabel(catLabel)}</Badge>}
                        {!r.partner_confirmed && r.status === "pending" && (
                          <Badge variant="outline" className="border-info/40 text-info">Esperando compañero</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.player1_cat ?? "sin cat."} · {r.player2_cat ?? "sin cat."} · Inscripta {formatDate(r.registered_at)}
                      </div>
                      {needsReview && (
                        <div className="mt-2 flex gap-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs">
                          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                          <span>{r.approval_reason}</span>
                        </div>
                      )}
                      {r.availability && (
                        <div className="mt-2 rounded-md border border-border bg-muted/40 p-2 text-xs">
                          <span className="font-medium text-foreground">Disponibilidad:</span>{" "}
                          <span className="text-muted-foreground whitespace-pre-wrap">{r.availability}</span>
                        </div>
                      )}
                      {r.admin_comment && (
                        <div className="mt-2 text-xs text-muted-foreground italic">Nota: {r.admin_comment}</div>
                      )}
                    </div>
                    <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                      {r.status === "pending" && (
                        <Input
                          placeholder="Comentario (opcional)"
                          value={comment[r.id] ?? ""}
                          onChange={(e) => setComment((c) => ({ ...c, [r.id]: e.target.value }))}
                          className="h-9 text-xs w-full sm:w-[240px]"
                        />
                      )}
                      <div className="flex flex-wrap gap-1 justify-end">
                        {r.status !== "approved" && (
                          <Button size="sm" variant="outline" onClick={() => review(r, true)} className="h-9">
                            <Check className="h-4 w-4 mr-1 text-success" />Aprobar
                          </Button>
                        )}
                        {r.status !== "rejected" && (
                          <Button size="sm" variant="outline" onClick={() => review(r, false)} className="h-9">
                            <X className="h-4 w-4 mr-1 text-destructive" />Rechazar
                          </Button>
                        )}
                        {cats.length > 1 && (
                          <Select value="" onValueChange={(v) => move(r, v)}>
                            <SelectTrigger className="h-9 w-[160px]"><ArrowRightLeft className="h-4 w-4 mr-1" /><SelectValue placeholder="Mover" /></SelectTrigger>
                            <SelectContent>
                              {cats.filter((c) => c.id !== r.tournament_category_id).map((c) => (
                                <SelectItem key={c.id} value={c.id}>{tournamentCategoryLabel(c)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => removeReg(r)} className="h-9 text-destructive">
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {addOpen && tournament && (
        <AddPairDialog
          tournament={tournament}
          initialCategoryId={activeCatId !== "all" ? activeCatId : null}
          open={addOpen}
          onOpenChange={setAddOpen}
          onSuccess={() => { setAddOpen(false); if (selectedId) void load(selectedId); }}
        />
      )}
    </AppLayout>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-3 py-1.5 rounded bg-muted/60">
      <span className="text-muted-foreground">{label}:</span> <strong className="ml-1">{value}</strong>
    </div>
  );
}
