CREATE OR REPLACE FUNCTION public.get_tournament_participants(_tournament_id uuid)
RETURNS TABLE(
  registration_id uuid,
  tournament_category_id uuid,
  pair_id uuid,
  player1_id uuid,
  player2_id uuid,
  player1_name text,
  player2_name text,
  player1_avatar text,
  player2_avatar text,
  display_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.tournament_category_id, p.id,
         p.player1_id, p.player2_id,
         pr1.full_name, pr2.full_name,
         pr1.avatar_url, pr2.avatar_url,
         p.display_name
  FROM public.registrations r
  JOIN public.pairs p ON p.id = r.pair_id
  LEFT JOIN public.profiles pr1 ON pr1.user_id = p.player1_id
  LEFT JOIN public.profiles pr2 ON pr2.user_id = p.player2_id
  WHERE r.tournament_id = _tournament_id AND r.status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION public.get_tournament_participants(uuid) TO anon, authenticated;