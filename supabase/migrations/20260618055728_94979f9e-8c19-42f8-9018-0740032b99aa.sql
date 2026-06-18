
-- 1. Add phone-auth columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS failed_pin_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_e164_unique
  ON public.profiles (phone_e164) WHERE phone_e164 IS NOT NULL;

-- 2. Phone normalization helper (digits only)
CREATE OR REPLACE FUNCTION public.normalize_phone(_phone text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(coalesce(_phone,''), '\D', '', 'g')
$$;

-- 3. Admin: enable/disable user
CREATE OR REPLACE FUNCTION public.admin_set_user_active(_user_id uuid, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Solo administradores';
  END IF;
  UPDATE public.profiles SET is_active = _active, updated_at = now()
   WHERE user_id = _user_id;
END $$;

-- 4. Admin: update user basic data (name/lastname/phone)
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  _user_id uuid, _first_name text, _last_name text, _phone text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone text := public.normalize_phone(_phone);
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Solo administradores';
  END IF;
  IF v_phone = '' THEN v_phone := NULL; END IF;
  IF v_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE phone_e164 = v_phone AND user_id <> _user_id
  ) THEN
    RAISE EXCEPTION 'El número de celular ya está registrado';
  END IF;
  UPDATE public.profiles SET
    first_name = COALESCE(NULLIF(_first_name,''), first_name),
    last_name  = COALESCE(NULLIF(_last_name,''), last_name),
    full_name  = NULLIF(trim(coalesce(_first_name,'') || ' ' || coalesce(_last_name,'')),''),
    phone      = COALESCE(v_phone, phone),
    phone_e164 = COALESCE(v_phone, phone_e164),
    updated_at = now()
  WHERE user_id = _user_id;
END $$;

-- 5. Login lockout helpers (used by edge function with service role)
CREATE OR REPLACE FUNCTION public.phone_login_precheck(_phone text)
RETURNS TABLE(user_id uuid, locked boolean, active boolean, lock_until timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id,
         (p.locked_until IS NOT NULL AND p.locked_until > now()) AS locked,
         p.is_active,
         p.locked_until
  FROM public.profiles p
  WHERE p.phone_e164 = public.normalize_phone(_phone)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.phone_login_register_failure(_phone text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_attempts int;
  v_lock timestamptz;
BEGIN
  UPDATE public.profiles
     SET failed_pin_attempts = failed_pin_attempts + 1
   WHERE phone_e164 = public.normalize_phone(_phone)
   RETURNING failed_pin_attempts INTO v_attempts;
  IF v_attempts IS NULL THEN RETURN NULL; END IF;
  IF v_attempts >= 5 THEN
    v_lock := now() + interval '5 minutes';
    UPDATE public.profiles
       SET locked_until = v_lock, failed_pin_attempts = 0
     WHERE phone_e164 = public.normalize_phone(_phone);
  END IF;
  RETURN v_lock;
END $$;

CREATE OR REPLACE FUNCTION public.phone_login_register_success(_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
     SET failed_pin_attempts = 0,
         locked_until = NULL,
         last_login_at = now()
   WHERE phone_e164 = public.normalize_phone(_phone);
END $$;

-- 6. Extend handle_new_user trigger to persist phone_e164 + category_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_first text := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last  text := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_phone_raw text := COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone);
  v_phone_n text := public.normalize_phone(v_phone_raw);
  v_cat uuid := NULLIF(NEW.raw_user_meta_data->>'category_id','')::uuid;
  v_full  text := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name',''),
    NULLIF(trim(v_first || ' ' || v_last),''),
    split_part(NEW.email, '@', 1)
  );
BEGIN
  INSERT INTO public.profiles (user_id, full_name, first_name, last_name, phone, phone_e164, category_id)
  VALUES (NEW.id, v_full, NULLIF(v_first,''), NULLIF(v_last,''),
          NULLIF(v_phone_raw,''), NULLIF(v_phone_n,''), v_cat)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name  = COALESCE(EXCLUDED.last_name,  public.profiles.last_name),
    phone      = COALESCE(EXCLUDED.phone,      public.profiles.phone),
    phone_e164 = COALESCE(EXCLUDED.phone_e164, public.profiles.phone_e164),
    category_id = COALESCE(EXCLUDED.category_id, public.profiles.category_id);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 7. Backfill phone_e164 from existing phone values
UPDATE public.profiles
   SET phone_e164 = public.normalize_phone(phone)
 WHERE phone IS NOT NULL AND phone_e164 IS NULL
   AND public.normalize_phone(phone) <> '';
