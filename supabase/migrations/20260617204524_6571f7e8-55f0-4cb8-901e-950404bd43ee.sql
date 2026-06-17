
-- 1) Players: restrict SELECT to authenticated users
DROP POLICY IF EXISTS "Players are viewable by everyone" ON public.players;
CREATE POLICY "Players are viewable by authenticated users"
  ON public.players FOR SELECT
  TO authenticated
  USING (true);

-- 2) Invitations: only admins can create
DROP POLICY IF EXISTS "Authenticated can create invitations" ON public.invitations;
CREATE POLICY "Admins can create invitations"
  ON public.invitations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = invited_by);

-- 3) Registrations: non-admins limited to status='pending'
DROP POLICY IF EXISTS "Authenticated users can register" ON public.registrations;
CREATE POLICY "Authenticated users can register"
  ON public.registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = registered_by
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        status = 'pending'
        AND EXISTS (
          SELECT 1 FROM public.pairs p
          WHERE p.id = pair_id
            AND (p.player1_id = auth.uid() OR p.player2_id = auth.uid() OR p.created_by = auth.uid())
        )
      )
    )
  );

-- 4) Bug attachments storage: tighten INSERT path + add UPDATE policy
DROP POLICY IF EXISTS "Authenticated can upload bug attachments" ON storage.objects;
CREATE POLICY "Authenticated can upload bug attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bug-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own bug attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'bug-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'bug-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5) Realtime: require authentication on realtime.messages
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);
