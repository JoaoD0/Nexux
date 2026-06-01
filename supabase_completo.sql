-- ============================================================
-- NEXUS — SQL COMPLETO PARA NOVO PROJETO SUPABASE
-- Cole tudo de uma vez no SQL Editor e clique Run
-- ============================================================

-- ============================================================
-- 1. TIPOS / ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- ============================================================
-- 2. FUNÇÃO has_role (precisa existir antes das policies)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============================================================
-- 3. TABELAS
-- ============================================================

-- Profiles (estende auth.users)
CREATE TABLE public.profiles (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL UNIQUE,
  nickname    TEXT NOT NULL,
  avatar_url  TEXT DEFAULT 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=default',
  elo_points  INTEGER NOT NULL DEFAULT 1000,
  elo_x1      INTEGER NOT NULL DEFAULT 1000,
  wins        INTEGER NOT NULL DEFAULT 0,
  losses      INTEGER NOT NULL DEFAULT 0,
  kills       INTEGER NOT NULL DEFAULT 0,
  deaths      INTEGER NOT NULL DEFAULT 0,
  region      TEXT DEFAULT 'SP',
  riot_puuid  TEXT DEFAULT NULL,
  banned      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matches
CREATE TABLE public.matches (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mode            TEXT NOT NULL DEFAULT '5v5',
  map_name        TEXT NOT NULL,
  server_ip       TEXT NOT NULL,
  server_password TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'lobby'
                  CHECK (status IN ('lobby','banning','in_progress','finished','cancelled')),
  team1_avg_elo   INTEGER NOT NULL DEFAULT 0,
  team2_avg_elo   INTEGER NOT NULL DEFAULT 0,
  source          TEXT NOT NULL DEFAULT 'manual',
  banned_maps     TEXT[] DEFAULT '{}',
  final_map       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ
);

-- Match players
CREATE TABLE public.match_players (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id   UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  team       INTEGER NOT NULL CHECK (team IN (1, 2)),
  kills      INTEGER,
  deaths     INTEGER,
  assists    INTEGER,
  elo_before INTEGER NOT NULL,
  elo_after  INTEGER,
  result     TEXT CHECK (result IN ('win', 'loss', 'draw')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Convites X1
CREATE TABLE public.x1_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 minutes')
);

-- Fila
CREATE TABLE public.queue (
  user_id    UUID NOT NULL PRIMARY KEY,
  elo        INTEGER NOT NULL,
  mode       TEXT NOT NULL DEFAULT '5v5',
  status     TEXT NOT NULL DEFAULT 'searching' CHECK (status IN ('searching', 'matched')),
  invite_id  UUID REFERENCES public.x1_invites(id),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat
CREATE TABLE public.chat_messages (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id   UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  nickname   TEXT NOT NULL,
  avatar_url TEXT,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reports
CREATE TABLE public.reports (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_id UUID NOT NULL,
  match_id    UUID REFERENCES public.matches(id),
  category    TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles
CREATE TABLE public.user_roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role    app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Configurações da plataforma
CREATE TABLE public.platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Map bans
CREATE TABLE public.map_bans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id  UUID NOT NULL,
  map_name   TEXT NOT NULL,
  ban_order  INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x1_invites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_bans         ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their profile cosmetics" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    elo_points = (SELECT p.elo_points FROM public.profiles p WHERE p.user_id = auth.uid())
    AND elo_x1  = (SELECT p.elo_x1   FROM public.profiles p WHERE p.user_id = auth.uid())
    AND wins    = (SELECT p.wins     FROM public.profiles p WHERE p.user_id = auth.uid())
    AND losses  = (SELECT p.losses   FROM public.profiles p WHERE p.user_id = auth.uid())
    AND kills   = (SELECT p.kills    FROM public.profiles p WHERE p.user_id = auth.uid())
    AND deaths  = (SELECT p.deaths   FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- Matches
CREATE POLICY "Match participants can view matches" ON public.matches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.match_players WHERE match_players.match_id = matches.id AND match_players.user_id = auth.uid())
  );
CREATE POLICY "Match participants can update matches" ON public.matches
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.match_players WHERE match_players.match_id = matches.id AND match_players.user_id = auth.uid())
  );

-- Match players
CREATE POLICY "Match players viewable by everyone" ON public.match_players
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert match players" ON public.match_players
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own match player" ON public.match_players
  FOR UPDATE USING (auth.uid() = user_id);

-- X1 invites
CREATE POLICY "Users can view their invites" ON public.x1_invites
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can create invites" ON public.x1_invites
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their invites" ON public.x1_invites
  FOR UPDATE USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Queue
CREATE POLICY "Queue is viewable by authenticated" ON public.queue
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can join queue" ON public.queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their queue status" ON public.queue
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave queue" ON public.queue
  FOR DELETE USING (auth.uid() = user_id);

-- Chat
CREATE POLICY "Match participants can view chat messages" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.match_players WHERE match_players.match_id = chat_messages.match_id AND match_players.user_id = auth.uid())
  );
