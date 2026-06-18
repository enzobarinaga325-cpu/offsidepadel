import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Loader2, ArrowUp, ArrowDown, KeyRound, UserX, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Player = {
  user_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  category_id: string | null;
  is_active: boolean | null;
};
type Category = { id: string; name: string; level: string | null };

const LEVEL_ORDER = ["8va","7ma","6ta","5ta","4ta","3ra","2da","1ra","damas","mixto"];

export default function AdminPlayers() {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: cats }, { data: profs }] = await Promise.all([
      supabase.from("categories").select("id, name, level").order("name"),
      supabase.from("profiles").select("user_id, full_name, first_name, last_name, phone, avatar_url, category_id, is_active").order("full_name"),
    ]);
    setCategories(cats ?? []);
    setPlayers((profs ?? []) as Player[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("admin-players-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as any)?.user_id;
              return prev.filter((p) => p.user_id !== oldId);
            }
            const row = payload.new as Player;
            if (!row?.user_id) return prev;
            const exists = prev.some((p) => p.user_id === row.user_id);
            if (exists) {
              return prev.map((p) => (p.user_id === row.user_id ? { ...p, ...row } : p));
            }
            return [...prev, row].sort((a, b) =>
              (a.full_name ?? "").localeCompare(b.full_name ?? "")
            );
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => {
      const hay = `${p.full_name ?? ""} ${p.first_name ?? ""} ${p.last_name ?? ""} ${p.phone ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [players, query]);

  const sortedCats = useMemo(() => {
    return [...categories].sort((a, b) => {
      const ai = LEVEL_ORDER.indexOf((a.level ?? "").toLowerCase());
      const bi = LEVEL_ORDER.indexOf((b.level ?? "").toLowerCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [categories]);

  function levelIndex(catId: string | null): number {
    if (!catId) return -1;
    const lvl = (categories.find((c) => c.id === catId)?.level ?? "").toLowerCase();
    return LEVEL_ORDER.indexOf(lvl);
  }

  async function setCategory(userId: string, categoryId: string | null) {
    setSavingId(userId);
    const { error } = await supabase.rpc("admin_set_user_category", {
      _user_id: userId,
      _category_id: categoryId as any,
    });
    setSavingId(null);
    if (error) {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
      return;
    }
    setPlayers((prev) => prev.map((p) => (p.user_id === userId ? { ...p, category_id: categoryId } : p)));
    toast({ title: "Categoría actualizada" });
  }

  function shift(userId: string, currentCatId: string | null, delta: number) {
    const idx = levelIndex(currentCatId);
    const sortedMen = sortedCats.filter((c) => LEVEL_ORDER.indexOf((c.level ?? "").toLowerCase()) < 8);
    if (sortedMen.length === 0) return;
    let pos = sortedMen.findIndex((c) => c.id === currentCatId);
    if (pos === -1) pos = 0;
    const next = sortedMen[Math.max(0, Math.min(sortedMen.length - 1, pos + delta))];
    if (!next || next.id === currentCatId) return;
    void setCategory(userId, next.id);
  }

  const [resetForId, setResetForId] = useState<string | null>(null);
  const [tempPin, setTempPin] = useState<string | null>(null);

  async function resetPin(userId: string) {
    setSavingId(userId);
    const { data, error } = await supabase.functions.invoke("admin-reset-pin", {
      body: { userId },
    });
    setSavingId(null);
    if (error || data?.error) {
      toast({ title: "Error", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    setTempPin(data.pin);
    setResetForId(userId);
  }

  async function toggleActive(userId: string, current: boolean | null) {
    setSavingId(userId);
    const { error } = await supabase.rpc("admin_set_user_active", {
      _user_id: userId,
      _active: !(current ?? true),
    });
    setSavingId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: current === false ? "Usuario reactivado" : "Usuario desactivado" });
  }

  return (
    <AppLayout>
      <div className="max-w-[1000px] mx-auto p-4 md:p-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link>
        </Button>

        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">Jugadores y categorías</h1>
          <p className="text-sm text-muted-foreground">Solo el administrador puede modificar la categoría de un jugador.</p>
        </div>

        <div className="relative mb-4">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jugador por nombre…"
            className="pl-9 h-11"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">No hay jugadores que coincidan.</Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const cat = categories.find((c) => c.id === p.category_id);
              return (
                <Card key={p.user_id} className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="h-10 w-10 shrink-0">
                        {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                        <AvatarFallback>
                          {(p.full_name ?? "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {p.first_name || p.last_name
                            ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
                            : p.full_name || "Sin nombre"}
                        </div>
                        <div className="text-[12px] text-muted-foreground truncate">
                          {p.phone ? (
                            <a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a>
                          ) : (
                            "Sin celular"
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {cat ? (
                            <Badge variant="secondary" className="text-[11px]">{cat.name}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px] text-muted-foreground">Sin categoría</Badge>
                          )}
                          {p.is_active === false && (
                            <Badge variant="destructive" className="text-[11px]">Desactivado</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:justify-end">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        title="Ascender categoría"
                        onClick={() => shift(p.user_id, p.category_id, -1)}
                        disabled={savingId === p.user_id}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        title="Descender categoría"
                        onClick={() => shift(p.user_id, p.category_id, 1)}
                        disabled={savingId === p.user_id}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Select
                        value={p.category_id ?? ""}
                        onValueChange={(v) => setCategory(p.user_id, v || null)}
                        disabled={savingId === p.user_id}
                      >
                        <SelectTrigger className="h-10 w-full sm:w-[180px]">
                          <SelectValue placeholder="Cambiar a…" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedCats.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
