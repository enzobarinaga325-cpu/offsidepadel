
CREATE POLICY "Authenticated can read tournament images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tournament-images');

CREATE POLICY "Admins can upload tournament images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tournament-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tournament images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tournament-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tournament images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tournament-images' AND public.has_role(auth.uid(), 'admin'));
