
-- ============ 1. New columns on registrations & tournament_categories ============
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS partner_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS approval_reason text,
  ADD COLUMN IF NOT EXISTS admin_comment text,
  ADD COLUMN IF NOT EXISTS level_diff integer;

-- backfill: existing approved regs are considered partner-confirmed
UPDATE public.registrations SET partner_confirmed = true WHERE status IN ('approved','rejected','waitlist');

-- Ensure all existing registrations have a tournament_category_id when possible
UPDATE public.registrations r
   SET tournament_category_id = tc.id
  FROM public.tournament_categories tc
 WHERE r.tournament_category_id IS NULL
   AND tc.tournament_id = r.tournament_id
   AND tc.id = (SELECT id FROM public.tournament_categories WHERE tournament_id = r.tournament_id ORDER BY position, created_at LIMIT 1);

-- ============ 2. Rewrite validation trigger: pending instead of error on category diff ============
CREATE OR REPLACE FUNCTION public.validate_registration_pair()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tc RECORD;
  p RECORD;
  cat1 RECORD;
  cat2 RECORD;
  lvl1 INTEGER;
  lvl2 INTEGER;
  lvl_tc INTEGER;
  total INTEGER;
  diff INTEGER := 0;
  reason TEXT := NULL;
BEGIN
  IF NEW.tournament_category_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO tc FROM public.tournament_categories WHERE id = NEW.tournament_category_id;
  IF tc IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO p FROM public.pairs WHERE id = NEW.pair_id;
  IF p IS NULL OR p.player1_id IS NULL OR p.player2_id IS NULL THEN
    RAISE EXCEPTION 'La pareja debe tener dos jugadores con cuenta';
  END IF;

  SELECT c.* INTO cat1
    FROM public.profiles pr
    LEFT JOIN public.categories c ON c.id = pr.category_id
   WHERE pr.user_id = p.player1_id;
  SELECT c.* INTO cat2
    FROM public.profiles pr
    LEFT JOIN public.categories c ON c.id = pr.category_id
   WHERE pr.user_id = p.player2_id;

  IF cat1.id IS NULL OR cat2.id IS NULL THEN
    RAISE EXCEPTION 'Ambos jugadores deben tener una categoría asignada en su perfil';
  END IF;

  -- Gender check (still strict)
  IF tc.gender = 'mens' THEN
    IF cat1.gender <> 'male' OR cat2.gender <> 'male' THEN
      RAISE EXCEPTION 'Esta categoría es de Caballeros: ambos jugadores deben ser hombres';
    END IF;
  ELSIF tc.gender = 'womens' THEN
    IF cat1.gender <> 'female' OR cat2.gender <> 'female' THEN
      RAISE EXCEPTION 'Esta categoría es de Damas: ambas jugadoras deben ser mujeres';
    END IF;
  ELSIF tc.gender = 'mixed' THEN
    IF NOT ((cat1.gender = 'male' AND cat2.gender = 'female')
         OR (cat1.gender = 'female' AND cat2.gender = 'male')) THEN
      RAISE EXCEPTION 'Esta categoría es Mixta: la pareja debe ser un hombre y una mujer';
    END IF;
  END IF;

  IF tc.mode = 'suma' THEN
    IF tc.suma_value IS NULL THEN
      RAISE EXCEPTION 'La categoría Suma no tiene valor configurado';
    END IF;
    lvl1 := public.category_level_int(cat1.level);
    lvl2 := public.category_level_int(cat2.level);
    IF lvl1 IS NULL OR lvl2 IS NULL THEN
      RAISE EXCEPTION 'No se pudo determinar el nivel de uno de los jugadores';
    END IF;
    total := lvl1 + lvl2;
    IF total <> tc.suma_value THEN
      RAISE EXCEPTION 'La suma de categorías (% + % = %) no coincide con Suma % de esta categoría',
        lvl1, lvl2, total, tc.suma_value;
    END IF;
  ELSIF tc.mode = 'normal' AND tc.category_id IS NOT NULL THEN
    -- Same-category = ok. Higher category (lower number) of either player = pending review.
    -- Lower category (higher number) than tournament category = reject? We treat it as pending too with reason.
    IF cat1.id <> tc.category_id OR cat2.id <> tc.category_id THEN
      lvl_tc := public.category_level_int((SELECT level FROM public.categories WHERE id = tc.category_id));
      lvl1 := public.category_level_int(cat1.level);
      lvl2 := public.category_level_int(cat2.level);
      IF lvl_tc IS NOT NULL AND lvl1 IS NOT NULL AND lvl2 IS NOT NULL THEN
        diff := GREATEST(COALESCE(lvl_tc - lvl1, 0), COALESCE(lvl_tc - lvl2, 0));
      END IF;
      reason := format('Diferencia de categoría: %s (%s) / %s (%s) vs torneo %s',
        COALESCE(cat1.name,'?'), COALESCE(cat1.level,'?'),
        COALESCE(cat2.name,'?'), COALESCE(cat2.level,'?'),
        (SELECT name FROM public.categories WHERE id = tc.category_id));
      IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
        -- Only admins can insert approved directly; leave as approved
        NULL;
      ELSE
        NEW.status := 'pending';
        NEW.approval_reason := reason;
        NEW.level_diff := diff;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_registration_pair ON public.registrations;
