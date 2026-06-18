import type { Database, Tables } from "@/integrations/supabase/types";

export type TournamentStatus = Database["public"]["Enums"]["tournament_status"];
export type TournamentType = Database["public"]["Enums"]["tournament_type"];
export type RegistrationStatus = Database["public"]["Enums"]["registration_status"];
export type CategoryGender = Database["public"]["Enums"]["category_gender"];
export type TournamentGender = Database["public"]["Enums"]["tournament_gender"];
export type TournamentCategoryMode = Database["public"]["Enums"]["tournament_category_mode"];
export type TournamentCategoryStatus = Database["public"]["Enums"]["tournament_category_status"];
export type TournamentCategoryRow = Tables<"tournament_categories">;

export const tournamentGenderLabels: Record<TournamentGender, string> = {
  mens: "Caballeros",
  womens: "Damas",
  mixed: "Mixto",
};

export const tournamentCategoryStatusLabels: Record<TournamentCategoryStatus, string> = {
  open: "Abierta",
  in_progress: "En juego",
  closed: "Cerrada",
  finished: "Finalizada",
};

const LEVEL_TO_INT: Record<string, number> = {
  "1ra": 1, "2da": 2, "3ra": 3, "4ta": 4,
  "5ta": 5, "6ta": 6, "7ma": 7, "8va": 8,
};

export function categoryLevelToInt(level: string | null | undefined): number | null {
  if (!level) return null;
  return LEVEL_TO_INT[level.toLowerCase()] ?? null;
}

const LEVEL_SHORT: Record<string, string> = {
  "1ra": "1ª", "2da": "2ª", "3ra": "3ª", "4ta": "4ª",
  "5ta": "5ª", "6ta": "6ª", "7ma": "7ª", "8va": "8ª",
};

export function tournamentCategoryLabel(
  tc: Pick<TournamentCategoryRow, "mode" | "suma_value" | "gender" | "label"> & {
    category?: { name?: string | null; level?: string | null } | null;
  }
): string {
  if (tc.label && tc.label.trim()) return tc.label.trim();
  const g = tournamentGenderLabels[tc.gender];
  if (tc.mode === "suma") return `Suma ${tc.suma_value ?? "?"} ${g}`;
  const lvl = tc.category?.level ? (LEVEL_SHORT[tc.category.level] ?? tc.category.level) : "—";
  return `${lvl} ${g}`;
}

export const statusLabels: Record<TournamentStatus, string> = {
  upcoming: "Próximamente",
  open: "Inscripciones abiertas",
  full: "Cupos completos",
  in_progress: "En juego",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

export const statusColors: Record<TournamentStatus, string> = {
  upcoming: "bg-info/15 text-info border-info/30",
  open: "bg-success/15 text-success border-success/30",
  full: "bg-warning/15 text-warning border-warning/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  finished: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

export const tournamentTypeLabels: Record<TournamentType, string> = {
  elimination: "Eliminación directa",
  groups_elimination: "Grupos + eliminación",
  round_robin: "Todos contra todos",
};

export const registrationStatusLabels: Record<RegistrationStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  waitlist: "Lista de espera",
};

export const registrationStatusColors: Record<RegistrationStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  waitlist: "bg-info/15 text-info border-info/30",
};

export const categoryGenderLabels: Record<CategoryGender, string> = {
  male: "Masculino",
  female: "Femenino",
  mixed: "Mixto",
};

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  if (n === 0) return "Gratis";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}
