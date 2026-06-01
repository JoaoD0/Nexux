
-- Create map_bans table
CREATE TABLE public.map_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id uuid NOT NULL,
  map_name text NOT NULL,
  ban_order integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.map_bans ENABLE ROW LEVEL SECURITY;

-- RLS: match participants can view bans
CREATE POLICY "Match participants can view map bans" ON public.map_bans
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM match_players WHERE match_players.match_id = map_bans.match_id AND match_players.user_id = auth.uid()
  ));

-- RLS: match participants can insert bans
CREATE POLICY "Match participants can insert map bans" ON public.map_bans
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = player_id AND EXISTS (
    SELECT 1 FROM match_players WHERE match_players.match_id = map_bans.match_id AND match_players.user_id = auth.uid()
  ));

-- Add banned_maps and final_map columns to matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS banned_maps text[] DEFAULT '{}';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS final_map text;

-- Enable realtime for map_bans
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_bans;
