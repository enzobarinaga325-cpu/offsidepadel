
DROP POLICY IF EXISTS "Categories viewable by public" ON public.categories;
DROP POLICY IF EXISTS "Pairs viewable by public" ON public.pairs;

ALTER VIEW public.public_registrations SET (security_invoker = true);
ALTER VIEW public.profiles_public SET (security_invoker = true);
