import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin, Users, Trophy, ArrowLeft, DollarSign, Clock } from "lucide-react";
import {
  statusLabels,
  statusColors,
  tournamentTypeLabels,
  formatDate,
  formatCurrency,
  type TournamentStatus,
} from "@/lib/tournament-helpers";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { RegisterDialog } from "@/components/tournaments/RegisterDialog";
import { useToast } from "@/hooks/use-toast";

type Tournament = Tables<"tournaments"> & {
  category: Tables<"categories"> | null;
};

type ApprovedPair = {
  pair_id: string;
  player1_name: string | null;
  player2_name: string | null;
};

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [pairs, setPairs] = useState<ApprovedPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRegStatus, setMyRegStatus] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (id) void load();
  }, [id]);

  async function load() {
    setLoading(true);
    const { data: t } = await supabase
      .from("tournaments")
      .select("*, category:categories(*)")
      .eq("id", id!)
      .maybeSingle();

    if (!t) {
      setLoading(false);
      return;
    }
    setTournament(t as Tournament);

    // Approved pairs with player names
    const { data: regs } = await supabase
      .from("registrations")
      .select("pair_id, pairs!inner(id, player1_id, player2_id)")
      .eq("tournament_id", id!)
      .eq("status", "approved");

    const userIds = new Set<string>();
    (regs ?? []).forEach((r: any) => {
      if (r.pairs?.player1_id) userIds.add(r.pairs.player1_id);
      if (r.pairs?.player2_id) userIds.add(r.pairs.player2_id);
    });

    let nameMap = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", Array.from(userIds));
      (profs ?? []).forEach((p) => nameMap.set(p.user_id, p.full_name ?? "Jugador"));
    }

    setPairs(
      (regs ?? []).map((r: any) => ({
        pair_id: r.pair_id,
        player1_name: nameMap.get(r.pairs.player1_id) ?? "Jugador",
        player2_name: nameMap.get(r.pairs.player2_id) ?? "Jugador",
      }))
    );

    if (user) {
      const { data: myReg } = await supabase
        .from("registrations")
        .select("status, pairs!inner(player1_id, player2_id, created_by)")
        .eq("tournament_id", id!)
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id},created_by.eq.${user.id}`, {
          foreignTable: "pairs",
        })
        .maybeSingle();
      setMyRegStatus(myReg?.status ?? null);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-[1000px] mx-auto p-4 md:p-8 text-sm text-muted-foreground">
          Cargando torneo…
        </div>
      </AppLayout>
    );
  }

  if (!tournament) {
    return (
      <AppLayout>
        <div className="max-w-[1000px] mx-auto p-4 md:p-8">
          <p className="text-sm text-muted-foreground">Torneo no encontrado.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/tournaments"><ArrowLeft className="h-4 w-4 mr-2" />Volver</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const cuposRestantes = tournament.max_pairs - pairs.length;
  const canRegister =
    tournament.registration_open &&
    tournament.status === "open" &&
    cuposRestantes > 0 &&
    !myRegStatus;

  function handleRegisterClick() {
    if (!user) {
      navigate("/auth");
      return;
    }
    setShowRegister(true);
  }

  return (
    <AppLayout>
      <div className="max-w-[1000px] mx-auto p-4 md:p-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/tournaments"><ArrowLeft className="h-4 w-4 mr-1" />Torneos</Link>
        </Button>

        {/* Hero */}
        <Card className="overflow-hidden mb-6">
          <div className="aspect-[3/1] bg-muted relative">
            {tournament.image_url ? (
              <img src={tournament.image_url} alt={tournament.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
                <Trophy className="h-16 w-16 text-primary/60" />
              </div>
            )}
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{tournament.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="outline" className={statusColors[tournament.status as TournamentStatus]}>
                    {statusLabels[tournament.status as TournamentStatus]}
                  </Badge>
                  {tournament.category && (
                    <Badge variant="secondary">{tournament.category.name}</Badge>
                  )}
                  <Badge variant="outline">{tournamentTypeLabels[tournament.tournament_type as keyof typeof tournamentTypeLabels]}</Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold">{formatCurrency(tournament.registration_fee)}</div>
                <div className="text-xs text-muted-foreground">por pareja</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <Stat icon={Calendar} label="Fecha" value={formatDate(tournament.start_date)} />
              <Stat icon={Clock} label="Horario" value={tournament.start_time ? `${tournament.start_time.slice(0, 5)} hs` : "—"} />
              <Stat icon={MapPin} label="Lugar" value={tournament.location} />
              <Stat icon={Users} label="Cupos" value={`${pairs.length} / ${tournament.max_pairs}`} />
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {myRegStatus ? (
                <div className="flex-1 text-sm text-muted-foreground">
                  Ya tenés una inscripción en este torneo. Estado: <strong className="text-foreground">{myRegStatus}</strong>.
                  Podés ver el detalle en{" "}
                  <Link to="/me" className="text-primary underline">Mi perfil</Link>.
                </div>
              ) : canRegister ? (
                <Button onClick={handleRegisterClick} size="lg">
                  Inscribirme
                </Button>
              ) : (
                <Button disabled size="lg" variant="outline">
                  {!tournament.registration_open
                    ? "Inscripciones cerradas"
                    : cuposRestantes <= 0
                      ? "Cupos completos"
                      : "No disponible"}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {cuposRestantes > 0 ? `${cuposRestantes} cupos restantes` : "Sin cupos disponibles"}
              </span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {tournament.description && (
              <Card className="p-6">
                <h2 className="font-semibold mb-2">Descripción</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tournament.description}</p>
              </Card>
            )}
            {tournament.rules && (
              <Card className="p-6">
                <h2 className="font-semibold mb-2">Reglamento</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tournament.rules}</p>
              </Card>
            )}
            {tournament.prizes && (
              <Card className="p-6">
                <h2 className="font-semibold mb-2">Premios</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tournament.prizes}</p>
              </Card>
            )}
          </div>

          <Card className="p-6 h-fit">
            <h2 className="font-semibold mb-3">Parejas confirmadas</h2>
            {pairs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay parejas confirmadas.</p>
            ) : (
              <ul className="space-y-2">
                {pairs.map((p, i) => (
                  <li key={p.pair_id} className="text-sm flex items-start gap-2 py-1.5 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground font-mono w-5 pt-0.5">{i + 1}.</span>
                    <span>{p.player1_name} <span className="text-muted-foreground">/</span> {p.player2_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {showRegister && tournament && (
        <RegisterDialog
          tournament={tournament}
          open={showRegister}
          onOpenChange={setShowRegister}
          onSuccess={() => {
            toast({ title: "Inscripción enviada", description: "Espera la aprobación del administrador." });
            void load();
          }}
        />
      )}
    </AppLayout>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
