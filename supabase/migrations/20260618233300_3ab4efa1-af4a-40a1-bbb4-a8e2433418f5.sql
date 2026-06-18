-- 1. BUGS: restrict SELECT to reporter, assignee, or admin
DROP POLICY IF EXISTS "Bugs viewable by authenticated" ON public.bugs;
CREATE POLICY "Bugs viewable by reporter, assignee or admin"
  ON public.bugs FOR SELECT
  TO authenticated
  USING (
    auth.uid() = reporter_id
    OR auth.uid() = assignee_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- 2. COMMENTS: restrict SELECT to admins or users related to the parent bug
DROP POLICY IF EXISTS "Comments viewable by authenticated" ON public.comments;
CREATE POLICY "Comments viewable by bug participants or admin"
  ON public.comments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.bugs b
      WHERE b.id = comments.bug_id
        AND (b.reporter_id = auth.uid() OR b.assignee_id = auth.uid())
    )
  );

-- 3. REGISTRATIONS: drop broad approved-readable policy, expose safe data via SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Approved registrations viewable by authenticated" ON public.registrations;

-- Public-safe approved pairs for a tournament (no admin_comment / approval_reason / admin_notes / availability / reviewed_by / level_diff)
CREATE OR REPLACE FUNCTION public.get_tournament_approved_pairs(_tournament_id uuid)
RETURNS TABLE (
  registration_id uuid,
  tournament_id uuid,
  tournament_category_id uuid,
  pair_id uuid,
  player1_id uuid,
  player2_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.tournament_id, r.tournament_category_id, r.pair_id, p.player1_id, p.player2_id
    FROM public.registrations r
    JOIN public.pairs p ON p.id = r.pair_id
   WHERE r.tournament_id = _tournament_id
     AND r.status = 'approved';
$$;

-- Approved registration counts per tournament (for listing pages)
CREATE OR REPLACE FUNCTION public.get_approved_registration_counts()
RETURNS TABLE (tournament_id uuid, approved_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tournament_id, count(*)::bigint
    FROM public.registrations
   WHERE status = 'approved'
   GROUP BY tournament_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_tournament_approved_pairs(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_registration_counts() TO anon, authenticated;