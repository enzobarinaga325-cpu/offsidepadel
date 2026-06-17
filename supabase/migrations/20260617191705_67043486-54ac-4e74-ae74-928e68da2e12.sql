
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.tournament_type AS ENUM ('elimination', 'groups_elimination', 'round_robin');
CREATE TYPE public.tournament_status AS ENUM ('upcoming', 'open', 'full', 'in_progress', 'finished', 'cancelled');
CREATE TYPE public.registration_status AS ENUM ('pending', 'approved', 'rejected', 'waitlist');
CREATE TYPE public.category_gender AS ENUM ('male', 'female', 'mixed');

-- =========================================================
-- CATEGORIES
-- =========================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gender public.category_gender NOT NULL DEFAULT 'mixed',
  level TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update categories"
  ON public.categories FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete categories"
  ON public.categories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- TOURNAMENTS
-- =========================================================
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE,
  location TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  tournament_type public.tournament_type NOT NULL DEFAULT 'elimination',
  registration_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_pairs INTEGER NOT NULL DEFAULT 16,
  rules TEXT,
  prizes TEXT,
  status public.tournament_status NOT NULL DEFAULT 'upcoming',
  registration_open BOOLEAN NOT NULL DEFAULT false,
  registration_deadline TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tournaments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournaments are viewable by everyone"
  ON public.tournaments FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert tournaments"
  ON public.tournaments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tournaments"
  ON public.tournaments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tournaments"
  ON public.tournaments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tournaments_status ON public.tournaments(status);
CREATE INDEX idx_tournaments_start_date ON public.tournaments(start_date);
CREATE INDEX idx_tournaments_category ON public.tournaments(category_id);

-- =========================================================
-- PLAYERS (extended profile for padel)
-- =========================================================
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  level TEXT,
  preferred_side TEXT CHECK (preferred_side IN ('drive', 'reves', 'ambos')),
  phone TEXT,
  city TEXT,
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Public read so player names show in tournament details
CREATE POLICY "Players are viewable by everyone"
  ON public.players FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own player record"
  ON public.players FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own player record"
  ON public.players FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any player"
  ON public.players FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete players"
  ON public.players FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- PAIRS
-- =========================================================
CREATE TABLE public.pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (player1_id <> player2_id)
);

GRANT SELECT ON public.pairs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pairs TO authenticated;
GRANT ALL ON public.pairs TO service_role;

ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pairs are viewable by everyone"
  ON public.pairs FOR SELECT
  USING (true);

CREATE POLICY "Users can create pairs they belong to"
  ON public.pairs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (auth.uid() = player1_id OR auth.uid() = player2_id OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Admins can update pairs"
  ON public.pairs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pairs"
  ON public.pairs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pairs_updated_at
  BEFORE UPDATE ON public.pairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pairs_tournament ON public.pairs(tournament_id);
CREATE INDEX idx_pairs_player1 ON public.pairs(player1_id);
CREATE INDEX idx_pairs_player2 ON public.pairs(player2_id);

-- =========================================================
-- REGISTRATIONS
-- =========================================================
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  pair_id UUID NOT NULL UNIQUE REFERENCES public.pairs(id) ON DELETE CASCADE,
  status public.registration_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  registered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Public can see approved registrations (to display confirmed pairs)
CREATE POLICY "Approved registrations are viewable by everyone"
  ON public.registrations FOR SELECT
  USING (status = 'approved');

-- Players can see their own registrations (any status)
CREATE POLICY "Players see their own registrations"
  ON public.registrations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pairs p
      WHERE p.id = registrations.pair_id
        AND (p.player1_id = auth.uid() OR p.player2_id = auth.uid() OR p.created_by = auth.uid())
    )
  );

CREATE POLICY "Admins see all registrations"
  ON public.registrations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can register"
  ON public.registrations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = registered_by
    AND EXISTS (
      SELECT 1 FROM public.pairs p
      WHERE p.id = pair_id
        AND (p.player1_id = auth.uid() OR p.player2_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Admins can update registrations"
  ON public.registrations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can cancel their own pending registration"
  ON public.registrations FOR DELETE TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.pairs p
      WHERE p.id = registrations.pair_id
        AND (p.player1_id = auth.uid() OR p.player2_id = auth.uid() OR p.created_by = auth.uid())
    )
  );

CREATE POLICY "Admins can delete registrations"
  ON public.registrations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_registrations_updated_at
  BEFORE UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_registrations_tournament ON public.registrations(tournament_id);
CREATE INDEX idx_registrations_status ON public.registrations(status);

-- =========================================================
-- TOURNAMENT POINTS CONFIG
-- =========================================================
CREATE TABLE public.tournament_points_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID UNIQUE REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  champion_points INTEGER NOT NULL DEFAULT 100,
  finalist_points INTEGER NOT NULL DEFAULT 60,
  semifinalist_points INTEGER NOT NULL DEFAULT 35,
  quarterfinalist_points INTEGER NOT NULL DEFAULT 20,
  participation_points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tournament_points_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_points_config TO authenticated;
GRANT ALL ON public.tournament_points_config TO service_role;

ALTER TABLE public.tournament_points_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Points config viewable by everyone"
  ON public.tournament_points_config FOR SELECT
  USING (true);

CREATE POLICY "Admins manage points config"
  ON public.tournament_points_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_points_config_updated_at
  BEFORE UPDATE ON public.tournament_points_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
