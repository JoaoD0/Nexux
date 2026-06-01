import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth validation
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Token de autenticação ausente" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return jsonResponse({ error: "Token inválido ou expirado" }, 401);
  }

  const userId = claimsData.claims.sub as string;

  // Parse route from URL
  const url = new URL(req.url);
  const route = url.pathname.split("/").pop() || "";

  try {
    switch (route) {
      // GET /electron-api/profile — retorna perfil do usuário autenticado
      case "profile": {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .single();
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ profile: data });
      }

      // GET /electron-api/leaderboard?limit=50 — top jogadores
      case "leaderboard": {
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const { data, error } = await supabase
          .from("profiles")
          .select("nickname, elo_points, wins, losses, kills, deaths, avatar_url, region")
          .order("elo_points", { ascending: false })
          .limit(Math.min(limit, 100));
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ leaderboard: data });
      }

      // GET /electron-api/matches — histórico de partidas do usuário
      case "matches": {
        const { data, error } = await supabase
          .from("match_players")
          .select(`
            match_id, team, kills, deaths, assists, elo_before, elo_after, result,
            matches:match_id (id, map_name, status, created_at, finished_at, team1_avg_elo, team2_avg_elo)
          `)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ matches: data });
      }

      // GET /electron-api/queue-status — status atual da fila
      case "queue-status": {
        const { data, error } = await supabase
          .from("queue")
          .select("user_id, elo, joined_at, status");
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ queue: data, count: data?.length || 0 });
      }

      // GET /electron-api/match/:id — detalhes de uma partida específica (via query param)
      case "match-detail": {
        const matchId = url.searchParams.get("id");
        if (!matchId) return jsonResponse({ error: "id é obrigatório" }, 400);

        const [matchRes, playersRes] = await Promise.all([
          supabase.from("matches").select("*").eq("id", matchId).single(),
          supabase
            .from("match_players")
            .select("user_id, team, kills, deaths, assists, elo_before, elo_after, result")
            .eq("match_id", matchId),
        ]);

        if (matchRes.error) return jsonResponse({ error: matchRes.error.message }, 400);
        return jsonResponse({ match: matchRes.data, players: playersRes.data });
      }

      default:
        return jsonResponse(
          {
            error: "Rota não encontrada",
            available_routes: [
              "profile",
              "leaderboard",
              "matches",
              "queue-status",
              "match-detail",
            ],
          },
          404
        );
    }
  } catch (err) {
    console.error("Electron API error:", err);
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  }
});
