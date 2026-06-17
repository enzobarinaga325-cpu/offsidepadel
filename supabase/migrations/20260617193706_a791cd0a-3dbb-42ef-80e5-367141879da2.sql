
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.match_round AS ENUM ('groups','r64','r32','r16','qf','sf','final','third_place');
CREATE TYPE public.match_status AS ENUM ('scheduled','in_progress','finished','walkover','cancelled');

-- =========================================================================
-- TABLE: tournament_groups
-- =========================================================================
CREATE TABLE public.tournament_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournament_groups TO anon, authenticated;
GRANT ALL ON public.tournament_groups TO authenticated, service_role;
ALTER TABLE public.tournament_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Groups public read" ON public.tournament_groups FOR SELECT USING (true);
CREATE POLICY "Admins manage groups" ON public.tournament_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_tg_updated BEFORE UPDATE ON public.tournament_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- TABLE: matches
-- =========================================================================
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.tournament_groups(id) ON DELETE CASCADE,
  round public.match_round NOT NULL,
  bracket_position INT NOT NULL DEFAULT 0,
  pair_a_id UUID REFERENCES public.pairs(id) ON DELETE SET NULL,
  pair_b_id UUID REFERENCES public.pairs(id) ON DELETE SET NULL,
  winner_pair_id UUID REFERENCES public.pairs(id) ON DELETE SET NULL,
  score JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.match_status NOT NULL DEFAULT 'scheduled',
  court TEXT,
  scheduled_at TIMESTAMPTZ,
  next_match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  next_match_slot CHAR(1) CHECK (next_match_slot IN ('A','B')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX matches_tournament_idx ON public.matches(tournament_id);
CREATE INDEX matches_group_idx ON public.matches(group_id);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO authenticated, service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches public read" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Admins manage matches" ON public.matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_matches_updated BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- TABLE: standings (cached per group)
-- =========================================================================
CREATE TABLE public.standings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.tournament_groups(id) ON DELETE CASCADE,
  pair_id UUID NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  played INT NOT NULL DEFAULT 0,
  won INT NOT NULL DEFAULT 0,
  lost INT NOT NULL DEFAULT 0,
  sets_for INT NOT NULL DEFAULT 0,
  sets_against INT NOT NULL DEFAULT 0,
  games_for INT NOT NULL DEFAULT 0,
  games_against INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, pair_id)
);
GRANT SELECT ON public.standings TO anon, authenticated;
GRANT ALL ON public.standings TO authenticated, service_role;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Standings public read" ON public.standings FOR SELECT USING (true);
CREATE POLICY "Admins manage standings" ON public.standings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_standings_updated BEFORE UPDATE ON public.standings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- TABLE: ranking_points
-- =========================================================================
CREATE TABLE public.ranking_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  pair_id UUID REFERENCES public.pairs(id) ON DELETE SET NULL,
  position INT NOT NULL,
  points INT NOT NULL DEFAULT 0,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, player_id)
);
CREATE INDEX ranking_points_player_idx ON public.ranking_points(player_id);
CREATE INDEX ranking_points_category_idx ON public.ranking_points(category_id);
GRANT SELECT ON public.ranking_points TO anon, authenticated;
GRANT ALL ON public.ranking_points TO authenticated, service_role;
ALTER TABLE public.ranking_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ranking public read" ON public.ranking_points FOR SELECT USING (true);
CREATE POLICY "Admins manage ranking" ON public.ranking_points FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_rp_updated BEFORE UPDATE ON public.ranking_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- TABLE: notifications
-- =========================================================================
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own notifications delete" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- Helper: notify users of a pair
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_pair(_pair_id UUID, _type TEXT, _title TEXT, _body TEXT, _link TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID;
BEGIN
  FOR uid IN
    SELECT p.user_id FROM public.pairs pr
    JOIN public.players p ON p.id IN (pr.player1_id, pr.player2_id)
    WHERE pr.id = _pair_id AND p.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (uid, _type, _title, _body, _link);
  END LOOP;
END; $$;

-- =========================================================================
-- Trigger: notify on registration creation and status change
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_registration_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tname TEXT;
BEGIN
  SELECT name INTO tname FROM public.tournaments WHERE id = NEW.tournament_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_pair(NEW.pair_id, 'registration_created',
      'Inscripción recibida',
      'Tu inscripción a "'||tname||'" fue recibida y está pendiente de aprobación.',
      '/tournaments/'||NEW.tournament_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    PERFORM public.notify_pair(NEW.pair_id, 'registration_'||NEW.status::text,
      CASE NEW.status::text
        WHEN 'approved' THEN 'Inscripción aprobada'
        WHEN 'rejected' THEN 'Inscripción rechazada'
        WHEN 'waitlist' THEN 'En lista de espera'
        ELSE 'Estado de inscripción actualizado'
      END,
      'Torneo "'||tname||'".',
      '/tournaments/'||NEW.tournament_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_registration_notify
AFTER INSERT OR UPDATE OF status ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.tg_registration_notify();

-- =========================================================================
-- Trigger: notify on match schedule/court change and result
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_match_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tname TEXT;
BEGIN
  SELECT name INTO tname FROM public.tournaments WHERE id = NEW.tournament_id;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at OR NEW.court IS DISTINCT FROM OLD.court THEN
      IF NEW.pair_a_id IS NOT NULL THEN
        PERFORM public.notify_pair(NEW.pair_a_id,'match_scheduled','Horario/cancha actualizado',
          'Tu partido en "'||tname||'" tiene nuevo horario o cancha.',
          '/tournaments/'||NEW.tournament_id);
      END IF;
      IF NEW.pair_b_id IS NOT NULL THEN
        PERFORM public.notify_pair(NEW.pair_b_id,'match_scheduled','Horario/cancha actualizado',
          'Tu partido en "'||tname||'" tiene nuevo horario o cancha.',
          '/tournaments/'||NEW.tournament_id);
      END IF;
    END IF;
    IF NEW.status IN ('finished','walkover') AND OLD.status NOT IN ('finished','walkover') THEN
      IF NEW.pair_a_id IS NOT NULL THEN
        PERFORM public.notify_pair(NEW.pair_a_id,'match_result','Resultado cargado',
          'Se cargó el resultado de tu partido en "'||tname||'".',
          '/tournaments/'||NEW.tournament_id);
      END IF;
      IF NEW.pair_b_id IS NOT NULL THEN
        PERFORM public.notify_pair(NEW.pair_b_id,'match_result','Resultado cargado',
          'Se cargó el resultado de tu partido en "'||tname||'".',
          '/tournaments/'||NEW.tournament_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_match_notify
AFTER UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.tg_match_notify();

-- =========================================================================
-- FUNCTION: generate_fixture
-- =========================================================================
CREATE OR REPLACE FUNCTION public.generate_fixture(_tournament_id UUID, _groups_count INT DEFAULT 4)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t RECORD;
  pair_ids UUID[];
  n INT;
  bracket_size INT;
  i INT;
  j INT;
  m_id UUID;
  prev_round_ids UUID[];
  curr_round_ids UUID[];
  round_label public.match_round;
  rounds_needed INT;
  group_rec RECORD;
  grp_id UUID;
  grp_pairs UUID[];
  remainder INT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only admins can generate fixtures';
  END IF;

  SELECT * INTO t FROM public.tournaments WHERE id = _tournament_id;
  IF t IS NULL THEN RAISE EXCEPTION 'Tournament not found'; END IF;

  -- Clear previous fixture
  DELETE FROM public.matches WHERE tournament_id = _tournament_id;
  DELETE FROM public.standings WHERE group_id IN (SELECT id FROM public.tournament_groups WHERE tournament_id=_tournament_id);
  DELETE FROM public.tournament_groups WHERE tournament_id = _tournament_id;

  SELECT array_agg(r.pair_id ORDER BY r.registered_at)
    INTO pair_ids
  FROM public.registrations r
  WHERE r.tournament_id = _tournament_id AND r.status = 'approved';

  IF pair_ids IS NULL OR array_length(pair_ids,1) < 2 THEN
    RAISE EXCEPTION 'Necesitas al menos 2 parejas aprobadas';
  END IF;

  n := array_length(pair_ids,1);

  -- ROUND ROBIN
  IF t.tournament_type = 'round_robin' THEN
    INSERT INTO public.tournament_groups(tournament_id, name, position)
      VALUES (_tournament_id, 'Round Robin', 0) RETURNING id INTO grp_id;
    FOR i IN 1..n LOOP
      FOR j IN (i+1)..n LOOP
        INSERT INTO public.matches(tournament_id, group_id, round, bracket_position, pair_a_id, pair_b_id)
        VALUES (_tournament_id, grp_id, 'groups', (i*100+j), pair_ids[i], pair_ids[j]);
      END LOOP;
      INSERT INTO public.standings(group_id, pair_id) VALUES (grp_id, pair_ids[i]);
    END LOOP;
  ELSIF t.tournament_type = 'groups_elimination' THEN
    -- Create groups round-robin then bracket from 1st/2nd
    IF _groups_count < 2 THEN _groups_count := 2; END IF;
    IF n < _groups_count*2 THEN _groups_count := GREATEST(2, n/2); END IF;
    FOR i IN 1.._groups_count LOOP
      INSERT INTO public.tournament_groups(tournament_id, name, position)
        VALUES (_tournament_id, 'Grupo '||chr(64+i), i) RETURNING id INTO grp_id;
      grp_pairs := ARRAY[]::UUID[];
      FOR j IN 0..(n-1) LOOP
        IF (j % _groups_count) + 1 = i THEN
          grp_pairs := grp_pairs || pair_ids[j+1];
        END IF;
      END LOOP;
      FOR i IN 1..array_length(grp_pairs,1) LOOP
        INSERT INTO public.standings(group_id, pair_id) VALUES (grp_id, grp_pairs[i]);
      END LOOP;
      FOR i IN 1..array_length(grp_pairs,1) LOOP
        FOR j IN (i+1)..array_length(grp_pairs,1) LOOP
          INSERT INTO public.matches(tournament_id, group_id, round, bracket_position, pair_a_id, pair_b_id)
          VALUES (_tournament_id, grp_id, 'groups', (i*100+j), grp_pairs[i], grp_pairs[j]);
        END LOOP;
      END LOOP;
    END LOOP;
    -- Bracket placeholders for top 2 of each group
    bracket_size := 1;
    WHILE bracket_size < _groups_count*2 LOOP bracket_size := bracket_size*2; END LOOP;
    rounds_needed := ceil(log(2, bracket_size))::INT;
    prev_round_ids := ARRAY[]::UUID[];
    FOR i IN 1..rounds_needed LOOP
      curr_round_ids := ARRAY[]::UUID[];
      round_label := CASE rounds_needed - i + 1
        WHEN 1 THEN 'final'::public.match_round
        WHEN 2 THEN 'sf'::public.match_round
        WHEN 3 THEN 'qf'::public.match_round
        WHEN 4 THEN 'r16'::public.match_round
        WHEN 5 THEN 'r32'::public.match_round
        ELSE 'r64'::public.match_round END;
      FOR j IN 1..(bracket_size / (2^i)::INT) LOOP
        INSERT INTO public.matches(tournament_id, round, bracket_position)
        VALUES (_tournament_id, round_label, j) RETURNING id INTO m_id;
        curr_round_ids := curr_round_ids || m_id;
      END LOOP;
      IF array_length(prev_round_ids,1) IS NOT NULL THEN
        FOR j IN 1..array_length(prev_round_ids,1) LOOP
          UPDATE public.matches
          SET next_match_id = curr_round_ids[((j-1)/2)+1],
              next_match_slot = CASE WHEN (j-1)%2=0 THEN 'A' ELSE 'B' END
          WHERE id = prev_round_ids[j];
        END LOOP;
      END IF;
      prev_round_ids := curr_round_ids;
    END LOOP;
  ELSE
    -- Pure elimination
    bracket_size := 1;
    WHILE bracket_size < n LOOP bracket_size := bracket_size*2; END LOOP;
    rounds_needed := ceil(log(2, bracket_size))::INT;
    prev_round_ids := ARRAY[]::UUID[];
    FOR i IN 1..rounds_needed LOOP
      curr_round_ids := ARRAY[]::UUID[];
      round_label := CASE rounds_needed - i + 1
        WHEN 1 THEN 'final'::public.match_round
        WHEN 2 THEN 'sf'::public.match_round
        WHEN 3 THEN 'qf'::public.match_round
        WHEN 4 THEN 'r16'::public.match_round
        WHEN 5 THEN 'r32'::public.match_round
        ELSE 'r64'::public.match_round END;
      FOR j IN 1..(bracket_size / (2^i)::INT) LOOP
        IF i = 1 THEN
          INSERT INTO public.matches(tournament_id, round, bracket_position,
            pair_a_id, pair_b_id,
            status, winner_pair_id)
          VALUES (
            _tournament_id, round_label, j,
            CASE WHEN ((j-1)*2+1) <= n THEN pair_ids[(j-1)*2+1] ELSE NULL END,
            CASE WHEN ((j-1)*2+2) <= n THEN pair_ids[(j-1)*2+2] ELSE NULL END,
            CASE WHEN ((j-1)*2+2) > n AND ((j-1)*2+1) <= n THEN 'walkover'::public.match_status ELSE 'scheduled'::public.match_status END,
            CASE WHEN ((j-1)*2+2) > n AND ((j-1)*2+1) <= n THEN pair_ids[(j-1)*2+1] ELSE NULL END
          ) RETURNING id INTO m_id;
        ELSE
          INSERT INTO public.matches(tournament_id, round, bracket_position)
          VALUES (_tournament_id, round_label, j) RETURNING id INTO m_id;
        END IF;
        curr_round_ids := curr_round_ids || m_id;
      END LOOP;
      IF array_length(prev_round_ids,1) IS NOT NULL THEN
        FOR j IN 1..array_length(prev_round_ids,1) LOOP
          UPDATE public.matches
          SET next_match_id = curr_round_ids[((j-1)/2)+1],
              next_match_slot = CASE WHEN (j-1)%2=0 THEN 'A' ELSE 'B' END
          WHERE id = prev_round_ids[j];
        END LOOP;
        -- Auto-advance walkover winners
        FOR j IN 1..array_length(prev_round_ids,1) LOOP
          UPDATE public.matches dst
          SET pair_a_id = CASE WHEN src.next_match_slot='A' THEN src.winner_pair_id ELSE dst.pair_a_id END,
              pair_b_id = CASE WHEN src.next_match_slot='B' THEN src.winner_pair_id ELSE dst.pair_b_id END
          FROM public.matches src
          WHERE src.id = prev_round_ids[j] AND src.winner_pair_id IS NOT NULL AND dst.id = src.next_match_id;
        END LOOP;
      END IF;
      prev_round_ids := curr_round_ids;
    END LOOP;
  END IF;

  UPDATE public.tournaments SET status = 'in_progress' WHERE id = _tournament_id AND status IN ('upcoming','open','full');

  -- Notify approved pairs
  FOR i IN 1..n LOOP
    PERFORM public.notify_pair(pair_ids[i], 'fixture_published','Fixture publicado',
      'Ya podés ver el fixture del torneo "'||t.name||'".', '/tournaments/'||_tournament_id);
  END LOOP;

  RETURN jsonb_build_object('matches', (SELECT count(*) FROM public.matches WHERE tournament_id=_tournament_id));
END; $$;

-- =========================================================================
-- FUNCTION: recompute_standings_for_group
-- =========================================================================
CREATE OR REPLACE FUNCTION public.recompute_standings(_group_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m RECORD;
  set_rec JSONB;
  a_games INT; b_games INT;
  a_sets INT; b_sets INT;
BEGIN
  UPDATE public.standings SET played=0,won=0,lost=0,sets_for=0,sets_against=0,games_for=0,games_against=0,points=0
    WHERE group_id = _group_id;

  FOR m IN SELECT * FROM public.matches WHERE group_id = _group_id AND status IN ('finished','walkover') LOOP
    a_sets := 0; b_sets := 0; a_games := 0; b_games := 0;
    IF jsonb_typeof(m.score) = 'array' THEN
      FOR set_rec IN SELECT * FROM jsonb_array_elements(m.score) LOOP
        a_games := a_games + COALESCE((set_rec->>'a')::INT,0);
        b_games := b_games + COALESCE((set_rec->>'b')::INT,0);
        IF COALESCE((set_rec->>'a')::INT,0) > COALESCE((set_rec->>'b')::INT,0) THEN a_sets := a_sets+1;
        ELSIF COALESCE((set_rec->>'b')::INT,0) > COALESCE((set_rec->>'a')::INT,0) THEN b_sets := b_sets+1; END IF;
      END LOOP;
    END IF;

    UPDATE public.standings SET
      played = played+1,
      won = won + CASE WHEN m.winner_pair_id = pair_id THEN 1 ELSE 0 END,
      lost = lost + CASE WHEN m.winner_pair_id IS NOT NULL AND m.winner_pair_id <> pair_id THEN 1 ELSE 0 END,
      sets_for = sets_for + CASE WHEN pair_id = m.pair_a_id THEN a_sets ELSE b_sets END,
      sets_against = sets_against + CASE WHEN pair_id = m.pair_a_id THEN b_sets ELSE a_sets END,
      games_for = games_for + CASE WHEN pair_id = m.pair_a_id THEN a_games ELSE b_games END,
      games_against = games_against + CASE WHEN pair_id = m.pair_a_id THEN b_games ELSE a_games END,
      points = points + CASE WHEN m.winner_pair_id = pair_id THEN 3 ELSE 0 END
    WHERE group_id = _group_id AND pair_id IN (m.pair_a_id, m.pair_b_id);
  END LOOP;
END; $$;

-- =========================================================================
-- FUNCTION: submit_match_result
-- =========================================================================
CREATE OR REPLACE FUNCTION public.submit_match_result(_match_id UUID, _sets JSONB, _walkover_winner UUID DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m RECORD;
  set_rec JSONB;
  a_sets INT := 0; b_sets INT := 0;
  winner UUID;
  new_status public.match_status;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only admins can submit results';
  END IF;
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;

  IF _walkover_winner IS NOT NULL THEN
    winner := _walkover_winner;
    new_status := 'walkover';
    _sets := COALESCE(_sets, '[]'::jsonb);
  ELSE
    IF jsonb_typeof(_sets) <> 'array' OR jsonb_array_length(_sets) = 0 THEN
      RAISE EXCEPTION 'Sets inválidos';
    END IF;
    FOR set_rec IN SELECT * FROM jsonb_array_elements(_sets) LOOP
      IF COALESCE((set_rec->>'a')::INT,-1) < 0 OR COALESCE((set_rec->>'b')::INT,-1) < 0 THEN
        RAISE EXCEPTION 'Games inválidos';
      END IF;
      IF (set_rec->>'a')::INT > (set_rec->>'b')::INT THEN a_sets := a_sets+1;
      ELSIF (set_rec->>'b')::INT > (set_rec->>'a')::INT THEN b_sets := b_sets+1; END IF;
    END LOOP;
    IF a_sets = b_sets THEN RAISE EXCEPTION 'No hay ganador definido'; END IF;
    winner := CASE WHEN a_sets > b_sets THEN m.pair_a_id ELSE m.pair_b_id END;
    new_status := 'finished';
  END IF;

  UPDATE public.matches SET score = _sets, winner_pair_id = winner, status = new_status WHERE id = _match_id;

  -- Recompute standings if group match
  IF m.group_id IS NOT NULL THEN
    PERFORM public.recompute_standings(m.group_id);
  END IF;

  -- Advance bracket
  IF m.next_match_id IS NOT NULL AND winner IS NOT NULL THEN
    IF m.next_match_slot = 'A' THEN
      UPDATE public.matches SET pair_a_id = winner WHERE id = m.next_match_id;
    ELSIF m.next_match_slot = 'B' THEN
      UPDATE public.matches SET pair_b_id = winner WHERE id = m.next_match_id;
    END IF;
  END IF;
END; $$;

-- =========================================================================
-- FUNCTION: finalize_tournament
-- =========================================================================
CREATE OR REPLACE FUNCTION public.finalize_tournament(_tournament_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t RECORD;
  cfg RECORD;
  final_m RECORD;
  third_m RECORD;
  sf_losers UUID[];
  qf_losers UUID[];
  champion UUID;
  finalist UUID;
  third UUID;
  fourth UUID;
  reg RECORD;
  pts_part INT;
  pair_rec RECORD;
  pos_player_pts JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO t FROM public.tournaments WHERE id = _tournament_id;
  IF t IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;

  -- Get points config (tournament-specific or category default)
  SELECT * INTO cfg FROM public.tournament_points_config
   WHERE tournament_id = _tournament_id
   ORDER BY created_at DESC LIMIT 1;
  IF cfg IS NULL THEN
    SELECT * INTO cfg FROM public.tournament_points_config WHERE category_id = t.category_id ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF cfg IS NULL THEN
    cfg := ROW(NULL,NULL,NULL,NULL,100,60,35,20,10,now(),now());
  END IF;

  -- Clear previous ranking points for this tournament
  DELETE FROM public.ranking_points WHERE tournament_id = _tournament_id;
  pts_part := cfg.participation_points;

  -- Award participation to every approved player
  FOR pair_rec IN
    SELECT DISTINCT pl.id AS player_id, p.id AS pair_id
    FROM public.registrations r
    JOIN public.pairs p ON p.id = r.pair_id
    JOIN public.players pl ON pl.id IN (p.player1_id, p.player2_id)
    WHERE r.tournament_id = _tournament_id AND r.status = 'approved'
  LOOP
    INSERT INTO public.ranking_points(tournament_id, category_id, player_id, pair_id, position, points)
    VALUES (_tournament_id, t.category_id, pair_rec.player_id, pair_rec.pair_id, 99, pts_part)
    ON CONFLICT (tournament_id, player_id) DO NOTHING;
  END LOOP;

  -- Final
  SELECT * INTO final_m FROM public.matches
   WHERE tournament_id=_tournament_id AND round='final' AND status IN ('finished','walkover') LIMIT 1;
  IF final_m.id IS NOT NULL THEN
    champion := final_m.winner_pair_id;
    finalist := CASE WHEN final_m.winner_pair_id = final_m.pair_a_id THEN final_m.pair_b_id ELSE final_m.pair_a_id END;
  END IF;

  -- Semis losers
  SELECT array_agg(CASE WHEN winner_pair_id=pair_a_id THEN pair_b_id ELSE pair_a_id END)
    INTO sf_losers
  FROM public.matches WHERE tournament_id=_tournament_id AND round='sf' AND status IN ('finished','walkover');

  -- Quarter losers
  SELECT array_agg(CASE WHEN winner_pair_id=pair_a_id THEN pair_b_id ELSE pair_a_id END)
    INTO qf_losers
  FROM public.matches WHERE tournament_id=_tournament_id AND round='qf' AND status IN ('finished','walkover');

  -- Apply points (update only players in those pairs)
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

  -- Notify
  FOR reg IN SELECT pair_id FROM public.registrations WHERE tournament_id=_tournament_id AND status='approved' LOOP
    PERFORM public.notify_pair(reg.pair_id, 'tournament_finished','Torneo finalizado',
      'El torneo "'||t.name||'" ha finalizado. Ya podés ver tus puntos en el ranking.',
      '/tournaments/'||_tournament_id);
  END LOOP;
END; $$;

-- =========================================================================
-- FUNCTION: get_ranking
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_ranking(_category_id UUID DEFAULT NULL, _from DATE DEFAULT NULL, _to DATE DEFAULT NULL)
RETURNS TABLE(player_id UUID, full_name TEXT, avatar_url TEXT, total_points BIGINT, tournaments_played BIGINT, wins BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    pl.id,
    COALESCE(pr.full_name, 'Jugador'),
    pr.avatar_url,
    COALESCE(SUM(rp.points),0)::BIGINT AS total_points,
    COUNT(DISTINCT rp.tournament_id)::BIGINT,
    COUNT(*) FILTER (WHERE rp.position = 1)::BIGINT
  FROM public.players pl
  LEFT JOIN public.profiles pr ON pr.user_id = pl.user_id
  LEFT JOIN public.ranking_points rp ON rp.player_id = pl.id
    AND (_category_id IS NULL OR rp.category_id = _category_id)
    AND (_from IS NULL OR rp.awarded_at::date >= _from)
    AND (_to IS NULL OR rp.awarded_at::date <= _to)
  GROUP BY pl.id, pr.full_name, pr.avatar_url
  HAVING COALESCE(SUM(rp.points),0) > 0
  ORDER BY total_points DESC;
$$;

-- =========================================================================
-- FUNCTION: get_player_stats
-- =========================================================================
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

-- =========================================================================
-- Realtime
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.standings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.standings REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
