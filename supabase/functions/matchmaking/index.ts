import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Valorant-style constants ----------

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

const VALORANT_MAPS = [
  "Ascent", "Bind", "Haven", "Split", "Icebox",
  "Breeze", "Fracture", "Pearl", "Lotus", "Sunset", "Abyss", "Corrode",
];

const AGENTS = [
  "Jett", "Reyna", "Raze", "Phoenix", "Yoru", "Neon", "Iso",
  "Sova", "Breach", "Skye", "KAY/O", "Fade", "Gekko",
  "Omen", "Brimstone", "Astra", "Viper", "Harbor", "Clove",
  "Killjoy", "Cypher", "Sage", "Chamber", "Deadlock", "Vyse",
];

const NICKNAMES = [
  "ShadowBR", "xKnight", "NexusPT", "VortexGG", "CyberFox",
  "BlazeFury", "StormR1der", "NightOwl", "PhantomAce", "IronWolf",
  "PixelD3mon", "NovaStrike", "AxeL_Pro", "DarkMist", "RushKing",
  "ZenithX", "ByteForce", "FrostBite", "TurboNinja", "SteelClaw",
  "LunarEcho", "CosmicRay", "ViperSnap", "ChronoShift", "HexBlade",
  "RiftWalker", "GhostPulse", "EmberSoul", "QuantumX", "OnyxStar",
  "VoidHunter", "MistRaven", "ThunderGrip", "SparkWire", "WarpDrive",
  "CrimsonBolt", "SilverFang", "GoldRush", "PlatinumEdge", "DiamondCut",
];

// ---------- Helpers ----------

function getRank(elo: number) {
  const tier = RANK_TIERS.find((t) => elo >= t.min && elo <= t.max) ?? RANK_TIERS[0];
  const division = Math.min(3, Math.floor((elo - tier.min) / ((tier.max - tier.min + 1) / 3)) + 1);
  return { rank: tier.name, division };
}

