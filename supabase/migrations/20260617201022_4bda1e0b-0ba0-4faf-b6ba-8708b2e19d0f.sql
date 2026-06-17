
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

INSERT INTO public.categories (name, level, gender, description)
SELECT v.name, v.level, v.gender::public.category_gender, v.description
FROM (VALUES
  ('8va Caballeros','8va','male','Categoría 8va caballeros'),
  ('7ma Caballeros','7ma','male','Categoría 7ma caballeros'),
  ('6ta Caballeros','6ta','male','Categoría 6ta caballeros'),
  ('5ta Caballeros','5ta','male','Categoría 5ta caballeros'),
  ('4ta Caballeros','4ta','male','Categoría 4ta caballeros'),
  ('Damas','damas','female','Categoría Damas'),
  ('Mixto','mixto','mixed','Categoría Mixto')
) AS v(name,level,gender,description)
WHERE NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.name = v.name);

CREATE OR REPLACE FUNCTION public.guard_profile_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
    IF public.has_role(auth.uid(),'admin') THEN
      RETURN NEW;
    END IF;
    IF OLD.category_id IS NOT NULL THEN
      RAISE EXCEPTION 'Solo el administrador puede modificar tu categoría';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_category ON public.profiles;
CREATE TRIGGER trg_guard_profile_category
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_category();

CREATE OR REPLACE FUNCTION public.admin_set_user_category(_user_id UUID, _category_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Solo administradores';
  END IF;
  UPDATE public.profiles SET category_id = _category_id, updated_at = now() WHERE user_id = _user_id;
END;
$$;

DO $$
BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;
END $$;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;
