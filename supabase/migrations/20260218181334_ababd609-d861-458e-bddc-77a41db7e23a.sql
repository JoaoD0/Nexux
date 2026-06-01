
-- =============================================
-- FIX 1: Restrict match updates to participants
-- =============================================
DROP POLICY "Authenticated users can update matches" ON public.matches;

CREATE POLICY "Match participants can update matches"
ON public.matches FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.match_players
    WHERE match_players.match_id = matches.id
    AND match_players.user_id = auth.uid()
  )
);

-- =============================================
-- FIX 2: Restrict match SELECT to hide server credentials from non-participants
-- =============================================
DROP POLICY "Matches are viewable by everyone" ON public.matches;

-- Everyone can see matches exist (for leaderboard/history), but server_password is in the table.
-- We restrict SELECT to participants only for full row access.
CREATE POLICY "Match participants can view matches"
ON public.matches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.match_players
    WHERE match_players.match_id = matches.id
    AND match_players.user_id = auth.uid()
  )
);

-- =============================================
-- FIX 3: Restrict chat_messages SELECT to match participants
-- =============================================
DROP POLICY "Chat messages viewable by everyone" ON public.chat_messages;

CREATE POLICY "Match participants can view chat messages"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.match_players
    WHERE match_players.match_id = chat_messages.match_id
    AND match_players.user_id = auth.uid()
  )
);

-- =============================================
-- FIX 4: Lock down profile stat fields - only cosmetic updates allowed directly
-- =============================================
DROP POLICY "Users can update their own profile" ON public.profiles;

-- Users can only update cosmetic fields (nickname, avatar_url, region)
-- Stats (elo_points, wins, losses, kills, deaths) must remain unchanged
CREATE POLICY "Users can update their profile cosmetics"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  elo_points = (SELECT p.elo_points FROM public.profiles p WHERE p.user_id = auth.uid())
  AND wins = (SELECT p.wins FROM public.profiles p WHERE p.user_id = auth.uid())
  AND losses = (SELECT p.losses FROM public.profiles p WHERE p.user_id = auth.uid())
  AND kills = (SELECT p.kills FROM public.profiles p WHERE p.user_id = auth.uid())
  AND deaths = (SELECT p.deaths FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- =============================================
-- SECURITY DEFINER function to handle post-match stat updates
-- =============================================
CREATE OR REPLACE FUNCTION public.submit_match_result(
  p_match_id UUID,
  p_result TEXT,
  p_kills INT,
  p_deaths INT,
  p_assists INT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile profiles%ROWTYPE;
  v_elo_before INT;
  v_team INT;
  v_team1_avg INT;
  v_team2_avg INT;
  v_my_avg INT;
  v_opp_avg INT;
  v_elo_change INT;
  v_new_elo INT;
  v_match_status TEXT;
  v_already_submitted TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate result
  IF p_result NOT IN ('win', 'loss', 'draw') THEN
    RAISE EXCEPTION 'Invalid result: %', p_result;
  END IF;

  -- Validate stats
  IF p_kills < 0 OR p_deaths < 0 OR p_assists < 0 THEN
    RAISE EXCEPTION 'Stats cannot be negative';
  END IF;

  -- Check user is in this match
  SELECT mp.elo_before, mp.team, mp.result INTO v_elo_before, v_team, v_already_submitted
  FROM match_players mp
  WHERE mp.match_id = p_match_id AND mp.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not in this match';
  END IF;

  IF v_already_submitted IS NOT NULL THEN
    RAISE EXCEPTION 'Result already submitted';
  END IF;

  -- Get match info
  SELECT m.status, m.team1_avg_elo, m.team2_avg_elo INTO v_match_status, v_team1_avg, v_team2_avg
  FROM matches m WHERE m.id = p_match_id;

  IF v_match_status = 'finished' THEN
    RAISE EXCEPTION 'Match already finished';
  END IF;

  -- Get current profile
  SELECT * INTO v_profile FROM profiles WHERE user_id = v_user_id;

  -- Calculate ELO change
  IF v_team = 1 THEN
    v_my_avg := v_team1_avg;
    v_opp_avg := v_team2_avg;
  ELSE
    v_my_avg := v_team2_avg;
    v_opp_avg := v_team1_avg;
  END IF;

  IF p_result = 'draw' THEN
    v_elo_change := 0;
  ELSE
    -- ELO calculation: base ±25, adjusted by team strength difference
    DECLARE
      v_expected FLOAT;
      v_actual FLOAT;
      v_k INT := 32;
    BEGIN
      v_expected := 1.0 / (1.0 + POWER(10.0, (v_opp_avg - v_my_avg)::FLOAT / 400.0));
      IF p_result = 'win' THEN
        v_actual := 1.0;
      ELSE
        v_actual := 0.0;
      END IF;
      v_elo_change := ROUND(v_k * (v_actual - v_expected))::INT;
    END;
  END IF;

  v_new_elo := GREATEST(0, v_profile.elo_points + v_elo_change);

  -- Update match_players
  UPDATE match_players SET
    kills = p_kills,
    deaths = p_deaths,
    assists = p_assists,
    result = p_result,
    elo_after = v_new_elo
  WHERE match_id = p_match_id AND user_id = v_user_id;

  -- Update profile stats
  UPDATE profiles SET
    elo_points = v_new_elo,
    kills = profiles.kills + p_kills,
    deaths = profiles.deaths + p_deaths,
    wins = CASE WHEN p_result = 'win' THEN profiles.wins + 1 ELSE profiles.wins END,
    losses = CASE WHEN p_result = 'loss' THEN profiles.losses + 1 ELSE profiles.losses END
  WHERE user_id = v_user_id;

  -- Update match status
  UPDATE matches SET
    status = 'finished',
    finished_at = now()
  WHERE id = p_match_id;

  RETURN jsonb_build_object('elo_change', v_elo_change, 'new_elo', v_new_elo);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.submit_match_result TO authenticated;

-- =============================================
-- SECURITY DEFINER function for match decline penalty
-- =============================================
CREATE OR REPLACE FUNCTION public.apply_decline_penalty()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE profiles SET
    elo_points = GREATEST(0, elo_points - 10)
  WHERE user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_decline_penalty TO authenticated;
