DROP POLICY IF EXISTS "Realtime scoped by topic" ON realtime.messages;

CREATE POLICY "Realtime scoped by topic" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR realtime.topic() = ('user:' || auth.uid()::text)
  );