CREATE TRIGGER trg_validate_registration_pair
BEFORE INSERT OR UPDATE OF tournament_category_id, pair_id
ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.validate_registration_pair();

-- ============ 3. notify_admins helper ============
CREATE OR REPLACE FUNCTION public.notify_admins(_type text, _title text, _body text, _link text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid;
BEGIN
  FOR uid IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (uid, _type, _title, _body, _link);
  END LOOP;
END $$;

-- ============ 4. search_players RPC ============
CREATE OR REPLACE FUNCTION public.search_players(_q text)
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, category_name text, category_level text, category_gender text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url,
         c.name, c.level, c.gender::text
    FROM public.profiles p
    LEFT JOIN public.categories c ON c.id = p.category_id
   WHERE auth.uid() IS NOT NULL
     AND p.is_active = true
     AND (
       coalesce(_q,'') = ''
       OR p.full_name ILIKE '%'||_q||'%'
       OR p.first_name ILIKE '%'||_q||'%'
       OR p.last_name ILIKE '%'||_q||'%'
       OR p.phone_e164 ILIKE '%'||public.normalize_phone(_q)||'%'
     )
   ORDER BY p.full_name
   LIMIT 30;
$$;

GRANT EXECUTE ON FUNCTION public.search_players(text) TO authenticated;

-- ============ 5. request_pair_registration ============
CREATE OR REPLACE FUNCTION public.request_pair_registration(_tournament_category_id uuid, _partner_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  tc RECORD;
  approved_cnt int;
  new_pair uuid;
  new_reg uuid;
  partner_name text;
  inviter_name text;
  tname text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Debés iniciar sesión'; END IF;
  IF _partner_user_id IS NULL OR _partner_user_id = uid THEN
    RAISE EXCEPTION 'Elegí un compañero válido';
  END IF;
  SELECT * INTO tc FROM public.tournament_categories WHERE id = _tournament_category_id;
  IF tc IS NULL THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  IF tc.registration_open = false OR tc.status <> 'open' THEN
    RAISE EXCEPTION 'Las inscripciones a esta categoría están cerradas';
  END IF;
  -- Cupo check (counts approved only)
  SELECT count(*) INTO approved_cnt FROM public.registrations
    WHERE tournament_category_id = _tournament_category_id AND status = 'approved';
  IF approved_cnt >= tc.max_pairs THEN
    RAISE EXCEPTION 'Cupos completos. Solo el administrador puede inscribir más parejas.';
  END IF;
  -- Prevent duplicate user registration in this category
  IF EXISTS (
    SELECT 1 FROM public.registrations r
    JOIN public.pairs pp ON pp.id = r.pair_id
    WHERE r.tournament_category_id = _tournament_category_id
      AND r.status IN ('pending','approved','waitlist')
      AND (uid IN (pp.player1_id, pp.player2_id) OR _partner_user_id IN (pp.player1_id, pp.player2_id))
  ) THEN
    RAISE EXCEPTION 'Uno de los jugadores ya está inscripto en esta categoría';
  END IF;

  INSERT INTO public.pairs(tournament_id, player1_id, player2_id, created_by)
  VALUES (tc.tournament_id, uid, _partner_user_id, uid)
  RETURNING id INTO new_pair;

  INSERT INTO public.registrations(tournament_id, tournament_category_id, pair_id, status, registered_by, invited_by, partner_confirmed)
  VALUES (tc.tournament_id, _tournament_category_id, new_pair, 'pending', uid, uid, false)
  RETURNING id INTO new_reg;

  SELECT full_name INTO partner_name FROM public.profiles WHERE user_id = _partner_user_id;
  SELECT full_name INTO inviter_name FROM public.profiles WHERE user_id = uid;
  SELECT name INTO tname FROM public.tournaments WHERE id = tc.tournament_id;

  -- Notify partner
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (_partner_user_id, 'pair_invitation',
    'Invitación a inscripción',
    coalesce(inviter_name,'Un jugador')||' te invita a jugar "'||tname||'". Aceptá la invitación desde tu perfil.',
    '/my-invitations');

  -- If pending requires admin review (level_diff set by trigger), notify admins
  IF (SELECT approval_reason FROM public.registrations WHERE id = new_reg) IS NOT NULL THEN
    PERFORM public.notify_admins('registration_review',
      'Inscripción requiere aprobación',
      coalesce(inviter_name,'Jugador')||' + '||coalesce(partner_name,'Jugador')||' — '||tname,
      '/admin/tournaments/'||tc.tournament_id||'/manage');
  END IF;

  RETURN new_reg;
END $$;

GRANT EXECUTE ON FUNCTION public.request_pair_registration(uuid, uuid) TO authenticated;

-- ============ 6. confirm_partner ============
CREATE OR REPLACE FUNCTION public.confirm_partner(_registration_id uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  r RECORD;
  pr RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Debés iniciar sesión'; END IF;
  SELECT * INTO r FROM public.registrations WHERE id = _registration_id;
  IF r IS NULL THEN RAISE EXCEPTION 'Inscripción no encontrada'; END IF;
  SELECT * INTO pr FROM public.pairs WHERE id = r.pair_id;
  IF uid NOT IN (pr.player1_id, pr.player2_id) OR uid = r.invited_by THEN
    RAISE EXCEPTION 'No podés confirmar esta invitación';
  END IF;
  IF _accept THEN
    UPDATE public.registrations SET partner_confirmed = true WHERE id = _registration_id;
  ELSE
    UPDATE public.registrations SET status = 'rejected', partner_confirmed = false,
      admin_comment = 'Compañero rechazó la invitación', reviewed_at = now()
      WHERE id = _registration_id;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.confirm_partner(uuid, boolean) TO authenticated;

-- ============ 7. admin approve/reject ============
CREATE OR REPLACE FUNCTION public.admin_review_registration(_registration_id uuid, _approve boolean, _comment text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(uid,'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  UPDATE public.registrations
     SET status = CASE WHEN _approve THEN 'approved'::public.registration_status ELSE 'rejected'::public.registration_status END,
         admin_comment = NULLIF(_comment,''),
         reviewed_at = now(),
         reviewed_by = uid,
         partner_confirmed = CASE WHEN _approve THEN true ELSE partner_confirmed END
   WHERE id = _registration_id;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_review_registration(uuid, boolean, text) TO authenticated;

-- ============ 8. admin_create_registration (bypass cupo + invitation) ============
CREATE OR REPLACE FUNCTION public.admin_create_registration(_tournament_category_id uuid, _player1 uuid, _player2 uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  tc RECORD;
  new_pair uuid;
  new_reg uuid;
BEGIN
  IF NOT public.has_role(uid,'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF _player1 IS NULL OR _player2 IS NULL OR _player1 = _player2 THEN
    RAISE EXCEPTION 'Elegí dos jugadores distintos';
  END IF;
  SELECT * INTO tc FROM public.tournament_categories WHERE id = _tournament_category_id;
  IF tc IS NULL THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.registrations r
    JOIN public.pairs pp ON pp.id = r.pair_id
    WHERE r.tournament_category_id = _tournament_category_id
      AND r.status IN ('pending','approved','waitlist')
      AND (_player1 IN (pp.player1_id, pp.player2_id) OR _player2 IN (pp.player1_id, pp.player2_id))
  ) THEN
    RAISE EXCEPTION 'Uno de los jugadores ya está inscripto en esta categoría';
  END IF;

  INSERT INTO public.pairs(tournament_id, player1_id, player2_id, created_by)
  VALUES (tc.tournament_id, _player1, _player2, uid)
  RETURNING id INTO new_pair;

  INSERT INTO public.registrations(tournament_id, tournament_category_id, pair_id, status, registered_by, invited_by, partner_confirmed, reviewed_by, reviewed_at)
  VALUES (tc.tournament_id, _tournament_category_id, new_pair, 'approved', uid, uid, true, uid, now())
  RETURNING id INTO new_reg;

  RETURN new_reg;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_create_registration(uuid, uuid, uuid) TO authenticated;

-- ============ 9. admin_move_registration_category ============
CREATE OR REPLACE FUNCTION public.admin_move_registration(_registration_id uuid, _new_tournament_category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  r RECORD;
  new_tc RECORD;
BEGIN
  IF NOT public.has_role(uid,'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  SELECT * INTO r FROM public.registrations WHERE id = _registration_id;
  IF r IS NULL THEN RAISE EXCEPTION 'Inscripción no encontrada'; END IF;
  SELECT * INTO new_tc FROM public.tournament_categories WHERE id = _new_tournament_category_id;
  IF new_tc IS NULL OR new_tc.tournament_id <> r.tournament_id THEN
    RAISE EXCEPTION 'La categoría destino debe pertenecer al mismo torneo';
  END IF;
  UPDATE public.registrations SET tournament_category_id = _new_tournament_category_id WHERE id = _registration_id;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_move_registration(uuid, uuid) TO authenticated;
