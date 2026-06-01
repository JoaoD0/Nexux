CREATE OR REPLACE FUNCTION public.try_match_x1(p_player_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_opponent RECORD;
  v_match_id uuid;
  v_player_elo int;
  v_server_ip text;
  v_server_password text;
BEGIN
  UPDATE queue SET status = 'matched'
  WHERE user_id = (
    SELECT user_id FROM queue
    WHERE mode = 'x1'
    AND status = 'searching'
    AND user_id != p_player_id
    ORDER BY joined_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  AND mode = 'x1'
  AND status = 'searching'
  RETURNING * INTO v_opponent;

  IF v_opponent IS NULL THEN
    RETURN json_build_object('status', 'waiting');
  END IF;

  UPDATE queue SET status = 'matched'
  WHERE user_id = p_player_id AND mode = 'x1' AND status = 'searching';

  SELECT elo_x1 INTO v_player_elo FROM profiles WHERE user_id = p_player_id;

  v_server_ip := (floor(random()*255)+1)::text || '.' || (floor(random()*255)+1)::text || '.' || (floor(random()*255)+1)::text || '.' || (floor(random()*255)+1)::text || ':7000';
  v_server_password := upper(substr(md5(random()::text), 1, 6));

  INSERT INTO matches (mode, status, map_name, server_ip, server_password, team1_avg_elo, team2_avg_elo, source, banned_maps)
  VALUES ('x1', 'banning', 'TBD', v_server_ip, v_server_password, COALESCE(v_player_elo, 1000), v_opponent.elo, 'matchmaking', '{}')
  RETURNING id INTO v_match_id;

  INSERT INTO match_players (match_id, user_id, team, elo_before)
  VALUES
    (v_match_id, p_player_id, 1, COALESCE(v_player_elo, 1000)),
    (v_match_id, v_opponent.user_id, 2, v_opponent.elo);

  RETURN json_build_object(
    'status', 'matched',
    'match_id', v_match_id,
    'opponent_id', v_opponent.user_id
  );
END;
$function$;