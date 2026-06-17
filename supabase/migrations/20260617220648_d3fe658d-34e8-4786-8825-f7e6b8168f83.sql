
-- Add first_name, last_name, phone to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text;

-- Backfill first/last from full_name where missing
UPDATE public.profiles
SET
  first_name = COALESCE(first_name, NULLIF(split_part(full_name, ' ', 1), '')),
  last_name  = COALESCE(last_name,  NULLIF(NULLIF(regexp_replace(full_name, '^\S+\s*', ''), ''), full_name))
WHERE first_name IS NULL OR last_name IS NULL;

-- Update handle_new_user to capture first_name, last_name, phone from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_first text := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last  text := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_phone text := COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone);
  v_full  text := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(trim(v_first || ' ' || v_last), ''),
    split_part(NEW.email, '@', 1)
  );
BEGIN
  INSERT INTO public.profiles (user_id, full_name, first_name, last_name, phone)
  VALUES (NEW.id, v_full, NULLIF(v_first,''), NULLIF(v_last,''), NULLIF(v_phone,''))
  ON CONFLICT (user_id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name  = COALESCE(EXCLUDED.last_name,  public.profiles.last_name),
    phone      = COALESCE(EXCLUDED.phone,      public.profiles.phone);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure profiles.user_id is unique for ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;
