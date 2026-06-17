
CREATE OR REPLACE FUNCTION public.finalize_tournament(_tournament_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t RECORD;
  champion_pts INT := 100;
  finalist_pts INT := 60;
  semi_pts INT := 35;
  quarter_pts INT := 20;
  part_pts INT := 10;
  final_m RECORD;
  sf_losers UUID[];
  qf_losers UUID[];
  champion UUID;
  finalist UUID;
  reg RECORD;
  pair_rec RECORD;
  cfg_row RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO t FROM public.tournaments WHERE id = _tournament_id;
  IF t IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;

  SELECT * INTO cfg_row FROM public.tournament_points_config
   WHERE tournament_id = _tournament_id ORDER BY created_at DESC LIMIT 1;
  IF cfg_row IS NULL THEN
    SELECT * INTO cfg_row FROM public.tournament_points_config WHERE category_id = t.category_id ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF cfg_row IS NOT NULL THEN
    champion_pts := cfg_row.champion_points;
    finalist_pts := cfg_row.finalist_points;
    semi_pts := cfg_row.semifinalist_points;
    quarter_pts := cfg_row.quarterfinalist_points;
    part_pts := cfg_row.participation_points;
  END IF;

  DELETE FROM public.ranking_points WHERE tournament_id = _tournament_id;

  FOR pair_rec IN
    SELECT DISTINCT u AS player_user, p.id AS pair_id
    FROM public.registrations r
    JOIN public.pairs p ON p.id = r.pair_id
    CROSS JOIN LATERAL unnest(ARRAY[p.player1_id, p.player2_id]) AS u
    WHERE r.tournament_id = _tournament_id AND r.status = 'approved' AND u IS NOT NULL
  LOOP
    INSERT INTO public.ranking_points(tournament_id, category_id, player_id, pair_id, position, points)
    VALUES (_tournament_id, t.category_id, pair_rec.player_user, pair_rec.pair_id, 99, part_pts)
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
    UPDATE public.ranking_points rp SET position=1, points=champion_pts
    FROM public.pairs p WHERE p.id=champion AND rp.tournament_id=_tournament_id
      AND rp.player_id IN (p.player1_id, p.player2_id);
  END IF;
  IF finalist IS NOT NULL THEN
    UPDATE public.ranking_points rp SET position=2, points=finalist_pts
    FROM public.pairs p WHERE p.id=finalist AND rp.tournament_id=_tournament_id
      AND rp.player_id IN (p.player1_id, p.player2_id);
  END IF;
  IF sf_losers IS NOT NULL THEN
    UPDATE public.ranking_points rp SET position=3, points=semi_pts
    FROM public.pairs p WHERE p.id = ANY(sf_losers) AND rp.tournament_id=_tournament_id
      AND rp.player_id IN (p.player1_id, p.player2_id);
  END IF;
  IF qf_losers IS NOT NULL THEN
    UPDATE public.ranking_points rp SET position=5, points=quarter_pts
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
