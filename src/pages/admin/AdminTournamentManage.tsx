import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Play, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FixtureView } from "@/components/tournaments/FixtureView";
import { StandingsView } from "@/components/tournaments/StandingsView";
import { GroupsManager } from "@/components/admin/GroupsManager";

import {
  tournamentCategoryLabel,
  tournamentCategoryStatusLabels,
  type TournamentCategoryRow,
} from "@/lib/tournament-helpers";
import type { Tables } from "@/integrations/supabase/types";

type CatRow = Tables<"categories">;
type TCat = TournamentCategoryRow & { category: CatRow | null };

export default function AdminTournamentManage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [tournament, setTournament] = useState<Tables<"tournaments"> | null>(null);
  const [cats, setCats] = useState<TCat[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [approvedByCat, setApprovedByCat] = useState<Record<string, number>>({});
  const [matchesByCat, setMatchesByCat] = useState<Record<string, number>>({});
  const [groupsCount, setGroupsCount] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => { void load(); }, [id]);

  async function load() {
    if (!id) return;
    const [{ data: t }, { data: tc }, { data: regs }, { data: ms }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
      supabase.from("tournament_categories").select("*, category:categories(*)").eq("tournament_id", id).order("position"),
      supabase.from("registrations").select("tournament_category_id, status").eq("tournament_id", id),
      supabase.from("matches").select("tournament_category_id").eq("tournament_id", id),
    ]);
    setTournament(t);
    const catsData = (tc ?? []) as TCat[];
    setCats(catsData);
    if (catsData.length > 0 && (!activeCatId || !catsData.find((c) => c.id === activeCatId))) {
      setActiveCatId(catsData[0].id);
    }
    const ac: Record<string, number> = {};
    (regs ?? []).forEach((r: any) => {
      if (r.status === "approved" && r.tournament_category_id) {
        ac[r.tournament_category_id] = (ac[r.tournament_category_id] ?? 0) + 1;
      }
    });
    setApprovedByCat(ac);
    const mc: Record<string, number> = {};
    (ms ?? []).forEach((m: any) => {
      if (m.tournament_category_id) mc[m.tournament_category_id] = (mc[m.tournament_category_id] ?? 0) + 1;
    });
    setMatchesByCat(mc);
  }

  const activeCat = cats.find((c) => c.id === activeCatId) ?? null;
  const approvedCount = activeCat ? (approvedByCat[activeCat.id] ?? 0) : 0;
  const matchCount = activeCat ? (matchesByCat[activeCat.id] ?? 0) : 0;

  async function generateFixture() {
    if (!activeCat) return;
    if (matchCount > 0 && !confirm("Ya hay un fixture generado para esta categoría. ¿Reemplazarlo?")) return;
    setGenerating(true);
    const { data, error } = await supabase.rpc("generate_fixture_for_category" as any, {
      _tournament_category_id: activeCat.id,
      _groups_count: groupsCount,
    });
    setGenerating(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Fixture generado", description: `${(data as any)?.matches ?? 0} partidos creados.` });
    void load();
  }

  async function finalize() {
    if (!activeCat) return;
    if (!confirm("Finalizar esta categoría y otorgar puntos de ranking?")) return;
    setFinalizing(true);
    const { error } = await supabase.rpc("finalize_tournament_category" as any, {
      _tournament_category_id: activeCat.id,
    });
    setFinalizing(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Categoría finalizada" });
    void load();
  }

  async function toggleCloseCategory() {
    if (!activeCat) return;
    const newStatus = activeCat.status === "closed" ? "open" : "closed";
    setClosing(true);
    const { error } = await supabase
      .from("tournament_categories")
      .update({ status: newStatus, registration_open: newStatus === "open" })
      .eq("id", activeCat.id);
    setClosing(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: newStatus === "closed" ? "Categoría cerrada" : "Categoría reabierta" });
    void load();
  }

  if (!tournament) {
    return <AppLayout><div className="p-8 text-sm text-muted-foreground">Cargando…</div></AppLayout>;
  }

  const isGroups = tournament.tournament_type === "groups_elimination";

  return (
    <AppLayout>
      <div className="max-w-[1200px] mx-auto p-4 md:p-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/admin/tournaments"><ArrowLeft className="h-4 w-4 mr-1" />Torneos</Link>
        </Button>

        <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{tournament.name}</h1>
            <p className="text-sm text-muted-foreground">
              {cats.length} categoría{cats.length === 1 ? "" : "s"} · Estado torneo: <strong>{tournament.status}</strong>
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/registrations/${tournament.id}`}>Inscripciones</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/tournaments/${tournament.id}/edit`}>Editar</Link>
            </Button>
          </div>
        </div>

        {cats.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Este torneo no tiene categorías. Editalo para agregar al menos una.
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {cats.map((c) => (
                <Button
                  key={c.id}
                  variant={c.id === activeCatId ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCatId(c.id)}
                  className="min-h-[44px]"
                >
                  {tournamentCategoryLabel(c)}
                  <span className="ml-2 text-xs opacity-70">
                    {(approvedByCat[c.id] ?? 0)}/{c.max_pairs}
                  </span>
                </Button>
              ))}
            </div>

            {activeCat && (
              <>
                <Card className="p-4 mb-6">
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="text-sm">
                      <div className="font-semibold">{tournamentCategoryLabel(activeCat)}</div>
                      <div className="text-xs text-muted-foreground">
                        {approvedCount} aprobadas · {matchCount} partidos · {tournamentCategoryStatusLabels[activeCat.status]}
                      </div>
                    </div>
                    {isGroups && (
                      <div className="space-y-1">
                        <Label className="text-xs">Cantidad de grupos</Label>
                        <Input type="number" min="2" max="16" value={groupsCount}
                          onChange={(e) => setGroupsCount(parseInt(e.target.value) || 4)}
                          className="w-24 h-9" />
                      </div>
                    )}
                    <Button onClick={generateFixture} disabled={generating || approvedCount < 2}>
                      {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                      {matchCount > 0 ? "Regenerar fixture" : "Generar fixture"}
                    </Button>
                    {matchCount > 0 && (
                      <Button onClick={finalize} disabled={finalizing} variant="outline">
                        {finalizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Finalizar categoría
                      </Button>
                    )}
                    <Button onClick={toggleCloseCategory} disabled={closing} variant="outline">
                      <XCircle className="h-4 w-4 mr-2" />
                      {activeCat.status === "closed" ? "Reabrir" : "Cerrar"} categoría
                    </Button>
                    {approvedCount < 2 && (
                      <span className="text-xs text-muted-foreground">Necesitás al menos 2 parejas aprobadas.</span>
                    )}
                  </div>
                </Card>

                <Tabs defaultValue="fixture">
                  <TabsList>
                    <TabsTrigger value="fixture">Fixture</TabsTrigger>
                    <TabsTrigger value="standings">Posiciones</TabsTrigger>
                  </TabsList>
                  <TabsContent value="fixture" className="mt-4">
                    <FixtureView tournamentId={tournament.id} tournamentCategoryId={activeCat.id} />
                  </TabsContent>
                  <TabsContent value="standings" className="mt-4">
                    <StandingsView tournamentId={tournament.id} tournamentCategoryId={activeCat.id} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
