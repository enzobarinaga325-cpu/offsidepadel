import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Play, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FixtureView } from "@/components/tournaments/FixtureView";
import { StandingsView } from "@/components/tournaments/StandingsView";
import type { Tables } from "@/integrations/supabase/types";

export default function AdminTournamentManage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [tournament, setTournament] = useState<Tables<"tournaments"> | null>(null);
  const [approvedCount, setApprovedCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => { void load(); }, [id]);

  async function load() {
    if (!id) return;
    const [{ data: t }, { count: ac }, { count: mc }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
      supabase.from("registrations").select("*", { count: "exact", head: true }).eq("tournament_id", id).eq("status", "approved"),
      supabase.from("matches").select("*", { count: "exact", head: true }).eq("tournament_id", id),
    ]);
    setTournament(t);
    setApprovedCount(ac ?? 0);
    setMatchCount(mc ?? 0);
  }

  async function generateFixture() {
    if (!id) return;
    if (matchCount > 0 && !confirm("Ya hay un fixture generado. ¿Reemplazarlo?")) return;
    setGenerating(true);
    const { data, error } = await supabase.rpc("generate_fixture", { _tournament_id: id, _groups_count: groupsCount });
    setGenerating(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Fixture generado", description: `${(data as any)?.matches ?? 0} partidos creados.` });
    void load();
  }

  async function finalize() {
    if (!id) return;
    if (!confirm("Finalizar el torneo y otorgar puntos de ranking?")) return;
    setFinalizing(true);
    const { error } = await supabase.rpc("finalize_tournament", { _tournament_id: id });
    setFinalizing(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Torneo finalizado" });
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
              {approvedCount} parejas aprobadas · {matchCount} partidos · Estado: <strong>{tournament.status}</strong>
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

        <Card className="p-4 mb-6">
          <div className="flex items-end gap-3 flex-wrap">
            {isGroups && (
              <div className="space-y-1">
                <Label className="text-xs">Cantidad de grupos</Label>
                <Input type="number" min="2" max="16" value={groupsCount} onChange={(e) => setGroupsCount(parseInt(e.target.value) || 4)} className="w-24 h-9" />
              </div>
            )}
            <Button onClick={generateFixture} disabled={generating || approvedCount < 2}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {matchCount > 0 ? "Regenerar fixture" : "Generar fixture"}
            </Button>
            {matchCount > 0 && (
              <Button onClick={finalize} disabled={finalizing} variant="outline">
                {finalizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Finalizar torneo
              </Button>
            )}
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
            <FixtureView tournamentId={tournament.id} />
          </TabsContent>
          <TabsContent value="standings" className="mt-4">
            <StandingsView tournamentId={tournament.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
