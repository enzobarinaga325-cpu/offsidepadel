-- Remove anonymous access to categories. Public registration form fetches
-- the list via the public-categories edge function (service role).
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
REVOKE SELECT ON public.categories FROM anon;