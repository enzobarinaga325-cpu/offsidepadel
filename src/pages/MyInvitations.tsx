import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Seo } from "@/components/Seo";
import {
  registrationStatusLabels,
  registrationStatusColors,
  tournamentCategoryLabel,
  formatDate,
  type RegistrationStatus,
} from "@/lib/tournament-helpers";

type Invite = {
  id: string;
  status: RegistrationStatus;
  partner_confirmed: boolean;
  approval_reason: string | null;
  inviter_name: string | null;
  tournament_name: string;
  tournament_id: string;
  category_label: string;
  start_date: string;
};

export default function MyInvitations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { if (user) void load(); }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    // pairs where I am player1 or player2 but I'm NOT the inviter
    const { data: pairs } = await supabase
      .from("pairs")
      .select("id")
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`);
    const ids = (pairs ?? []).map((p) => p.id);
    if (ids.length === 0) { setItems([]); setLoading(false); return; }

    const { data: regs } = await supabase
      .from("registrations")
      .select(`id, status, partner_confirmed, approval_reason, invited_by, tournament_id,
        tournament:tournaments(name, start_date),
        tcat:tournament_categories(*, category:categories(*))`)
      .in("pair_id", ids)
      .neq("invited_by", user.id)
      .order("registered_at", { ascending: false });

    const inviterIds = Array.from(new Set((regs ?? []).map((r: any) => r.invited_by).filter(Boolean)));
    const { data: profs } = inviterIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", inviterIds)
      : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));

    setItems((regs ?? []).map((r: any) => ({
      id: r.id,
      status: r.status,
      partner_confirmed: r.partner_confirmed,
      approval_reason: r.approval_reason,
      inviter_name: map.get(r.invited_by) ?? null,
      tournament_name: r.tournament?.name ?? "—",
      tournament_id: r.tournament_id,
      start_date: r.tournament?.start_date ?? "",
      category_label: r.tcat ? tournamentCategoryLabel(r.tcat) : "—",
    })));
    setLoading(false);
  }

  async function confirm(id: string, accept: boolean) {
    setBusy(id);
    const { error } = await (supabase.rpc as any)("confirm_partner", { _registration_id: id, _accept: accept });
    setBusy(null);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: accept ? "Invitación aceptada" : "Invitación rechazada" });
    void load();
  }

  return (
    <AppLayout>
      <Seo title="Mis invitaciones — Off-Side" description="Confirmá las inscripciones a torneos donde fuiste invitado como compañero." path="/my-invitations" />
      <div className="max-w-[800px] mx-auto p-4 md:p-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/me"><ArrowLeft className="h-4 w-4 mr-1" />Mi perfil</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Mis invitaciones</h1>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No tenés invitaciones pendientes.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <Card key={it.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <strong className="text-sm">{it.tournament_name}</strong>
                      <Badge variant="secondary">{it.category_label}</Badge>
                      <Badge variant="outline" className={registrationStatusColors[it.status]}>{registrationStatusLabels[it.status]}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Te invitó: <strong className="text-foreground">{it.inviter_name ?? "—"}</strong> · {formatDate(it.start_date)}
                    </div>
                    {it.approval_reason && (
                      <div className="mt-2 text-xs text-warning">{it.approval_reason}</div>
                    )}
                  </div>
                  {!it.partner_confirmed && it.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => confirm(it.id, true)} disabled={busy === it.id}>
                        {busy === it.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}Aceptar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => confirm(it.id, false)} disabled={busy === it.id}>
                        <X className="h-4 w-4 mr-1" />Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
