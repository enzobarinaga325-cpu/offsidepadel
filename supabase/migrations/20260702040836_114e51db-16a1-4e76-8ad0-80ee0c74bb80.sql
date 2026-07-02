
-- Public read access for fixture/groups/standings
CREATE POLICY "Matches viewable by anon"
  ON public.matches FOR SELECT TO anon USING (true);
CREATE POLICY "Groups viewable by anon"
  ON public.tournament_groups FOR SELECT TO anon USING (true);
CREATE POLICY "Standings viewable by anon"
  ON public.standings FOR SELECT TO anon USING (true);

GRANT SELECT ON public.matches           TO anon;
GRANT SELECT ON public.tournament_groups TO anon;
GRANT SELECT ON public.standings         TO anon;

-- Admin RPC to (re)assign pairs to groups and rebuild the round-robin matches
CREATE OR REPLACE FUNCTION public.admin_set_category_groups(
  _tournament_category_id uuid,
  _groups jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tc RECORD;
  grp jsonb;
  grp_id uuid;
  grp_name text;
  grp_pos int := 0;
  pair_ids uuid[];
  i int; j int;
  match_count int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Solo administradores';
  END IF;
  SELECT * INTO tc FROM public.tournament_categories WHERE id = _tournament_category_id;
  IF tc IS NULL THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  IF jsonb_typeof(_groups) <> 'array' THEN RAISE EXCEPTION 'Formato inválido'; END IF;

  DELETE FROM public.matches
    WHERE tournament_category_id = _tournament_category_id
      AND group_id IS NOT NULL;
  DELETE FROM public.standings
    WHERE group_id IN (
      SELECT id FROM public.tournament_groups WHERE tournament_category_id = _tournament_category_id
    );
  DELETE FROM public.tournament_groups WHERE tournament_category_id = _tournament_category_id;

  FOR grp IN SELECT * FROM jsonb_array_elements(_groups) LOOP
    grp_pos := grp_pos + 1;
    grp_name := COALESCE(NULLIF(grp->>'name',''), 'Grupo '||chr(64+grp_pos));
    pair_ids := ARRAY(
      SELECT (v)::uuid FROM jsonb_array_elements_text(COALESCE(grp->'pair_ids','[]'::jsonb)) AS v
    );

    INSERT INTO public.tournament_groups(tournament_id, tournament_category_id, name, position)
    VALUES (tc.tournament_id, _tournament_category_id, grp_name, grp_pos)
    RETURNING id INTO grp_id;

    IF pair_ids IS NOT NULL AND array_length(pair_ids,1) IS NOT NULL THEN
      FOR i IN 1..array_length(pair_ids,1) LOOP
        INSERT INTO public.standings(group_id, pair_id) VALUES (grp_id, pair_ids[i]);
      END LOOP;
      IF array_length(pair_ids,1) >= 2 THEN
        FOR i IN 1..array_length(pair_ids,1) LOOP
          FOR j IN (i+1)..array_length(pair_ids,1) LOOP
            INSERT INTO public.matches(
              tournament_id, tournament_category_id, group_id,
              round, bracket_position, pair_a_id, pair_b_id
            ) VALUES (
              tc.tournament_id, _tournament_category_id, grp_id,
              'groups', (grp_pos*10000)+(i*100)+j, pair_ids[i], pair_ids[j]
            );
            match_count := match_count + 1;
          END LOOP;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('groups', jsonb_array_length(_groups), 'matches', match_count);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_set_category_groups(uuid, jsonb) TO authenticated;
