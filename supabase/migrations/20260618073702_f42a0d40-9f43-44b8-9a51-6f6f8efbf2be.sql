
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, job_title, first_name, last_name, phone, phone_e164) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "tcat_select_all" ON public.tournament_categories;
CREATE POLICY "tcat_select_authenticated" ON public.tournament_categories
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.tournament_categories FROM anon;

REVOKE SELECT ON public.registrations FROM authenticated;
GRANT SELECT (id, tournament_id, tournament_category_id, pair_id, status, registered_by, registered_at, reviewed_at, reviewed_by, created_at, updated_at)
  ON public.registrations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.registrations TO authenticated;
