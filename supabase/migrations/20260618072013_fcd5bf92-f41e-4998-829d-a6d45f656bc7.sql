
-- ============================================================
-- 1. ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.tournament_gender AS ENUM ('mens','womens','mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tournament_category_mode AS ENUM ('normal','suma');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tournament_category_status AS ENUM ('open','in_progress','closed','finished');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. TABLE tournament_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tournament_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  gender public.tournament_gender NOT NULL DEFAULT 'mens',
  mode public.tournament_category_mode NOT NULL DEFAULT 'normal',
  suma_value INTEGER,
  label TEXT,
  max_pairs INTEGER NOT NULL DEFAULT 16,
  waitlist_enabled BOOLEAN NOT NULL DEFAULT true,
  registration_open BOOLEAN NOT NULL DEFAULT true,
  status public.tournament_category_status NOT NULL DEFAULT 'open',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tcat_tournament ON public.tournament_categories(tournament_id);

GRANT SELECT ON public.tournament_categories TO authenticated, anon;
GRANT ALL ON public.tournament_categories TO service_role;

ALTER TABLE public.tournament_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tcat_select_all" ON public.tournament_categories;
CREATE POLICY "tcat_select_all" ON public.tournament_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tcat_admin_all" ON public.tournament_categories;
CREATE POLICY "tcat_admin_all" ON public.tournament_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_tcat_updated ON public.tournament_categories;
CREATE TRIGGER trg_tcat_updated BEFORE UPDATE ON public.tournament_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Add tournament_category_id columns
-- ============================================================
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS tournament_category_id UUID
  REFERENCES public.tournament_categories(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_registrations_tcat ON public.registrations(tournament_category_id);

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS tournament_category_id UUID
  REFERENCES public.tournament_categories(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_matches_tcat ON public.matches(tournament_category_id);

ALTER TABLE public.tournament_groups
  ADD COLUMN IF NOT EXISTS tournament_category_id UUID
  REFERENCES public.tournament_categories(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tgroups_tcat ON public.tournament_groups(tournament_category_id);

ALTER TABLE public.ranking_points
  ADD COLUMN IF NOT EXISTS tournament_category_id UUID
  REFERENCES public.tournament_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_rp_tcat ON public.ranking_points(tournament_category_id);

-- ============================================================
-- 4. Helper: convert categories.level text → integer
-- ============================================================
CREATE OR REPLACE FUNCTION public.category_level_int(_level TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_level,''))
    WHEN '1ra' THEN 1
    WHEN '2da' THEN 2
    WHEN '3ra' THEN 3
    WHEN '4ta' THEN 4
    WHEN '5ta' THEN 5
    WHEN '6ta' THEN 6
    WHEN '7ma' THEN 7
    WHEN '8va' THEN 8
    ELSE NULL
  END
$$;

-- ============================================================
-- 5. BACKFILL existing tournaments → 1 category each
-- ============================================================
DO $$
DECLARE
  t RECORD;
  tc_id UUID;
  v_gender public.tournament_gender;
  v_cat_gender public.category_gender;
BEGIN
  FOR t IN SELECT * FROM public.tournaments LOOP
    -- Skip if already has at least one tournament_categories row
    IF EXISTS (SELECT 1 FROM public.tournament_categories WHERE tournament_id = t.id) THEN
      CONTINUE;
    END IF;

    -- Derive gender from base category if present
    v_gender := 'mens';
    IF t.category_id IS NOT NULL THEN
      SELECT gender INTO v_cat_gender FROM public.categories WHERE id = t.category_id;
      IF v_cat_gender = 'female' THEN v_gender := 'womens';
      ELSIF v_cat_gender = 'mixed' THEN v_gender := 'mixed';
      ELSE v_gender := 'mens'; END IF;
    END IF;

    INSERT INTO public.tournament_categories(
      tournament_id, category_id, gender, mode, max_pairs,
      registration_open, status, position, label
    ) VALUES (
      t.id, t.category_id, v_gender, 'normal', t.max_pairs,
      t.registration_open,
      CASE t.status::text
        WHEN 'finished' THEN 'finished'::public.tournament_category_status
        WHEN 'in_progress' THEN 'in_progress'::public.tournament_category_status
        ELSE 'open'::public.tournament_category_status
      END,
      0, NULL
    )
    RETURNING id INTO tc_id;

    UPDATE public.registrations SET tournament_category_id = tc_id
      WHERE tournament_id = t.id AND tournament_category_id IS NULL;
    UPDATE public.matches SET tournament_category_id = tc_id
      WHERE tournament_id = t.id AND tournament_category_id IS NULL;
    UPDATE public.tournament_groups SET tournament_category_id = tc_id
      WHERE tournament_id = t.id AND tournament_category_id IS NULL;
    UPDATE public.ranking_points SET tournament_category_id = tc_id
      WHERE tournament_id = t.id AND tournament_category_id IS NULL;
  END LOOP;
END $$;

-- ============================================================
-- 6. VALIDATION FUNCTION + TRIGGER on registrations
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_registration_pair()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tc RECORD;
  p RECORD;
  cat1 RECORD;
  cat2 RECORD;
  lvl1 INTEGER;
  lvl2 INTEGER;
  total INTEGER;
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

  -- Gender check
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

  IF tc.mode = 'normal' THEN
    IF tc.category_id IS NOT NULL THEN
      IF cat1.id <> tc.category_id OR cat2.id <> tc.category_id THEN
        RAISE EXCEPTION 'Ambos jugadores deben pertenecer a la categoría del torneo';
      END IF;
    END IF;
  ELSIF tc.mode = 'suma' THEN
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_registration_pair ON public.registrations;
CREATE TRIGGER trg_validate_registration_pair
  BEFORE INSERT OR UPDATE OF tournament_category_id, pair_id
  ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.validate_registration_pair();

-- ============================================================
-- 7. RPC: generate fixture for a single tournament_category
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_fixture_for_category(
  _tournament_category_id UUID,
  _groups_count INTEGER DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tc RECORD;
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
  grp_id UUID;
  grp_pairs UUID[];
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden generar el fixture';
  END IF;

  SELECT * INTO tc FROM public.tournament_categories WHERE id = _tournament_category_id;
  IF tc IS NULL THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;

  SELECT * INTO t FROM public.tournaments WHERE id = tc.tournament_id;
  IF t IS NULL THEN RAISE EXCEPTION 'Torneo no encontrado'; END IF;

  -- Clear previous fixture for THIS category only
  DELETE FROM public.matches WHERE tournament_category_id = _tournament_category_id;
  DELETE FROM public.standings WHERE group_id IN (
    SELECT id FROM public.tournament_groups WHERE tournament_category_id = _tournament_category_id
  );
  DELETE FROM public.tournament_groups WHERE tournament_category_id = _tournament_category_id;

  SELECT array_agg(r.pair_id ORDER BY r.registered_at)
    INTO pair_ids
  FROM public.registrations r
  WHERE r.tournament_category_id = _tournament_category_id AND r.status = 'approved';

  IF pair_ids IS NULL OR array_length(pair_ids,1) < 2 THEN
    RAISE EXCEPTION 'Necesitas al menos 2 parejas aprobadas';
  END IF;

  n := array_length(pair_ids,1);

  IF t.tournament_type = 'round_robin' THEN
    INSERT INTO public.tournament_groups(tournament_id, tournament_category_id, name, position)
      VALUES (tc.tournament_id, _tournament_category_id, 'Round Robin', 0)
      RETURNING id INTO grp_id;
    FOR i IN 1..n LOOP
      FOR j IN (i+1)..n LOOP
        INSERT INTO public.matches(tournament_id, tournament_category_id, group_id, round, bracket_position, pair_a_id, pair_b_id)
        VALUES (tc.tournament_id, _tournament_category_id, grp_id, 'groups', (i*100+j), pair_ids[i], pair_ids[j]);
      END LOOP;
      INSERT INTO public.standings(group_id, pair_id) VALUES (grp_id, pair_ids[i]);
    END LOOP;
  ELSIF t.tournament_type = 'groups_elimination' THEN
    IF _groups_count < 2 THEN _groups_count := 2; END IF;
    IF n < _groups_count*2 THEN _groups_count := GREATEST(2, n/2); END IF;
    FOR i IN 1.._groups_count LOOP
      INSERT INTO public.tournament_groups(tournament_id, tournament_category_id, name, position)
        VALUES (tc.tournament_id, _tournament_category_id, 'Grupo '||chr(64+i), i)
        RETURNING id INTO grp_id;
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
          INSERT INTO public.matches(tournament_id, tournament_category_id, group_id, round, bracket_position, pair_a_id, pair_b_id)
          VALUES (tc.tournament_id, _tournament_category_id, grp_id, 'groups', (i*100+j), grp_pairs[i], grp_pairs[j]);
        END LOOP;
      END LOOP;
    END LOOP;
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
        INSERT INTO public.matches(tournament_id, tournament_category_id, round, bracket_position)
        VALUES (tc.tournament_id, _tournament_category_id, round_label, j) RETURNING id INTO m_id;
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
          INSERT INTO public.matches(tournament_id, tournament_category_id, round, bracket_position,
            pair_a_id, pair_b_id, status, winner_pair_id)
          VALUES (
            tc.tournament_id, _tournament_category_id, round_label, j,
            CASE WHEN ((j-1)*2+1) <= n THEN pair_ids[(j-1)*2+1] ELSE NULL END,
            CASE WHEN ((j-1)*2+2) <= n THEN pair_ids[(j-1)*2+2] ELSE NULL END,
            CASE WHEN ((j-1)*2+2) > n AND ((j-1)*2+1) <= n THEN 'walkover'::public.match_status ELSE 'scheduled'::public.match_status END,
            CASE WHEN ((j-1)*2+2) > n AND ((j-1)*2+1) <= n THEN pair_ids[(j-1)*2+1] ELSE NULL END
          ) RETURNING id INTO m_id;
        ELSE
          INSERT INTO public.matches(tournament_id, tournament_category_id, round, bracket_position)
          VALUES (tc.tournament_id, _tournament_category_id, round_label, j) RETURNING id INTO m_id;
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

  UPDATE public.tournament_categories SET status='in_progress' WHERE id = _tournament_category_id AND status='open';
  UPDATE public.tournaments SET status = 'in_progress' WHERE id = tc.tournament_id AND status IN ('upcoming','open','full');

  FOR i IN 1..n LOOP
    PERFORM public.notify_pair(pair_ids[i], 'fixture_published','Fixture publicado',
      'Ya podés ver el fixture del torneo "'||t.name||'".', '/tournaments/'||tc.tournament_id);
  END LOOP;

  RETURN jsonb_build_object('matches',
    (SELECT count(*) FROM public.matches WHERE tournament_category_id=_tournament_category_id));
END; $$;

-- Wrapper: keep old generate_fixture working — operate on first category of the tournament
CREATE OR REPLACE FUNCTION public.generate_fixture(_tournament_id UUID, _groups_count INTEGER DEFAULT 4)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tc_id UUID;
BEGIN
  SELECT id INTO tc_id FROM public.tournament_categories
   WHERE tournament_id = _tournament_id ORDER BY position, created_at LIMIT 1;
  IF tc_id IS NULL THEN
    RAISE EXCEPTION 'Este torneo no tiene categorías configuradas';
  END IF;
  RETURN public.generate_fixture_for_category(tc_id, _groups_count);
END; $$;

-- ============================================================
-- 8. RPC: finalize a single tournament_category
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_tournament_category(_tournament_category_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tc RECORD;
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
  remaining INT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  SELECT * INTO tc FROM public.tournament_categories WHERE id = _tournament_category_id;
  IF tc IS NULL THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  SELECT * INTO t FROM public.tournaments WHERE id = tc.tournament_id;

  SELECT * INTO cfg_row FROM public.tournament_points_config
   WHERE tournament_id = tc.tournament_id ORDER BY created_at DESC LIMIT 1;
  IF cfg_row IS NULL AND tc.category_id IS NOT NULL THEN
    SELECT * INTO cfg_row FROM public.tournament_points_config WHERE category_id = tc.category_id ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF cfg_row IS NOT NULL THEN
    champion_pts := cfg_row.champion_points;
    finalist_pts := cfg_row.finalist_points;
    semi_pts := cfg_row.semifinalist_points;
    quarter_pts := cfg_row.quarterfinalist_points;
    part_pts := cfg_row.participation_points;
  END IF;

  DELETE FROM public.ranking_points WHERE tournament_category_id = _tournament_category_id;

  FOR pair_rec IN
    SELECT DISTINCT u AS player_user, p.id AS pair_id
    FROM public.registrations r
    JOIN public.pairs p ON p.id = r.pair_id
    CROSS JOIN LATERAL unnest(ARRAY[p.player1_id, p.player2_id]) AS u
    WHERE r.tournament_category_id = _tournament_category_id AND r.status = 'approved' AND u IS NOT NULL
  LOOP
    INSERT INTO public.ranking_points(tournament_id, tournament_category_id, category_id, player_id, pair_id, position, points)
    VALUES (tc.tournament_id, _tournament_category_id, tc.category_id, pair_rec.player_user, pair_rec.pair_id, 99, part_pts)
    ON CONFLICT (tournament_id, player_id) DO NOTHING;
  END LOOP;

  SELECT * INTO final_m FROM public.matches
   WHERE tournament_category_id = _tournament_category_id AND round='final' AND status IN ('finished','walkover') LIMIT 1;
  IF final_m.id IS NOT NULL THEN
    champion := final_m.winner_pair_id;
    finalist := CASE WHEN final_m.winner_pair_id = final_m.pair_a_id THEN final_m.pair_b_id ELSE final_m.pair_a_id END;
  END IF;

  SELECT array_agg(CASE WHEN winner_pair_id=pair_a_id THEN pair_b_id ELSE pair_a_id END)
    INTO sf_losers
  FROM public.matches WHERE tournament_category_id=_tournament_category_id AND round='sf' AND status IN ('finished','walkover');

  SELECT array_agg(CASE WHEN winner_pair_id=pair_a_id THEN pair_b_id ELSE pair_a_id END)
    INTO qf_losers
  FROM public.matches WHERE tournament_category_id=_tournament_category_id AND round='qf' AND status IN ('finished','walkover');

  IF champion IS NOT NULL THEN
    UPDATE public.ranking_points rp SET position=1, points=champion_pts
    FROM public.pairs p WHERE p.id=champion AND rp.tournament_category_id=_tournament_category_id
      AND rp.player_id IN (p.player1_id, p.player2_id);
  END IF;
  IF finalist IS NOT NULL THEN
    UPDATE public.ranking_points rp SET position=2, points=finalist_pts
    FROM public.pairs p WHERE p.id=finalist AND rp.tournament_category_id=_tournament_category_id
      AND rp.player_id IN (p.player1_id, p.player2_id);
  END IF;
  IF sf_losers IS NOT NULL THEN
    UPDATE public.ranking_points rp SET position=3, points=semi_pts
    FROM public.pairs p WHERE p.id = ANY(sf_losers) AND rp.tournament_category_id=_tournament_category_id
      AND rp.player_id IN (p.player1_id, p.player2_id);
  END IF;
  IF qf_losers IS NOT NULL THEN
    UPDATE public.ranking_points rp SET position=5, points=quarter_pts
    FROM public.pairs p WHERE p.id = ANY(qf_losers) AND rp.tournament_category_id=_tournament_category_id
      AND rp.player_id IN (p.player1_id, p.player2_id);
  END IF;

  UPDATE public.tournament_categories SET status='finished' WHERE id=_tournament_category_id;

  -- If all categories of the tournament are finished, mark tournament as finished
  SELECT count(*) INTO remaining FROM public.tournament_categories
    WHERE tournament_id = tc.tournament_id AND status <> 'finished';
  IF remaining = 0 THEN
    UPDATE public.tournaments SET status='finished' WHERE id=tc.tournament_id;
  END IF;

  FOR reg IN SELECT pair_id FROM public.registrations WHERE tournament_category_id=_tournament_category_id AND status='approved' LOOP
    PERFORM public.notify_pair(reg.pair_id, 'tournament_finished','Categoría finalizada',
      'Una categoría del torneo "'||t.name||'" ha finalizado.',
      '/tournaments/'||tc.tournament_id);
  END LOOP;
END; $$;

-- Wrapper: keep old finalize_tournament — finalize all categories
CREATE OR REPLACE FUNCTION public.finalize_tournament(_tournament_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tc_id UUID;
BEGIN
  FOR tc_id IN SELECT id FROM public.tournament_categories WHERE tournament_id=_tournament_id LOOP
    PERFORM public.finalize_tournament_category(tc_id);
  END LOOP;
END; $$;
