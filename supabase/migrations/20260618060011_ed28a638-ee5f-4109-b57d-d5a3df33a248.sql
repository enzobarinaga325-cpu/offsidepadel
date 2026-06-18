
GRANT SELECT ON public.categories TO anon;
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
CREATE POLICY "Anyone can view active categories"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (true);