CREATE POLICY "Authenticated users can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reports
CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can view all reports" ON public.reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update reports" ON public.reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Platform settings
CREATE POLICY "Anyone can read settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update settings" ON public.platform_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert settings" ON public.platform_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Map bans
CREATE POLICY "Match participants can view map bans" ON public.map_bans
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM match_players WHERE match_players.match_id = map_bans.match_id AND match_players.user_id = auth.uid()));
CREATE POLICY "Match participants can insert map bans" ON public.map_bans
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = player_id AND EXISTS (SELECT 1 FROM match_players WHERE match_players.match_id = map_bans.match_id AND match_players.user_id = auth.uid()));

-- ============================================================
-- 4. ÍNDICES
-- ============================================================
CREATE INDEX idx_match_players_match_id  ON public.match_players(match_id);
CREATE INDEX idx_match_players_user_id   ON public.match_players(user_id);
CREATE INDEX idx_chat_messages_match_id  ON public.chat_messages(match_id);
CREATE INDEX idx_queue_status            ON public.queue(status);
CREATE INDEX idx_matches_status          ON public.matches(status);
CREATE INDEX idx_profiles_elo            ON public.profiles(elo_points DESC);

-- ============================================================
-- 5. REALTIME
-- ============================================================
ALTER TABLE public.matches       REPLICA IDENTITY FULL;
ALTER TABLE public.match_players REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_bans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.x1_invites;

-- ============================================================
-- 6. FUNÇÕES
-- ============================================================

-- Auto-cria profile no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nickname, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'Player_' || LEFT(NEW.id::text, 6)),
    'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=' || NEW.id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-atualiza updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Penalidade por recusar partida
CREATE OR REPLACE FUNCTION public.apply_decline_penalty()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE profiles SET elo_points = GREATEST(0, elo_points - 10) WHERE user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_decline_penalty TO authenticated;

