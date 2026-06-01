import { Layout } from "@/components/Layout";
import { RankBadge } from "@/components/RankBadge";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X, Users, Shield, Clock, Crosshair, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MatchFoundModal } from "@/components/MatchFoundModal";
import { useToast } from "@/hooks/use-toast";
import type { Player } from "@/lib/mockData";

// Shape returned by the edge function
interface ApiPlayer {
  id: string;
  nickname: string;
  avatar_url: string;
  elo_points: number;
  rank: string;
  division: number;
  agent: string;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  region: string;
}

interface FindMatchResponse {
  match_id: string;
  map: string;
  server: { ip: string; password: string };
  queue: { duration_seconds: number; quality: string; elo_range: { min: number; max: number } };
  balance: { label: string; elo_diff: number };
  team1: { players: ApiPlayer[]; avg_elo: number };
  team2: { players: ApiPlayer[]; avg_elo: number };
}

function apiPlayerToPlayer(p: ApiPlayer): Player {
  return {
    id: p.id,
    nickname: p.nickname,
    avatar_url: p.avatar_url,
    elo_points: p.elo_points,
    rank: p.rank as Player["rank"],
    division: p.division as Player["division"],
    wins: p.wins,
    losses: p.losses,
    kills: p.kills,
    deaths: p.deaths,
    region: p.region,
  };
}

// Queue range display (mirrors backend logic)
function getQueueLabel(elapsed: number) {
  if (elapsed <= 120) return { range: 100, label: "Match Perfeito" };
  if (elapsed <= 300) return { range: 250, label: "Match Bom" };
  return { range: 500, label: "Match Aceitável" };
}

