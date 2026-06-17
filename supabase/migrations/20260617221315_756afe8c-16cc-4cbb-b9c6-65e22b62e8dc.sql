
-- 1) players: restrict SELECT (contains phone) to owner and admins
DROP POLICY IF EXISTS "Players are viewable by authenticated users" ON public.players;
CREATE POLICY "Players viewable by owner or admin"
ON public.players
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2) attachments: restrict SELECT to reporter/assignee/admin of related bug
DROP POLICY IF EXISTS "Attachments viewable by authenticated" ON public.attachments;
CREATE POLICY "Attachments viewable by bug stakeholders or admin"
ON public.attachments
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.bugs b
    WHERE b.id = attachments.bug_id
      AND (b.reporter_id = auth.uid() OR b.assignee_id = auth.uid())
  )
);

-- 3) realtime.messages: scope subscriptions to user-owned or public-prefixed topics
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Realtime scoped by topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR position(auth.uid()::text in topic) > 0
  OR topic LIKE 'standings:%'
  OR topic LIKE 'matches:%'
);
