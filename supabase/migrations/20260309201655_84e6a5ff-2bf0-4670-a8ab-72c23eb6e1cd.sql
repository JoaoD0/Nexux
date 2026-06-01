
-- Add source column to matches to distinguish legitimate vs manually created matches
ALTER TABLE public.matches ADD COLUMN source text NOT NULL DEFAULT 'manual';

-- Remove the permissive INSERT policy that allows any authenticated user to create matches
DROP POLICY IF EXISTS "Authenticated users can create matches" ON public.matches;

-- Update submit_match_result to validate match source
CREATE OR REPLACE FUNCTION public.submit_match_result(p_match_id uuid, p_result text, p_kills integer, p_deaths integer, p_assists integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_match_source TEXT;
  v_already_submitted TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_result NOT IN ('win', 'loss', 'draw') THEN
    RAISE EXCEPTION 'Invalid result: %', p_result;
  END IF;

  IF p_kills < 0 OR p_deaths < 0 OR p_assists < 0 THEN
    RAISE EXCEPTION 'Stats cannot be negative';
  END IF;

  -- Check match source is legitimate
  SELECT m.status, m.source INTO v_match_status, v_match_source
  FROM matches m WHERE m.id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_match_source != 'matchmaking' THEN
    RAISE EXCEPTION 'Match not created by matchmaking system';
  END IF;

  IF v_match_status = 'finished' THEN
    RAISE EXCEPTION 'Match already finished';
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

  -- Get match ELO averages
  SELECT m.team1_avg_elo, m.team2_avg_elo INTO v_team1_avg, v_team2_avg
  FROM matches m WHERE m.id = p_match_id;

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

  UPDATE match_players SET
    kills = p_kills,
    deaths = p_deaths,
    assists = p_assists,
    result = p_result,
    elo_after = v_new_elo
  WHERE match_id = p_match_id AND user_id = v_user_id;

  UPDATE profiles SET
    elo_points = v_new_elo,
    kills = profiles.kills + p_kills,
    deaths = profiles.deaths + p_deaths,
    wins = CASE WHEN p_result = 'win' THEN profiles.wins + 1 ELSE profiles.wins END,
    losses = CASE WHEN p_result = 'loss' THEN profiles.losses + 1 ELSE profiles.losses END
  WHERE user_id = v_user_id;

  UPDATE matches SET
    status = 'finished',
    finished_at = now()
  WHERE id = p_match_id;

  RETURN jsonb_build_object('elo_change', v_elo_change, 'new_elo', v_new_elo);
END;
$function$;