export default function Queue() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { toast } = useToast();

  const queueMode = searchParams.get("mode") ?? "5v5";
  const isX1 = queueMode === "x1";
  const inviteId = searchParams.get("invite_id");
  const friendName = searchParams.get("friend");

  const [elapsed, setElapsed] = useState(0);
  const [simulatedPlayers, setSimulatedPlayers] = useState(0);
  const [matchFound, setMatchFound] = useState(false);
  const [matchData, setMatchData] = useState<{ team1: Player[]; team2: Player[]; diff: number } | null>(null);
  const [serverInfo, setServerInfo] = useState<{ ip: string; password: string; map: string } | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchTriggered = useRef(false);
  const lobbyChannelRef = useRef<any>(null);

  const playerElo = isX1 ? (profile?.elo_x1 ?? 1000) : (profile?.elo_points ?? 1000);
  const queueInfo = getQueueLabel(elapsed);

  // PROBLEM 2 FIX: Subscribe to lobby-events BEFORE entering queue
  useEffect(() => {
    if (!isX1 || !user) return;

    const channel = supabase
      .channel('lobby-events')
      .on('broadcast', { event: 'match_found' }, ({ payload }) => {
        if (matchTriggered.current) return;
        // Check if this match involves us
        const isInTeam1 = payload.team1?.some((p: any) => p.user_id === user.id);
        const isInTeam2 = payload.team2?.some((p: any) => p.user_id === user.id);
        if (isInTeam1 || isInTeam2) {
          matchTriggered.current = true;
          navigate(`/match/${payload.match_id}/ban`);
        }
      })
      .subscribe();

    lobbyChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      lobbyChannelRef.current = null;
    };
  }, [isX1, user, navigate]);

  // Validate before joining queue
  useEffect(() => {
    if (!profile || !user) return;

    if (isX1 && !profile.riot_puuid) {
      setValidationError("Cadastre seu PUUID Riot no perfil antes de entrar na fila X1.");
      return;
    }

    if (profile.banned) {
      setValidationError("Sua conta está banida. Você não pode entrar na fila.");
      return;
    }

    setValidationError(null);

    if (isX1) {
      joinX1Queue();
    }
  }, [profile, user, isX1]);

  // Timer
  useEffect(() => {
    intervalRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // For 5v5 mode: simulate players joining the queue gradually (existing behavior)
  useEffect(() => {
    if (isX1 || matchFound) return;
    const simInterval = setInterval(() => {
      setSimulatedPlayers((prev) => {
        const next = prev + (Math.random() > 0.3 ? 1 : 0);
        return Math.min(next, 9);
      });
    }, 2000 + Math.random() * 2000);
    return () => clearInterval(simInterval);
  }, [matchFound, isX1]);

  // For 5v5: When enough simulated players reached, call the backend API
  useEffect(() => {
    if (isX1) return;
    if (simulatedPlayers >= 9 && !matchTriggered.current && !matchFound && profile) {
      matchTriggered.current = true;
      callMatchmakingApi();
    }
  }, [simulatedPlayers, matchFound, profile, isX1]);

  // Join X1 queue and immediately try to match via RPC (no Edge Function)
  const joinX1Queue = useCallback(async () => {
    if (!user || !profile || inQueue || validationError) return;
    if (!profile.elo_x1) return;

    // Check if already in queue or active match
    const { data: existingQueue } = await supabase
      .from("queue")
      .select("user_id, status")
      .eq("user_id", user.id)
      .in("status", ["searching", "matched"]);

    if (existingQueue && existingQueue.length > 0) {
      const matched = existingQueue.find((q) => q.status === "matched");
      if (matched) {
        // Check for active match
        const { data: activeMatch } = await supabase
          .from("match_players")
          .select("match_id, matches(id, status, mode)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (activeMatch?.[0]) {
          const match = (activeMatch[0] as any).matches;
          if (match && match.mode === "x1" && (match.status === "banning" || match.status === "lobby")) {
            navigate(`/match/${match.id}/ban`);
            return;
          }
        }
      }

      // Remove old queue entry first
      await supabase.from("queue").delete().eq("user_id", user.id);
    }

    // Check for active x1 match
    const { data: activeMp } = await supabase
      .from("match_players")
      .select("match_id, matches(id, status, mode)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (activeMp?.[0]) {
      const match = (activeMp[0] as any).matches;
      if (match && match.mode === "x1" && (match.status === "banning" || match.status === "lobby")) {
        navigate(`/match/${match.id}/ban`);
        return;
      }
    }

    // Join the queue
    const { error } = await supabase.from("queue").insert({
      user_id: user.id,
      elo: profile.elo_x1,
      mode: "x1",
      status: "searching",
      ...(inviteId ? { invite_id: inviteId } : {}),
    } as any);

    if (error) {
      console.error("Failed to join queue:", error);
      toast({ title: "Erro", description: "Falha ao entrar na fila.", variant: "destructive" });
      return;
    }

    setInQueue(true);

    // PROBLEM 1 FIX: Use RPC instead of Edge Function — no cold start
    try {
      const { data, error: rpcErr } = await supabase.rpc("try_match_x1", {
        p_player_id: user.id,
        p_invite_id: inviteId ?? null,
      } as any);

      if (rpcErr) {
        console.error("try_match_x1 RPC error:", rpcErr);
        return;
      }

      const result = data as any;

      if (result && result.status === "matched" && result.match_id) {
        matchTriggered.current = true;

        // Fetch both players' profiles for broadcast
        const { data: players } = await supabase
          .from("profiles")
          .select("user_id, nickname, avatar_url, elo_x1, riot_puuid, region")
          .in("user_id", [user.id, result.opponent_id]);

        if (players && players.length === 2) {
          const captain = players.find((p) => p.user_id === user.id);
          const opponent = players.find((p) => p.user_id === result.opponent_id);

          // Broadcast immediately so the opponent gets notified
          await supabase.channel("lobby-events").send({
            type: "broadcast",
            event: "match_found",
            payload: {
              match_id: result.match_id,
              mode: "x1",
              captain_puuid: captain?.riot_puuid,
              team1: [captain],
              team2: [opponent],
            },
          });
        }

        // Navigate to map ban
        navigate(`/match/${result.match_id}/ban`);
        return;
      }
    } catch (err) {
      console.error("try_match_x1 error:", err);
    }

    // Not matched yet — the opponent will call try_match_x1 when they join
    // and we'll get notified via the lobby-events broadcast (already subscribed above)
  }, [user, profile, inQueue, validationError, navigate, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Remove from queue on unmount if not matched
      if (user && inQueue && !matchTriggered.current) {
        supabase.from("queue").delete().eq("user_id", user.id).then(() => {});
      }
    };
  }, [user, inQueue]);

  const callMatchmakingApi = useCallback(async () => {
    if (!user || !profile) return;

    try {
      const { data, error } = await supabase.functions.invoke<FindMatchResponse>("matchmaking", {
        body: {
          action: "find_match",
          elo: profile.elo_points,
          queue_seconds: elapsed,
          user_id: user.id,
          nickname: profile.nickname,
          avatar_url: profile.avatar_url,
        },
      });

      if (error || !data) {
        console.error("Matchmaking API error:", error);
        matchTriggered.current = false;
        return;
      }

      const team1 = data.team1.players.map(apiPlayerToPlayer);
      const team2 = data.team2.players.map(apiPlayerToPlayer);

      setMatchData({ team1, team2, diff: data.balance.elo_diff });
      setServerInfo({ ip: data.server.ip, password: data.server.password, map: data.map });
      setMatchFound(true);
      setMatchId(data.match_id);
      if (intervalRef.current) clearInterval(intervalRef.current);

      const captainPlayer = team1.reduce((max, p) => (p.elo_points > max.elo_points ? p : max), team1[0]);
      const { data: captainProfile } = await supabase
        .from("profiles")
        .select("riot_puuid")
        .eq("user_id", captainPlayer.id)
        .maybeSingle();

      const captainPuuid = (captainProfile as any)?.riot_puuid ?? null;

      const lobbyChannel = supabase.channel("lobby-events");
      await lobbyChannel.send({
        type: "broadcast",
        event: "match_found",
        payload: {
          match_id: data.match_id,
          map: data.map,
          captain_puuid: captainPuuid,
          server_ip: data.server.ip,
          server_password: data.server.password,
          team1_avg_elo: data.team1.avg_elo,
          team2_avg_elo: data.team2.avg_elo,
          team1: team1.map(p => ({ id: p.id, nickname: p.nickname })),
          team2: team2.map(p => ({ id: p.id, nickname: p.nickname })),
        },
      });
      supabase.removeChannel(lobbyChannel);
    } catch (err) {
      console.error("Matchmaking failed:", err);
      matchTriggered.current = false;
    }
  }, [user, profile, elapsed]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleCancel = async () => {
    if (user && inQueue) {
      await supabase.from("queue").delete().eq("user_id", user.id);
    }
    if (lobbyChannelRef.current) {
      supabase.removeChannel(lobbyChannelRef.current);
      lobbyChannelRef.current = null;
    }
    navigate("/dashboard");
  };

  const handleAccept = () => {
    if (isX1 && matchId) {
      navigate(`/match/${matchId}/ban`);
    } else if (matchData && serverInfo && matchId) {
      navigate("/lobby", {
        state: { matchId, team1: matchData.team1, team2: matchData.team2, diff: matchData.diff, serverInfo },
      });
    }
  };

  const handleDecline = async () => {
    if (user) {
      await supabase.rpc("apply_decline_penalty");
      if (inQueue) {
        await supabase.from("queue").delete().eq("user_id", user.id);
      }
    }
    navigate("/dashboard");
  };

  if (!profile) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </Layout>
    );
  }

  // Validation error screen
  if (validationError) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <AlertTriangle size={48} className="text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-display font-bold text-foreground mb-2">Não é possível entrar na fila</h2>
            <p className="text-muted-foreground mb-6">{validationError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate("/profile")}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-display font-bold hover:bg-primary/90 transition-colors"
              >
                Ir para o Perfil
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-display font-bold hover:bg-secondary/80 transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          {/* Queue Animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
            <div className="relative mx-auto w-32 h-32 mb-6">
              {/* Outer ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
              {/* Middle ring */}
              <motion.div
                className="absolute inset-2 rounded-full border-2 border-primary/50"
                animate={{ rotate: -360 }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              />
              {/* Center icon */}
              <div className="absolute inset-4 rounded-full bg-primary/10 flex items-center justify-center">
                {isX1 ? (
                  <Crosshair size={40} className="text-primary animate-pulse" />
                ) : (
                  <Users size={40} className="text-primary animate-pulse" />
                )}
              </div>
            </div>

            <h2 className="text-2xl font-display font-bold text-foreground mb-2">
              {isX1 && inviteId
                ? `Aguardando ${friendName ?? "amigo"}...`
                : isX1
                ? "Buscando Oponente X1..."
                : "Buscando Partida..."}
            </h2>
            <p className="text-muted-foreground">
              {isX1 && inviteId
                ? "O convite foi enviado, aguardando aceitação"
                : isX1
                ? "Procurando um adversário do seu nível"
                : "Procurando jogadores do seu nível"}
            </p>
          </motion.div>

          {/* Timer */}
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Clock size={20} className="text-primary" />
              <span className="text-3xl font-display font-bold text-foreground">
                {formatTime(elapsed)}
              </span>
            </div>

            {/* Player Info */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <RankBadge rank={profile.rank as any ?? "Silver"} division={1} size="sm" />
              <span className="text-foreground font-display">{profile.nickname}</span>
              <span className="text-muted-foreground text-sm">({playerElo} ELO)</span>
            </div>

            {/* Queue Quality */}
            <div className="flex items-center justify-center gap-2 text-sm">
              <Shield size={14} className="text-primary" />
              <span className="text-muted-foreground">{queueInfo.label}</span>
              <span className="text-muted-foreground">• ±{queueInfo.range} ELO</span>
            </div>

            {/* Mode indicator */}
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full">
              {isX1 ? <Crosshair size={12} className="text-primary" /> : <Users size={12} className="text-primary" />}
              <span className="text-primary text-xs font-display font-bold">{isX1 ? "MODO X1" : "MODO 5v5"}</span>
            </div>

            {!isX1 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Jogadores encontrados</span>
                  <span>{simulatedPlayers}/10</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="bg-primary h-full rounded-full"
                    animate={{ width: `${(simulatedPlayers / 10) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cancel Button */}
          <button
            onClick={handleCancel}
            className="px-8 py-3 bg-destructive text-destructive-foreground rounded-lg font-display font-bold hover:bg-destructive/90 transition-colors flex items-center gap-2 mx-auto"
          >
            <X size={18} />
            Cancelar Fila
          </button>
        </div>
      </div>

      {/* Match Found Modal (5v5 only) */}
      <AnimatePresence>
        {matchFound && !isX1 && matchData && (
          <MatchFoundModal
            open={true}
            matchData={matchData}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
