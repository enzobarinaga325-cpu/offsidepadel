
-- Restrict anonymous reads on business tables to authenticated
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Categories viewable by authenticated" ON public.categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Matches public read" ON public.matches;
CREATE POLICY "Matches viewable by authenticated" ON public.matches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Pairs are viewable by everyone" ON public.pairs;
CREATE POLICY "Pairs viewable by authenticated" ON public.pairs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Approved registrations are viewable by everyone" ON public.registrations;
CREATE POLICY "Approved registrations viewable by authenticated" ON public.registrations FOR SELECT TO authenticated USING (status = 'approved');

DROP POLICY IF EXISTS "Ranking public read" ON public.ranking_points;
CREATE POLICY "Ranking viewable by authenticated" ON public.ranking_points FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Standings public read" ON public.standings;
CREATE POLICY "Standings viewable by authenticated" ON public.standings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Groups public read" ON public.tournament_groups;
CREATE POLICY "Groups viewable by authenticated" ON public.tournament_groups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Points config viewable by everyone" ON public.tournament_points_config;
CREATE POLICY "Points config viewable by authenticated" ON public.tournament_points_config FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON public.tournaments;
CREATE POLICY "Tournaments viewable by authenticated" ON public.tournaments FOR SELECT TO authenticated USING (true);

-- Revoke anon grants on these tables
REVOKE SELECT ON public.categories, public.matches, public.pairs, public.registrations,
  public.ranking_points, public.standings, public.tournament_groups,
  public.tournament_points_config, public.tournaments FROM anon;

-- Profiles: hide phone from other users. Only owner/admin sees phone via direct row;
-- restrict broad SELECT to non-phone use by replacing policy: owner+admin only.
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles owner or admin full read" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Public-safe view (no phone) so the app can still list players
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT user_id, full_name, first_name, last_name, avatar_url, job_title, category_id, created_at, updated_at
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO authenticated;

-- Activity log: scope to admins or bug stakeholders
DROP POLICY IF EXISTS "Activity viewable by authenticated" ON public.activity_log;
CREATE POLICY "Activity viewable by admin or stakeholders" ON public.activity_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.bugs b
      WHERE b.id = activity_log.bug_id
        AND (b.reporter_id = auth.uid() OR b.assignee_id = auth.uid())
    )
  );

-- Storage: tighten bug-attachments SELECT to admin/uploader/bug stakeholders
DROP POLICY IF EXISTS "Authenticated can view bug attachments" ON storage.objects;
CREATE POLICY "Bug attachments viewable by stakeholders" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bug-attachments'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.attachments a
        JOIN public.bugs b ON b.id = a.bug_id
        WHERE a.file_path = storage.objects.name
          AND (a.user_id = auth.uid() OR b.reporter_id = auth.uid() OR b.assignee_id = auth.uid())
      )
    )
  );
