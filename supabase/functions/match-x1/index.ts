import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RANK_TIERS = [
  { name: "Iron", min: 0, max: 399 },
  { name: "Bronze", min: 400, max: 799 },
  { name: "Silver", min: 800, max: 1199 },
  { name: "Gold", min: 1200, max: 1599 },
  { name: "Platinum", min: 1600, max: 1999 },
  { name: "Diamond", min: 2000, max: 2399 },
  { name: "Ascendant", min: 2400, max: 2799 },
  { name: "Immortal", min: 2800, max: 3199 },
  { name: "Radiant", min: 3200, max: 9999 },
];

function getRank(elo: number) {
  const tier = RANK_TIERS.find((t) => elo >= t.min && elo <= t.max) ?? RANK_TIERS[0];
  const division = Math.min(3, Math.floor((elo - tier.min) / ((tier.max - tier.min + 1) / 3)) + 1);
  return { rank: tier.name, division };
}

function randomBetween(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { player_id } = await req.json();

    if (!player_id) {
      return new Response(
        JSON.stringify({ error: "player_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find 2 players in the x1 queue with status 'searching'
    const { data: playersWaiting, error: queueErr } = await supabase
      .from("queue")
      .select("user_id, elo, status")
      .eq("mode", "x1")
      .eq("status", "searching")
      .order("joined_at", { ascending: true })
      .limit(2);

    if (queueErr) {
      console.error("Queue query error:", queueErr);
      return new Response(
        JSON.stringify({ error: "Failed to query queue" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!playersWaiting || playersWaiting.length < 2) {
      return new Response(
        JSON.stringify({ status: "waiting", players_in_queue: playersWaiting?.length ?? 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const p1UserId = playersWaiting[0].user_id;
    const p2UserId = playersWaiting[1].user_id;

    // Atomically update status to 'matched' — only if still 'searching'
    const { data: updated, error: updateErr } = await supabase
      .from("queue")
      .update({ status: "matched" })
      .in("user_id", [p1UserId, p2UserId])
      .eq("status", "searching")
      .eq("mode", "x1")
      .select("user_id");

    if (updateErr || !updated || updated.length < 2) {
      // Race condition — another call already matched them
      return new Response(
        JSON.stringify({ status: "waiting", players_in_queue: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load profiles
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("user_id, nickname, avatar_url, elo_x1, riot_puuid, region")
      .in("user_id", [p1UserId, p2UserId]);

    if (profilesErr || !profiles || profiles.length < 2) {
      console.error("Profiles query error:", profilesErr);
      // Rollback queue status
      await supabase
        .from("queue")
        .update({ status: "searching" })
        .in("user_id", [p1UserId, p2UserId]);
      return new Response(
        JSON.stringify({ error: "Failed to load profiles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const p1Profile = profiles.find((p: any) => p.user_id === p1UserId)!;
    const p2Profile = profiles.find((p: any) => p.user_id === p2UserId)!;

    const serverIp = `${randomBetween(1, 255)}.${randomBetween(1, 255)}.${randomBetween(1, 255)}.${randomBetween(1, 255)}:7000`;
    const serverPassword = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create the match
    const { data: matchRow, error: matchErr } = await supabase.from("matches").insert({
      map_name: "TBD",
      server_ip: serverIp,
      server_password: serverPassword,
      status: "banning",
      team1_avg_elo: p1Profile.elo_x1,
      team2_avg_elo: p2Profile.elo_x1,
      source: "matchmaking",
      mode: "x1",
      banned_maps: [],
    }).select("id").single();

    if (matchErr || !matchRow) {
      console.error("Failed to create X1 match:", matchErr);
      // Rollback queue status
      await supabase
        .from("queue")
        .update({ status: "searching" })
        .in("user_id", [p1UserId, p2UserId]);
      return new Response(
        JSON.stringify({ error: "Failed to create match" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const matchId = matchRow.id;

    // Insert 2 real players
    const { error: playersErr } = await supabase.from("match_players").insert([
      { match_id: matchId, user_id: p1UserId, team: 1, elo_before: p1Profile.elo_x1 },
      { match_id: matchId, user_id: p2UserId, team: 2, elo_before: p2Profile.elo_x1 },
    ]);
    if (playersErr) console.error("Failed to insert X1 match_players:", playersErr);

    const makePlayerPayload = (profile: any) => {
      const { rank, division } = getRank(profile.elo_x1);
      return {
        id: profile.user_id,
        nickname: profile.nickname,
        avatar_url: profile.avatar_url,
        elo_x1: profile.elo_x1,
        elo_points: profile.elo_x1,
        riot_puuid: profile.riot_puuid,
        rank,
        division,
        region: profile.region ?? "BR",
      };
    };

    const player1 = makePlayerPayload(p1Profile);
    const player2 = makePlayerPayload(p2Profile);

    return new Response(
      JSON.stringify({
        status: "matched",
        match_id: matchId,
        mode: "x1",
        server: { ip: serverIp, password: serverPassword },
        player1,
        player2,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("match-x1 error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
