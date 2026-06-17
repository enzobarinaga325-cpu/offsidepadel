
-- Drop FK on ranking_points.player_id to players.id, change semantics: player_id is auth.users uuid
ALTER TABLE public.ranking_points DROP CONSTRAINT IF EXISTS ranking_points_player_id_fkey;

-- Replace notify_pair: pair.player1_id and player2_id ARE auth.users IDs
CREATE OR REPLACE FUNCTION public.notify_pair(_pair_id UUID, _type TEXT, _title TEXT, _body TEXT, _link TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID;
BEGIN
  FOR uid IN
    SELECT unnest(ARRAY[player1_id, player2_id]) FROM public.pairs WHERE id = _pair_id
  LOOP
    IF uid IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, type, title, body, link)
      VALUES (uid, _type, _title, _body, _link);
    END IF;
  END LOOP;
END; $$;

-- Replace finalize_tournament with correct user-id semantics
CREATE OR REPLACE FUNCTION public.finalize_tournament(_tournament_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t RECORD;
  cfg RECORD;
  final_m RECORD;
  sf_losers UUID[];
  qf_losers UUID[];
  champion UUID;
  finalist UUID;
  reg RECORD;
  pts_part INT;
  pair_rec RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO t FROM public.tournaments WHERE id = _tournament_id;
  IF t IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;

  SELECT * INTO cfg FROM public.tournament_points_config
   WHERE tournament_id = _tournament_id ORDER BY created_at DESC LIMIT 1;
  IF cfg IS NULL THEN
    SELECT * INTO cfg FROM public.tournament_points_config WHERE category_id = t.category_id ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF cfg IS NULL THEN
    cfg := ROW(NULL,NULL,NULL,NULL,100,60,35,20,10,now(),now());
  END IF;

  DELETE FROM public.ranking_points WHERE tournament_id = _tournament_id;
  pts_part := cfg.participation_points;

  -- Participation points for every approved player (user)
  FOR pair_rec IN
    SELECT DISTINCT u AS player_user, p.id AS pair_id
    FROM public.registrations r
    JOIN public.pairs p ON p.id = r.pair_id
    CROSS JOIN LATERAL unnest(ARRAY[p.player1_id, p.player2_id]) AS u
    WHERE r.tournament_id = _tournament_id AND r.status = 'approved' AND u IS NOT NULL
  LOOP
    INSERT INTO public.ranking_points(tournament_id, category_id, player_id, pair_id, position, points)
    VALUES (_tournament_id, t.category_id, pair_rec.player_user, pair_rec.pair_id, 99, pts_part)
    ON CONFLICT (tournament_id, player_id) DO NOTHING;
  END LOOP;

  SELECT * INTO final_m FROM public.matches
   WHERE tournament_id=_tournament_id AND round='final' AND status IN ('finished','walkover') LIMIT 1;
  IF final_m.id IS NOT NULL THEN
    champion := final_m.winner_pair_id;
    finalist := CASE WHEN final_m.winner_pair_id = final_m.pair_a_id THEN final_m.pair_b_id ELSE final_m.pair_a_id END;
  END IF;

  SELECT array_agg(CASE WHEN winner_pair_id=pair_a_id THEN pair_b_id ELSE pair_a_id END)
    INTO sf_losers
  FROM public.matches WHERE tournament_id=_tournament_id AND round='sf' AND status IN ('finished','walkover');

  SELECT array_agg(CASE WHEN winner_pair_id=pair_a_id THEN pair_b_id ELSE pair_a_id END)
    INTO qf_losers
  FROM public.matches WHERE tournament_id=_tournament_id AND round='qf' AND status IN ('finished','walkover');

  IF champion IS NOT NULL THEN
    UPDATE public.ranking_points rp SET position=1, points=cfg.champion_points
    FROM public.pairs p WHERE p.id=champion AND rp.tournament_id=_tournament_id
      AND rp.player_id IN (p.player1_id, p.player2_id);
  END IF;
  IF finalist IS NOT NULL THEN
    UPDATE public.ranking_points rp SET position=2, points=cfg.finalist_points
    FROM public.pairs p WHERE p.id=finalist AND rp.tournament_id=_tournament_id
      AND rp.player_id IN (p.player1_id, p.player2_id);
  END IF;
  IF sf_losers IS NOT NULL THEN
    UPDATE public.ranking_points rp SET position=3, points=cfg.semifinalist_points
    FROM public.pairs p WHERE p.id = ANY(sf_losers) AND rp.tournament_id=_tournament_id
      AND rp.player_id IN (p.player1_id, p.player2_id);
  END IF;
  IF qf_losers IS NOT NULL THEN
    UPDATE public.ranking_points rp SET position=5, points=cfg.quarterfinalist_points
    FROM public.pairs p WHERE p.id = ANY(qf_losers) AND rp.tournament_id=_tournament_id
      AND rp.player_id IN (p.player1_id, p.player2_id);
  END IF;

  UPDATE public.tournaments SET status='finished' WHERE id=_tournament_id;

  FOR reg IN SELECT pair_id FROM public.registrations WHERE tournament_id=_tournament_id AND status='approved' LOOP
    PERFORM public.notify_pair(reg.pair_id, 'tournament_finished','Torneo finalizado',
      'El torneo "'||t.name||'" ha finalizado. Ya podés ver tus puntos en el ranking.',
      '/tournaments/'||_tournament_id);
  END LOOP;
END; $$;

-- Get ranking by user
CREATE OR REPLACE FUNCTION public.get_ranking(_category_id UUID DEFAULT NULL, _from DATE DEFAULT NULL, _to DATE DEFAULT NULL)
RETURNS TABLE(player_id UUID, full_name TEXT, avatar_url TEXT, total_points BIGINT, tournaments_played BIGINT, wins BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    rp.player_id,
    COALESCE(pr.full_name, 'Jugador'),
    pr.avatar_url,
    SUM(rp.points)::BIGINT AS total_points,
    COUNT(DISTINCT rp.tournament_id)::BIGINT,
    COUNT(*) FILTER (WHERE rp.position = 1)::BIGINT
  FROM public.ranking_points rp
  LEFT JOIN public.profiles pr ON pr.user_id = rp.player_id
  WHERE (_category_id IS NULL OR rp.category_id = _category_id)
    AND (_from IS NULL OR rp.awarded_at::date >= _from)
    AND (_to IS NULL OR rp.awarded_at::date <= _to)
  GROUP BY rp.player_id, pr.full_name, pr.avatar_url
  ORDER BY total_points DESC;
$$;

-- Stats by user uuid
CREATE OR REPLACE FUNCTION public.get_player_stats(_player_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'tournaments_played', (SELECT COUNT(DISTINCT tournament_id) FROM public.ranking_points WHERE player_id=_player_id),
    'tournaments_won', (SELECT COUNT(*) FROM public.ranking_points WHERE player_id=_player_id AND position=1),
    'total_points', (SELECT COALESCE(SUM(points),0) FROM public.ranking_points WHERE player_id=_player_id),
    'matches_played', (
      SELECT COUNT(*) FROM public.matches m
      JOIN public.pairs p ON p.id IN (m.pair_a_id, m.pair_b_id)
      WHERE _player_id IN (p.player1_id, p.player2_id) AND m.status IN ('finished','walkover')
    ),
    'matches_won', (
      SELECT COUNT(*) FROM public.matches m
      JOIN public.pairs p ON p.id = m.winner_pair_id
      WHERE _player_id IN (p.player1_id, p.player2_id) AND m.status IN ('finished','walkover')
    )
  );
$$;