-- Submeter resultado da partida
CREATE OR REPLACE FUNCTION public.submit_match_result(
  p_match_id UUID, p_result TEXT, p_kills INT, p_deaths INT, p_assists INT
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id          UUID;
  v_profile          profiles%ROWTYPE;
  v_elo_before       INT;
  v_team             INT;
  v_team1_avg        INT;
  v_team2_avg        INT;
  v_my_avg           INT;
  v_opp_avg          INT;
  v_elo_change       INT;
  v_new_elo          INT;
  v_match_status     TEXT;
  v_match_source     TEXT;
  v_already_submitted TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_result NOT IN ('win', 'loss', 'draw') THEN RAISE EXCEPTION 'Invalid result: %', p_result; END IF;
  IF p_kills < 0 OR p_deaths < 0 OR p_assists < 0 THEN RAISE EXCEPTION 'Stats cannot be negative'; END IF;

  SELECT m.status, m.source INTO v_match_status, v_match_source FROM matches m WHERE m.id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_match_source != 'matchmaking' THEN RAISE EXCEPTION 'Match not created by matchmaking system'; END IF;
  IF v_match_status = 'finished' THEN RAISE EXCEPTION 'Match already finished'; END IF;

  SELECT mp.elo_before, mp.team, mp.result INTO v_elo_before, v_team, v_already_submitted
  FROM match_players mp WHERE mp.match_id = p_match_id AND mp.user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not in this match'; END IF;
  IF v_already_submitted IS NOT NULL THEN RAISE EXCEPTION 'Result already submitted'; END IF;

  SELECT m.team1_avg_elo, m.team2_avg_elo INTO v_team1_avg, v_team2_avg FROM matches m WHERE m.id = p_match_id;
  SELECT * INTO v_profile FROM profiles WHERE user_id = v_user_id;

  IF v_team = 1 THEN v_my_avg := v_team1_avg; v_opp_avg := v_team2_avg;
  ELSE               v_my_avg := v_team2_avg; v_opp_avg := v_team1_avg;
  END IF;

  IF p_result = 'draw' THEN
    v_elo_change := 0;
  ELSE
    DECLARE
      v_expected FLOAT;
      v_actual   FLOAT;
      v_k        INT := 32;
    BEGIN
      v_expected   := 1.0 / (1.0 + POWER(10.0, (v_opp_avg - v_my_avg)::FLOAT / 400.0));
      v_actual     := CASE WHEN p_result = 'win' THEN 1.0 ELSE 0.0 END;
      v_elo_change := ROUND(v_k * (v_actual - v_expected))::INT;
    END;
  END IF;

  v_new_elo := GREATEST(0, v_profile.elo_points + v_elo_change);

  UPDATE match_players SET kills=p_kills, deaths=p_deaths, assists=p_assists, result=p_result, elo_after=v_new_elo
  WHERE match_id = p_match_id AND user_id = v_user_id;

  UPDATE profiles SET
    elo_points = v_new_elo,
    kills      = profiles.kills  + p_kills,
    deaths     = profiles.deaths + p_deaths,
    wins       = CASE WHEN p_result = 'win'  THEN profiles.wins  + 1 ELSE profiles.wins  END,
    losses     = CASE WHEN p_result = 'loss' THEN profiles.losses + 1 ELSE profiles.losses END
  WHERE user_id = v_user_id;

  UPDATE matches SET status = 'finished', finished_at = now() WHERE id = p_match_id;

  RETURN jsonb_build_object('elo_change', v_elo_change, 'new_elo', v_new_elo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_match_result TO authenticated;

-- Matchmaking X1 com suporte a convite direto
CREATE OR REPLACE FUNCTION public.try_match_x1(p_player_id UUID, p_invite_id UUID DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_opponent   RECORD;
  v_match_id   UUID;
  v_player_elo INT;
  v_server_ip  TEXT;
  v_server_pwd TEXT;
BEGIN
  SELECT elo_x1 INTO v_player_elo FROM profiles WHERE user_id = p_player_id;

  IF p_invite_id IS NOT NULL THEN
    -- Pareamento direto: procura o oponente com o mesmo invite_id
    UPDATE queue SET status = 'matched'
    WHERE user_id = (
      SELECT user_id FROM queue
      WHERE invite_id = p_invite_id
        AND mode = 'x1'
        AND status = 'searching'
        AND user_id != p_player_id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
      AND mode = 'x1'
      AND status = 'searching'
    RETURNING * INTO v_opponent;
  ELSE
    -- FIFO aleatório: ignora jogadores com convite ativo
    UPDATE queue SET status = 'matched'
    WHERE user_id = (
      SELECT user_id FROM queue
      WHERE mode = 'x1'
        AND status = 'searching'
        AND user_id != p_player_id
        AND invite_id IS NULL
      ORDER BY joined_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
      AND mode = 'x1'
      AND status = 'searching'
    RETURNING * INTO v_opponent;
  END IF;

  IF v_opponent IS NULL THEN
    RETURN json_build_object('status', 'waiting');
  END IF;

  UPDATE queue SET status = 'matched'
  WHERE user_id = p_player_id AND mode = 'x1' AND status = 'searching';

  v_server_ip := (floor(random()*255)+1)::text || '.' ||
                 (floor(random()*255)+1)::text || '.' ||
                 (floor(random()*255)+1)::text || '.' ||
                 (floor(random()*255)+1)::text || ':7000';
  v_server_pwd := upper(substr(md5(random()::text), 1, 6));

  INSERT INTO matches (mode, status, map_name, server_ip, server_password,
                       team1_avg_elo, team2_avg_elo, source, banned_maps)
  VALUES ('x1', 'banning', 'TBD', v_server_ip, v_server_pwd,
          COALESCE(v_player_elo, 1000), v_opponent.elo, 'matchmaking', '{}')
  RETURNING id INTO v_match_id;

  INSERT INTO match_players (match_id, user_id, team, elo_before)
  VALUES
    (v_match_id, p_player_id,        1, COALESCE(v_player_elo, 1000)),
    (v_match_id, v_opponent.user_id, 2, v_opponent.elo);

  RETURN json_build_object(
    'status',      'matched',
    'match_id',    v_match_id,
    'opponent_id', v_opponent.user_id
  );
END;
$$;

-- ============================================================
-- 7. DADOS INICIAIS
-- ============================================================
INSERT INTO public.platform_settings (key, value) VALUES
  ('initial_elo',       '1000'),
  ('elo_win',           '25'),
  ('elo_loss',          '25'),
  ('queue_timeout',     '300'),
  ('maintenance_mode',  'false');
