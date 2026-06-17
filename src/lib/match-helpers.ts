export const roundLabels: Record<string, string> = {
  groups: "Grupos",
  r64: "64vos",
  r32: "32vos",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semifinal",
  final: "Final",
  third_place: "3er puesto",
};

export const roundOrder: Record<string, number> = {
  groups: 0,
  r64: 1,
  r32: 2,
  r16: 3,
  qf: 4,
  sf: 5,
  third_place: 6,
  final: 7,
};

export const matchStatusLabels: Record<string, string> = {
  scheduled: "Programado",
  in_progress: "En juego",
  finished: "Finalizado",
  walkover: "W.O.",
  cancelled: "Cancelado",
};

export function formatSetsScore(score: any): string {
  if (!Array.isArray(score) || score.length === 0) return "—";
  return score.map((s: any) => `${s.a}-${s.b}`).join(" / ");
}
