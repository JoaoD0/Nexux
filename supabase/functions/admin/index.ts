import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    // Client with user's auth to check role
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for admin operations
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Check if user is admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    let result: any = null;

    switch (action) {
      // ── DASHBOARD STATS ──
      case "dashboard_stats": {
        const { count: totalPlayers } = await admin.from("profiles").select("*", { count: "exact", head: true });
        const { count: totalMatches } = await admin.from("matches").select("*", { count: "exact", head: true });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);

        const { count: matchesToday } = await admin
          .from("matches")
          .select("*", { count: "exact", head: true })
          .gte("created_at", todayStart.toISOString());

        const { count: matchesWeek } = await admin
          .from("matches")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekStart.toISOString());

        const { count: activeMatches } = await admin
          .from("matches")
          .select("*", { count: "exact", head: true })
          .in("status", ["lobby", "in_progress"]);

        const { count: playersInQueue } = await admin
          .from("queue")
          .select("*", { count: "exact", head: true });

        // Matches per day (last 7 days)
        const { data: recentMatches } = await admin
          .from("matches")
          .select("created_at")
          .gte("created_at", weekStart.toISOString())
          .order("created_at", { ascending: true });

        const matchesByDay: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          matchesByDay[d.toISOString().split("T")[0]] = 0;
        }
        (recentMatches ?? []).forEach((m: any) => {
          const day = m.created_at.split("T")[0];
          if (matchesByDay[day] !== undefined) matchesByDay[day]++;
        });

        result = {
          totalPlayers: totalPlayers ?? 0,
          totalMatches: totalMatches ?? 0,
          matchesToday: matchesToday ?? 0,
          matchesWeek: matchesWeek ?? 0,
          activeMatches: activeMatches ?? 0,
          playersOnline: playersInQueue ?? 0,
          matchesByDay: Object.entries(matchesByDay).map(([date, count]) => ({ date, count })),
        };
        break;
      }

      // ── LIST PLAYERS ──
      case "list_players": {
        const { search, page = 1, per_page = 20 } = body;
        let query = admin.from("profiles").select("*", { count: "exact" });
        if (search) {
          query = query.or(`nickname.ilike.%${search}%`);
        }
        const from = (page - 1) * per_page;
        const { data, count } = await query
          .order("elo_points", { ascending: false })
          .range(from, from + per_page - 1);

        // Get emails from auth
        const userIds = (data ?? []).map((p: any) => p.user_id);
        const emails: Record<string, string> = {};
        for (const uid of userIds) {
          const { data: { user: u } } = await admin.auth.admin.getUserById(uid);
          if (u) emails[uid] = u.email ?? "";
        }

        result = {
          players: (data ?? []).map((p: any) => ({ ...p, email: emails[p.user_id] ?? "" })),
          total: count ?? 0,
          page,
          per_page,
        };
        break;
      }

      // ── BAN PLAYER ──
      case "ban_player": {
        const { user_id } = body;
        await admin.from("profiles").update({ banned: true }).eq("user_id", user_id);
        result = { success: true };
        break;
      }

      // ── UNBAN PLAYER ──
      case "unban_player": {
        const { user_id } = body;
        await admin.from("profiles").update({ banned: false }).eq("user_id", user_id);
        result = { success: true };
        break;
      }

      // ── PROMOTE TO ADMIN ──
      case "promote_admin": {
        const { user_id } = body;
        await admin.from("user_roles").upsert({ user_id, role: "admin" }, { onConflict: "user_id,role" });
        result = { success: true };
        break;
      }

      // ── REMOVE ADMIN ──
      case "remove_admin": {
        const { user_id } = body;
        await admin.from("user_roles").delete().eq("user_id", user_id).eq("role", "admin");
        result = { success: true };
        break;
      }

      // ── RESET ELO ──
      case "reset_elo": {
        const { user_id } = body;
        await admin.from("profiles").update({ elo_points: 1000 }).eq("user_id", user_id);
        result = { success: true };
        break;
      }

      // ── LIST MATCHES ──
      case "list_matches": {
        const { status_filter, page = 1, per_page = 20 } = body;
        let query = admin.from("matches").select("*, match_players(*)", { count: "exact" });
        if (status_filter && status_filter !== "all") {
          query = query.eq("status", status_filter);
        }
        const from = (page - 1) * per_page;
        const { data, count } = await query
          .order("created_at", { ascending: false })
          .range(from, from + per_page - 1);

        // Enrich with player nicknames
        const allUserIds = new Set<string>();
        (data ?? []).forEach((m: any) => m.match_players?.forEach((mp: any) => allUserIds.add(mp.user_id)));
        const { data: profiles } = await admin.from("profiles").select("user_id, nickname, avatar_url").in("user_id", [...allUserIds]);
        const profileMap: Record<string, any> = {};
        (profiles ?? []).forEach((p: any) => { profileMap[p.user_id] = p; });

        result = {
          matches: (data ?? []).map((m: any) => ({
            ...m,
            match_players: (m.match_players ?? []).map((mp: any) => ({
              ...mp,
              nickname: profileMap[mp.user_id]?.nickname ?? "Unknown",
              avatar_url: profileMap[mp.user_id]?.avatar_url ?? "",
            })),
          })),
          total: count ?? 0,
          page,
          per_page,
        };
        break;
      }

      // ── CANCEL MATCH ──
      case "cancel_match": {
        const { match_id } = body;
        await admin.from("matches").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", match_id);
        result = { success: true };
        break;
      }

      // ── FORCE RESULT ──
      case "force_result": {
        const { match_id, winning_team } = body;
        // Get match players
        const { data: players } = await admin.from("match_players").select("*").eq("match_id", match_id);
        if (!players || players.length === 0) {
          return new Response(JSON.stringify({ error: "No players in match" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        for (const mp of players) {
          const playerResult = mp.team === winning_team ? "win" : "loss";
          const eloChange = playerResult === "win" ? 25 : -25;
          const { data: profile } = await admin.from("profiles").select("elo_points, wins, losses").eq("user_id", mp.user_id).single();
          if (!profile) continue;
          const newElo = Math.max(0, profile.elo_points + eloChange);

          await admin.from("match_players").update({
            result: playerResult,
            elo_after: newElo,
          }).eq("id", mp.id);

          await admin.from("profiles").update({
            elo_points: newElo,
            wins: playerResult === "win" ? profile.wins + 1 : profile.wins,
            losses: playerResult === "loss" ? profile.losses + 1 : profile.losses,
          }).eq("user_id", mp.user_id);
        }

        await admin.from("matches").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", match_id);
        result = { success: true };
        break;
      }

      // ── LIST REPORTS ──
      case "list_reports": {
        const { status_filter, page = 1, per_page = 20 } = body;
        let query = admin.from("reports").select("*", { count: "exact" });
        if (status_filter && status_filter !== "all") {
          query = query.eq("status", status_filter);
        }
        const from = (page - 1) * per_page;
        const { data, count } = await query
          .order("created_at", { ascending: false })
          .range(from, from + per_page - 1);

        // Get nicknames
        const ids = new Set<string>();
        (data ?? []).forEach((r: any) => { ids.add(r.reporter_id); ids.add(r.reported_id); });
        const { data: profiles } = await admin.from("profiles").select("user_id, nickname").in("user_id", [...ids]);
        const nickMap: Record<string, string> = {};
        (profiles ?? []).forEach((p: any) => { nickMap[p.user_id] = p.nickname; });

        result = {
          reports: (data ?? []).map((r: any) => ({
            ...r,
            reporter_nickname: nickMap[r.reporter_id] ?? "Unknown",
            reported_nickname: nickMap[r.reported_id] ?? "Unknown",
          })),
          total: count ?? 0,
          page,
          per_page,
        };
        break;
      }

      // ── UPDATE REPORT ──
      case "update_report": {
        const { report_id, status } = body;
        await admin.from("reports").update({ status }).eq("id", report_id);
        result = { success: true };
        break;
      }

      // ── GET SETTINGS ──
      case "get_settings": {
        const { data } = await admin.from("platform_settings").select("*");
        const settings: Record<string, string> = {};
        (data ?? []).forEach((s: any) => { settings[s.key] = s.value; });
        result = { settings };
        break;
      }

      // ── UPDATE SETTINGS ──
      case "update_settings": {
        const { settings } = body;
        for (const [key, value] of Object.entries(settings as Record<string, string>)) {
          await admin.from("platform_settings").upsert(
            { key, value, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );
        }
        result = { success: true };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin function error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
