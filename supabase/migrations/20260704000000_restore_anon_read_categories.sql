-- Visitantes no logueados no podían ver el nombre/nivel de las categorías (torneos,
-- ranking, etc. les mostraban "—" o listas vacías) porque una migración anterior
-- (20260618060722) le sacó a "anon" el acceso de lectura a "categories" asumiendo que
-- todo pasaría por la edge function public-categories, pero varias páginas públicas
-- (Tournaments, TournamentDetail, Ranking, RegisterDialog, MyInvitations) siguen
-- leyendo la tabla directamente. La tabla no tiene datos sensibles (solo nombre,
-- género, nivel, descripción), así que se restaura el acceso público de lectura,
-- igual que ya tienen tournament_categories/matches/standings/tournament_groups.

GRANT SELECT ON public.categories TO anon;

DROP POLICY IF EXISTS "Categories viewable by authenticated" ON public.categories;
DROP POLICY IF EXISTS "Categories viewable by everyone" ON public.categories;
CREATE POLICY "Categories viewable by everyone"
  ON public.categories FOR SELECT
  USING (true);