function randomBetween(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePlayer(targetElo: number, range: number) {
  const elo = Math.max(0, targetElo + randomBetween(-range, range));
  const { rank, division } = getRank(elo);
  const totalGames = randomBetween(50, 500);
  const winRate = 0.4 + Math.random() * 0.2;
  const wins = Math.round(totalGames * winRate);
  const losses = totalGames - wins;
  const avgKills = 10 + Math.random() * 15;
  const kills = Math.round(avgKills * totalGames);
  const deaths = Math.round((avgKills / (0.8 + Math.random() * 0.8)) * totalGames);

  return {
    id: crypto.randomUUID(),
    nickname: pickRandom(NICKNAMES) + randomBetween(1, 999),
    avatar_url: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${crypto.randomUUID()}`,
    elo_points: elo,
    rank,
    division,
    wins,
    losses,
    kills,
    deaths,
    agent: pickRandom(AGENTS),
    region: "BR",
  };
}

function balanceTeams(players: ReturnType<typeof generatePlayer>[]) {
  const sorted = [...players].sort((a, b) => b.elo_points - a.elo_points);
  const team1: typeof players = [];
  const team2: typeof players = [];
  let sum1 = 0, sum2 = 0;

  for (const p of sorted) {
    if (team1.length >= 5) { team2.push(p); sum2 += p.elo_points; }
    else if (team2.length >= 5) { team1.push(p); sum1 += p.elo_points; }
    else if (sum1 <= sum2) { team1.push(p); sum1 += p.elo_points; }
    else { team2.push(p); sum2 += p.elo_points; }
  }

  return {
    team1: team1.sort((a, b) => b.elo_points - a.elo_points),
    team2: team2.sort((a, b) => b.elo_points - a.elo_points),
    team1_avg_elo: Math.round(sum1 / team1.length),
    team2_avg_elo: Math.round(sum2 / team2.length),
    elo_diff: Math.abs(sum1 - sum2),
  };
}

function getBalanceLabel(diff: number) {
  if (diff < 50) return "PERFEITO";
  if (diff < 200) return "JUSTO";
  if (diff < 400) return "ACEITÁVEL";
  return "DESEQUILIBRADO";
}

function calculateEloChange(playerElo: number, teamAvg: number, oppAvg: number, result: "win" | "loss") {
  const expected = 1 / (1 + Math.pow(10, (oppAvg - teamAvg) / 400));
  const actual = result === "win" ? 1 : 0;
  return Math.round(32 * (actual - expected));
}

// ---------- Route handlers ----------

type Handler = (body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) => Promise<Response>;

const findMatch: Handler = async (body, supabase) => {
  const playerElo = typeof body.elo === "number" ? body.elo : 1000;
  const queueDuration = typeof body.queue_seconds === "number" ? (body.queue_seconds as number) : randomBetween(15, 120);
  const userId = body.user_id as string | undefined;

  let range: number;
  let quality: string;
  if (queueDuration <= 120) { range = 100; quality = "Match Perfeito"; }
  else if (queueDuration <= 300) { range = 250; quality = "Match Bom"; }
  else { range = 500; quality = "Match Aceitável"; }

  const bots = Array.from({ length: 9 }, () => generatePlayer(playerElo, range));

  const caller = {
    id: userId ?? crypto.randomUUID(),
    nickname: (body.nickname as string) ?? "Você",
    avatar_url: (body.avatar_url as string) ?? `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=caller`,
    elo_points: playerElo,
    ...getRank(playerElo),
    wins: 0, losses: 0, kills: 0, deaths: 0,
    agent: pickRandom(AGENTS),
    region: "BR",
  };

  const allPlayers = [caller, ...bots];
  const balanced = balanceTeams(allPlayers);

  const assignAgents = (team: typeof allPlayers) => {
    const used = new Set<string>();
    return team.map((p) => {
      let agent = p.agent;
      while (used.has(agent)) agent = pickRandom(AGENTS);
      used.add(agent);
      return { ...p, agent };
    });
  };
  balanced.team1 = assignAgents(balanced.team1);
  balanced.team2 = assignAgents(balanced.team2);

  const map = pickRandom(VALORANT_MAPS);
  const serverIp = `${randomBetween(1, 255)}.${randomBetween(1, 255)}.${randomBetween(1, 255)}.${randomBetween(1, 255)}:7000`;
  const serverPassword = Math.random().toString(36).substring(2, 8).toUpperCase();

  let matchId: string | null = null;
  try {
    const avg1 = balanced.team1_avg_elo;
    const avg2 = balanced.team2_avg_elo;

    const { data: matchRow, error: matchErr } = await supabase.from("matches").insert({
      map_name: map,
      server_ip: serverIp,
      server_password: serverPassword,
      status: "lobby",
      team1_avg_elo: avg1,
      team2_avg_elo: avg2,
      source: "matchmaking",
    }).select("id").single();

    if (matchErr) {
      console.error("Failed to create match:", matchErr);
    } else if (matchRow) {
      matchId = matchRow.id;

      const playerRows = [
        ...balanced.team1.map((p) => ({ match_id: matchRow.id, user_id: p.id, team: 1, elo_before: p.elo_points })),
        ...balanced.team2.map((p) => ({ match_id: matchRow.id, user_id: p.id, team: 2, elo_before: p.elo_points })),
      ];
      const { error: playersErr } = await supabase.from("match_players").insert(playerRows);
      if (playersErr) console.error("Failed to insert match_players:", playersErr);
    }
  } catch (e) {
    console.error("DB insert error:", e);
  }

  return new Response(
    JSON.stringify({
      match_id: matchId ?? crypto.randomUUID(),
      map,
      server: { ip: serverIp, password: serverPassword },
      queue: { duration_seconds: queueDuration, quality, elo_range: { min: playerElo - range, max: playerElo + range } },
      balance: { label: getBalanceLabel(balanced.elo_diff), elo_diff: balanced.elo_diff },
      team1: { players: balanced.team1, avg_elo: balanced.team1_avg_elo },
      team2: { players: balanced.team2, avg_elo: balanced.team2_avg_elo },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
};

// POST /matchmaking { action: "find_x1_match", user_id }
// Searches the queue table for 2 real players with mode=x1, creates 1v1 match
const findX1Match: Handler = async (body, supabase) => {
  const userId = body.user_id as string;
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "user_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Find 2 real players in the x1 queue
  const { data: queuePlayers, error: queueErr } = await supabase
    .from("queue")
    .select("user_id, elo")
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

  if (!queuePlayers || queuePlayers.length < 2) {
    return new Response(
      JSON.stringify({ status: "waiting", message: "Aguardando outro jogador na fila X1", players_in_queue: queuePlayers?.length ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const p1UserId = queuePlayers[0].user_id;
  const p2UserId = queuePlayers[1].user_id;
  const p1Elo = queuePlayers[0].elo;
  const p2Elo = queuePlayers[1].elo;

  // Load profiles for both players
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("user_id, nickname, avatar_url, elo_x1, riot_puuid, region")
    .in("user_id", [p1UserId, p2UserId]);

  if (profilesErr || !profiles || profiles.length < 2) {
    console.error("Profiles query error:", profilesErr);
    return new Response(
      JSON.stringify({ error: "Failed to load player profiles" }),
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
    return new Response(
      JSON.stringify({ error: "Failed to create match" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const matchId = matchRow.id;

  // Insert 2 real players into match_players
  const { error: playersErr } = await supabase.from("match_players").insert([
    { match_id: matchId, user_id: p1UserId, team: 1, elo_before: p1Profile.elo_x1 },
    { match_id: matchId, user_id: p2UserId, team: 2, elo_before: p2Profile.elo_x1 },
  ]);
  if (playersErr) console.error("Failed to insert X1 match_players:", playersErr);

  // Update queue status to 'matched'
  await supabase
    .from("queue")
    .update({ status: "matched" })
    .in("user_id", [p1UserId, p2UserId])
    .eq("mode", "x1");

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
};

// POST /matchmaking { action: "simulate_result", player_elo, team_avg, opp_avg, result }
const simulateResult: Handler = async (body) => {
  const playerElo = (body.player_elo as number) ?? 1000;
  const teamAvg = (body.team_avg as number) ?? 1000;
  const oppAvg = (body.opp_avg as number) ?? 1000;
  const result = (body.result as "win" | "loss") ?? "win";

  const eloChange = calculateEloChange(playerElo, teamAvg, oppAvg, result);
  const newElo = Math.max(0, playerElo + eloChange);

  return new Response(
    JSON.stringify({
      result,
      elo_before: playerElo,
      elo_change: eloChange,
      elo_after: newElo,
      rank_before: getRank(playerElo),
      rank_after: getRank(newElo),
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
};

const simulateMatch: Handler = async (body) => {
  const playerElo = (body.elo as number) ?? 1000;
  const result = (body.result as "win" | "loss") ?? (Math.random() > 0.5 ? "win" : "loss");
  const queueDuration = randomBetween(15, 180);

  let range: number;
  let quality: string;
  if (queueDuration <= 120) { range = 100; quality = "Match Perfeito"; }
  else if (queueDuration <= 300) { range = 250; quality = "Match Bom"; }
  else { range = 500; quality = "Match Aceitável"; }

  const bots = Array.from({ length: 9 }, () => generatePlayer(playerElo, range));
  const caller = {
    id: crypto.randomUUID(),
    nickname: (body.nickname as string) ?? "Você",
    avatar_url: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=caller`,
    elo_points: playerElo,
    ...getRank(playerElo),
    wins: 0, losses: 0, kills: 0, deaths: 0,
    agent: pickRandom(AGENTS),
    region: "BR",
  };

  const balanced = balanceTeams([caller, ...bots]);
  const map = pickRandom(VALORANT_MAPS);

  const simulateStats = (team: typeof bots, won: boolean) =>
    team.map((p) => {
      const kills = randomBetween(won ? 8 : 3, won ? 30 : 20);
      const deaths = randomBetween(won ? 3 : 8, won ? 18 : 25);
      const assists = randomBetween(1, 12);
      return { ...p, kills_game: kills, deaths_game: deaths, assists_game: assists };
    });

  const callerTeam = balanced.team1.find((p) => p.id === caller.id) ? 1 : 2;
  const team1Won = callerTeam === 1 ? result === "win" : result === "loss";

  const team1Stats = simulateStats(balanced.team1, team1Won);
  const team2Stats = simulateStats(balanced.team2, !team1Won);

  const eloChange = calculateEloChange(
    playerElo,
    callerTeam === 1 ? balanced.team1_avg_elo : balanced.team2_avg_elo,
    callerTeam === 1 ? balanced.team2_avg_elo : balanced.team1_avg_elo,
    result,
  );

  const winnerRounds = 13;
  const loserRounds = randomBetween(0, 12);

  return new Response(
    JSON.stringify({
      match_id: crypto.randomUUID(),
      map,
      result,
      score: team1Won
        ? { team1: winnerRounds, team2: loserRounds }
        : { team1: loserRounds, team2: winnerRounds },
      queue: { duration_seconds: queueDuration, quality },
      balance: { label: getBalanceLabel(balanced.elo_diff), elo_diff: balanced.elo_diff },
      elo: { before: playerElo, change: eloChange, after: Math.max(0, playerElo + eloChange) },
      team1: { avg_elo: balanced.team1_avg_elo, players: team1Stats, won: team1Won },
      team2: { avg_elo: balanced.team2_avg_elo, players: team2Stats, won: !team1Won },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
};

// ---------- Main ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const action = (body.action as string) ?? "find_match";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (action) {
      case "find_match":
        return await findMatch(body, supabase);
      case "find_x1_match":
        return await findX1Match(body, supabase);
      case "simulate_result":
        return await simulateResult(body, supabase);
      case "simulate_match":
        return await simulateMatch(body, supabase);
      default:
        return new Response(
          JSON.stringify({
            error: "Unknown action",
            available_actions: ["find_match", "find_x1_match", "simulate_result", "simulate_match"],
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
