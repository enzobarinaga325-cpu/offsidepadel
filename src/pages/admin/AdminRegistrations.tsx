import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, X, Clock, UserMinus, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  registrationStatusLabels,
  registrationStatusColors,
  formatDate,
  type RegistrationStatus,
} from "@/lib/tournament-helpers";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { AddPairDialog } from "@/components/admin/AddPairDialog";

type Row = {
  id: string;
  status: RegistrationStatus;
  registered_at: string;
  pair_id: string;
  player1: { user_id: string; full_name: string | null } | null;
  player2: { user_id: string; full_name: string | null } | null;
};

export default function AdminRegistrations() {
  const { tournamentId } = useParams<{ tournamentId?: string }>();
  const { toast } = useToast();
  const { user } = useAuth();

  const [tournaments, setTournaments] = useState<Tables<"tournaments">[]>([]);
  const [selectedId, setSelectedId] = useState<string>(tournamentId ?? "");
  const [tournament, setTournament] = useState<Tables<"tournaments"> | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    void supabase.from("tournaments").select("*").order("start_date", { ascending: false }).then(({ data }) => {
      setTournaments(data ?? []);
      if (!selectedId && data && data[0]) setSelectedId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedId) void load(selectedId);
  }, [selectedId]);

  async function load(tid: string) {
    setLoading(true);
    const { data: t } = await supabase.from("tournaments").select("*").eq("id", tid).maybeSingle();
    setTournament(t);

    const { data: regs } = await supabase
      .from("registrations")
      .select("id, status, registered_at, pair_id, pairs!inner(player1_id, player2_id)")
      .eq("tournament_id", tid)
      .order("registered_at", { ascending: true });

    const userIds = new Set<string>();
    (regs ?? []).forEach((r: any) => {
      userIds.add(r.pairs.player1_id);
      userIds.add(r.pairs.player2_id);
    });
    const { data: profs } = userIds.size
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", Array.from(userIds))
      : { data: [] as any[] };
    const nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));

    setRows(
      (regs ?? []).map((r: any) => ({
        id: r.id,
        status: r.status,
        registered_at: r.registered_at,
        pair_id: r.pair_id,
        player1: { user_id: r.pairs.player1_id, full_name: nameMap.get(r.pairs.player1_id) ?? null },
        player2: { user_id: r.pairs.player2_id, full_name: nameMap.get(r.pairs.player2_id) ?? null },
      }))
    );
    setLoading(false);
  }

  async function updateStatus(reg: Row, status: RegistrationStatus) {
    const { error } = await supabase
      .from("registrations")
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
      .eq("id", reg.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Inscripción ${registrationStatusLabels[status].toLowerCase()}` });
    if (selectedId) void load(selectedId);
  }

  async function removeReg(reg: Row) {
    if (!confirm("¿Eliminar esta inscripción y la pareja asociada?")) return;
    await supabase.from("registrations").delete().eq("id", reg.id);
    await supabase.from("pairs").delete().eq("id", reg.pair_id);
    toast({ title: "Inscripción eliminada" });
    if (selectedId) void load(selectedId);
  }

  const groupedCounts = rows.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {} as Record<string, number>
  );

  return (
    <AppLayout>
      <div className="max-w-[1100px] mx-auto p-4 md:p-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Panel</Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Inscripciones</h1>
            <p className="text-sm text-muted-foreground">Aprobar, rechazar o mover a lista de espera.</p>
          </div>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full md:w-[320px]"><SelectValue placeholder="Elegí un torneo" /></SelectTrigger>
            <SelectContent>
              {tournaments.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name} · {formatDate(t.start_date)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tournament && (
          <Card className="p-4 mb-4 flex flex-wrap gap-2 text-xs">
            <Stat label="Total" value={rows.length} />
            <Stat label="Pendientes" value={groupedCounts.pending ?? 0} />
            <Stat label="Aprobadas" value={groupedCounts.approved ?? 0} />
            <Stat label="Lista de espera" value={groupedCounts.waitlist ?? 0} />
            <Stat label="Rechazadas" value={groupedCounts.rejected ?? 0} />
            <Stat label="Cupo máximo" value={tournament.max_pairs} />
            <Button size="sm" className="ml-auto" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" />Agregar pareja
            </Button>
          </Card>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : rows.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No hay inscripciones en este torneo.</p>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Pareja</th>
                    <th className="text-left px-4 py-3 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 font-medium">Inscripta</th>
                    <th className="text-right px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3">
                        {r.player1?.full_name ?? "—"} <span className="text-muted-foreground">/</span> {r.player2?.full_name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={registrationStatusColors[r.status]}>{registrationStatusLabels[r.status]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(r.registered_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {r.status !== "approved" && (
                            <Button variant="ghost" size="icon" title="Aprobar" onClick={() => updateStatus(r, "approved")}>
                              <Check className="h-4 w-4 text-success" />
                            </Button>
                          )}
                          {r.status !== "rejected" && (
                            <Button variant="ghost" size="icon" title="Rechazar" onClick={() => updateStatus(r, "rejected")}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          {r.status !== "waitlist" && (
                            <Button variant="ghost" size="icon" title="Lista de espera" onClick={() => updateStatus(r, "waitlist")}>
                              <Clock className="h-4 w-4 text-info" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Eliminar" onClick={() => removeReg(r)}>
                            <UserMinus className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {addOpen && tournament && (
        <AddPairDialog
          tournament={tournament}
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
