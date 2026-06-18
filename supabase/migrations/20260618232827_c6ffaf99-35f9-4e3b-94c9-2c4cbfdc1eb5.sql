-- Add availability field to registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS availability TEXT;

-- Update user-driven registration RPC: include availability, always pending, mark partner_confirmed true (request goes directly to admin queue)
CREATE OR REPLACE FUNCTION public.request_pair_registration(
  _tournament_category_id uuid,
  _partner_user_id uuid,
  _availability text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  tc RECORD;
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

  -- All user submissions go straight to the admin "Inscripciones" queue as pending.
  INSERT INTO public.registrations(
    tournament_id, tournament_category_id, pair_id, status,
    registered_by, invited_by, partner_confirmed, availability
  )
  VALUES (
    tc.tournament_id, _tournament_category_id, new_pair, 'pending',
    uid, uid, true, NULLIF(btrim(coalesce(_availability,'')), '')
  )
  RETURNING id INTO new_reg;

  -- The validate_registration_pair trigger may force pending and set approval_reason
  -- (we never auto-approve user requests, regardless).
  UPDATE public.registrations SET status = 'pending' WHERE id = new_reg AND status <> 'pending';

  SELECT full_name INTO partner_name FROM public.profiles WHERE user_id = _partner_user_id;
  SELECT full_name INTO inviter_name FROM public.profiles WHERE user_id = uid;
  SELECT name INTO tname FROM public.tournaments WHERE id = tc.tournament_id;

  -- Notify the partner (informational, no acceptance required)
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (_partner_user_id, 'pair_invitation',
    'Te inscribieron en una pareja',
    coalesce(inviter_name,'Un jugador')||' te inscribió como compañero/a en "'||tname||'". Pendiente de aprobación.',
    '/tournaments/'||tc.tournament_id);

  PERFORM public.notify_admins('registration_review',
    'Nueva inscripción pendiente',
    coalesce(inviter_name,'Jugador')||' + '||coalesce(partner_name,'Jugador')||' — '||tname,
    '/admin/registrations/'||tc.tournament_id);

  RETURN new_reg;
END $function$;