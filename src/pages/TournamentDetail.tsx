import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Users, Trophy, ArrowLeft, Clock, ArrowRight } from "lucide-react";
import { Seo } from "@/components/Seo";
import { FixtureView } from "@/components/tournaments/FixtureView";
import { StandingsView } from "@/components/tournaments/StandingsView";
import {
  statusLabels,
  statusColors,
  tournamentTypeLabels,
  tournamentCategoryLabel,
  tournamentCategoryStatusLabels,
  formatDate,
  formatCurrency,
  type TournamentStatus,
  type TournamentCategoryRow,
} from "@/lib/tournament-helpers";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { RegisterDialog } from "@/components/tournaments/RegisterDialog";
import { useToast } from "@/hooks/use-toast";

type Tournament = Tables<"tournaments">;
type CategoryRow = Tables<"categories">;
type TCat = TournamentCategoryRow & { category: CategoryRow | null };

type ApprovedPair = {
  pair_id: string;
  tournament_category_id: string | null;
  player1_name: string | null;
  player2_name: string | null;
};

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [cats, setCats] = useState<TCat[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [pairs, setPairs] = useState<ApprovedPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [myReg, setMyReg] = useState<{ status: string; tcat: string | null } | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (id) void load();
  }, [id]);

  async function load() {
    setLoading(true);
    const { data: t } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", id!)
      .maybeSingle();
    if (!t) { setLoading(false); return; }
    setTournament(t);

    const { data: tc } = await supabase
      .from("tournament_categories")
      .select("*, category:categories(*)")
      .eq("tournament_id", id!)
      .order("position");
    const catsData = (tc ?? []) as TCat[];
    setCats(catsData);

    const { data: regs } = await supabase
      .from("registrations")
      .select("pair_id, tournament_category_id, pairs!inner(id, player1_id, player2_id)")
      .eq("tournament_id", id!)
      .eq("status", "approved");

    const userIds = new Set<string>();
    (regs ?? []).forEach((r: any) => {
      if (r.pairs?.player1_id) userIds.add(r.pairs.player1_id);
      if (r.pairs?.player2_id) userIds.add(r.pairs.player2_id);
    });
    const nameMap = new Map<string, string>();
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
        tournament_category_id: r.tournament_category_id,
        player1_name: nameMap.get(r.pairs.player1_id) ?? "Jugador",
        player2_name: nameMap.get(r.pairs.player2_id) ?? "Jugador",
      }))
    );

    if (user) {
      const { data: myPairs } = await supabase
        .from("pairs")
        .select("id")
        .eq("tournament_id", id!)
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id},created_by.eq.${user.id}`);
      const myPairIds = (myPairs ?? []).map((p) => p.id);
      if (myPairIds.length > 0) {
        const { data: myR } = await supabase
          .from("registrations")
          .select("status, tournament_category_id")
          .in("pair_id", myPairIds);
        if (myR && myR.length > 0) {
          setMyReg({ status: myR[0].status, tcat: myR[0].tournament_category_id });
        } else setMyReg(null);
      } else setMyReg(null);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-[1000px] mx-auto p-4 md:p-8 text-sm text-muted-foreground">Cargando torneo…</div>
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

  const selectedCat = selectedCatId ? cats.find((c) => c.id === selectedCatId) ?? null : null;
  const pairsInSelected = selectedCat ? pairs.filter((p) => p.tournament_category_id === selectedCat.id) : [];
  const cuposRest = selectedCat ? selectedCat.max_pairs - pairsInSelected.length : 0;
  const myInThis = !!(myReg && selectedCat && myReg.tcat === selectedCat.id);
  const canRegister = !!(
    selectedCat &&
    selectedCat.registration_open &&
    selectedCat.status === "open" &&
    cuposRest > 0 &&
    !myInThis &&
    (!myReg || myReg.tcat !== selectedCat.id)
  );

  function handleRegisterClick() {
    if (!user) { navigate("/auth"); return; }
    setShowRegister(true);
  }

  return (
    <AppLayout>
      <Seo
        title={`${tournament.name} — Off-Side`}
        description={(tournament.description?.slice(0, 155)) || `Torneo de pádel ${tournament.name} en ${tournament.location}.`}
        path={`/tournaments/${tournament.id}`}
      />
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
                  <Badge variant="outline">{tournamentTypeLabels[tournament.tournament_type as keyof typeof tournamentTypeLabels]}</Badge>
                  {cats.map((c) => (
                    <Badge key={c.id} variant="secondary">{tournamentCategoryLabel(c)}</Badge>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold">{formatCurrency(tournament.registration_fee)}</div>
                <div className="text-xs text-muted-foreground">por pareja</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <Stat icon={Calendar} label="Fecha" value={formatDate(tournament.start_date)} />
              <Stat icon={Clock} label="Horario" value={tournament.start_time ? `${tournament.start_time.slice(0, 5)} hs` : "—"} />
              <Stat icon={MapPin} label="Lugar" value={tournament.location} />
            </div>
          </div>
        </Card>

        {/* Categorías */}
        {!selectedCat ? (
          <Card className="p-4 md:p-6">
            <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">Categorías del torneo</h2>
            {cats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este torneo aún no tiene categorías configuradas.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {cats.map((c) => {
                  const insc = pairs.filter((p) => p.tournament_category_id === c.id).length;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCatId(c.id)}
                      className="text-left rounded-lg border border-border bg-card hover:bg-muted/50 transition p-4 min-h-[44px] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{tournamentCategoryLabel(c)}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <Users className="h-3 w-3" />
                          {insc} / {c.max_pairs}
                          <span className="mx-1">·</span>
                          {tournamentCategoryStatusLabels[c.status]}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {(tournament.description || tournament.rules || tournament.prizes) && (
              <div className="mt-6 space-y-4">
                {tournament.description && (
                  <div>
                    <h3 className="font-semibold mb-1 text-sm">Descripción</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tournament.description}</p>
                  </div>
                )}
                {tournament.rules && (
                  <div>
                    <h3 className="font-semibold mb-1 text-sm">Reglamento</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tournament.rules}</p>
                  </div>
                )}
                {tournament.prizes && (
                  <div>
                    <h3 className="font-semibold mb-1 text-sm">Premios</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tournament.prizes}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedCatId(null)} className="-ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />Categorías
              </Button>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{tournamentCategoryLabel(selectedCat)}</Badge>
                <Badge variant="outline">{tournamentCategoryStatusLabels[selectedCat.status]}</Badge>
              </div>
            </div>

            <Card className="p-4 md:p-6 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{pairsInSelected.length}</strong> / {selectedCat.max_pairs} parejas inscriptas
                  {selectedCat.mode === "suma" && (
                    <span className="block text-xs mt-1">Suma de niveles requerida: <strong>{selectedCat.suma_value}</strong></span>
                  )}
                </div>
                {myInThis ? (
                  <div className="text-sm text-muted-foreground">
                    Ya inscripto en esta categoría. Estado: <strong className="text-foreground">{myReg?.status}</strong>
                  </div>
                ) : canRegister ? (
                  <Button onClick={handleRegisterClick}>Inscribirme</Button>
                ) : (
                  <Button disabled variant="outline">
                    {!selectedCat.registration_open ? "Inscripciones cerradas"
                      : cuposRest <= 0 ? "Cupos completos"
                      : myReg ? "Ya inscripto en otra categoría"
                      : "No disponible"}
                  </Button>
                )}
              </div>
            </Card>

            <Tabs defaultValue="pairs">
              <TabsList>
                <TabsTrigger value="pairs">Inscriptos ({pairsInSelected.length})</TabsTrigger>
                <TabsTrigger value="fixture">Fixture</TabsTrigger>
                <TabsTrigger value="standings">Posiciones</TabsTrigger>
              </TabsList>

              <TabsContent value="pairs" className="mt-4">
                <Card className="p-6">
                  {pairsInSelected.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aún no hay parejas confirmadas.</p>
                  ) : (
                    <ul className="space-y-2">
                      {pairsInSelected.map((p, i) => (
                        <li key={p.pair_id} className="text-sm flex items-start gap-2 py-1.5 border-b border-border last:border-0">
                          <span className="text-xs text-muted-foreground font-mono w-5 pt-0.5">{i + 1}.</span>
                          <span>{p.player1_name} <span className="text-muted-foreground">/</span> {p.player2_name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="fixture" className="mt-4">
                <FixtureView tournamentId={tournament.id} tournamentCategoryId={selectedCat.id} />
              </TabsContent>

              <TabsContent value="standings" className="mt-4">
                <StandingsView tournamentId={tournament.id} tournamentCategoryId={selectedCat.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {showRegister && tournament && selectedCat && (
        <RegisterDialog
          tournament={tournament}
          tournamentCategory={selectedCat}
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
