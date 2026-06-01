import { Layout } from "@/components/Layout";
import { RankBadge } from "@/components/RankBadge";
import { Player } from "@/lib/mockData";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import {
  getTeamAvgElo,
  getBalanceLabel,
  filterMessage,
  generateServerInfo,
  balanceTeams,
  getCompatiblePlayers,
  calculateEloChange,
} from "@/lib/matchmaking";
import { motion } from "framer-motion";
import {
  Send, Crown, Clock, Map,
  Server, MessageSquare, Scale, Flag, Loader2,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { PostMatchModal } from "@/components/PostMatchModal";
import { ReportPlayerModal } from "@/components/ReportPlayerModal";

interface ChatMessage {
  id: string;
  nickname: string;
  avatar_url: string;
  message: string;
  timestamp: Date;
}

export default function Lobby() {
  const location = useLocation();
  const { matchId: routeMatchId } = useParams<{ matchId: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const state = location.state as {
    matchId: string;
    team1?: Player[];
    team2?: Player[];
    diff?: number;
    serverInfo: { ip: string; password: string; map: string };
  } | null;

  const [lobbyData, setLobbyData] = useState(() => {
    if (state && state.team1 && state.team1.length > 0) {
      return {
        matchId: state.matchId,
        team1: state.team1,
        team2: state.team2 ?? [],
        diff: state.diff ?? 0,
        serverInfo: state.serverInfo,
      };
    }
    return {
      matchId: state?.matchId ?? routeMatchId ?? "",
      team1: [] as Player[],
      team2: [] as Player[],
      diff: 0,
      serverInfo: state?.serverInfo ?? generateServerInfo(),
    };
  });

  const [hydrating, setHydrating] = useState(
    !!(state?.matchId ?? routeMatchId) && (!state?.team1 || state.team1.length === 0)
  );

  // Hydrate lobby data from DB when navigated without team info (e.g. from X1 MapBan)
  useEffect(() => {
    if (!hydrating || !lobbyData.matchId) return;

    let cancelled = false;
    (async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("id, mode, server_ip, server_password, final_map, map_name, team1_avg_elo, team2_avg_elo")
        .eq("id", lobbyData.matchId)
        .maybeSingle();

      const { data: mps } = await supabase
        .from("match_players")
        .select("user_id, team, elo_before")
        .eq("match_id", lobbyData.matchId)
        .order("created_at", { ascending: true });

      if (!match || !mps || cancelled) {
        setHydrating(false);
        return;
      }

      const userIds = mps.map((m) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nickname, avatar_url, elo_points, elo_x1, wins, losses, kills, deaths, region")
        .in("user_id", userIds);

      const { getRankFromElo } = await import("@/lib/mockData");

      const buildPlayer = (mp: typeof mps[number]): Player => {
        const p = profs?.find((x) => x.user_id === mp.user_id);
        const eloForRank = match.mode === "x1" ? mp.elo_before : (p?.elo_points ?? mp.elo_before);
        const { rank, division } = getRankFromElo(eloForRank);
        return {
          id: mp.user_id,
          nickname: p?.nickname ?? "Jogador",
          avatar_url: p?.avatar_url ?? "",
          elo_points: eloForRank,
          wins: p?.wins ?? 0,
          losses: p?.losses ?? 0,
          kills: p?.kills ?? 0,
          deaths: p?.deaths ?? 0,
          region: p?.region ?? "BR",
          rank,
          division,
        };
      };

      const team1Players = mps.filter((m) => m.team === 1).map(buildPlayer);
      const team2Players = mps.filter((m) => m.team === 2).map(buildPlayer);

      if (cancelled) return;

      setLobbyData((prev) => ({
        matchId: match.id,
        team1: team1Players,
        team2: team2Players,
        diff: Math.abs((match.team1_avg_elo ?? 0) - (match.team2_avg_elo ?? 0)),
        serverInfo: {
          ip: match.server_ip ?? prev.serverInfo.ip,
          password: match.server_password ?? prev.serverInfo.password,
          map: match.final_map ?? match.map_name ?? prev.serverInfo.map,
        },
      }));
      setHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrating, lobbyData.matchId]);

  const [lobbyTimer, setLobbyTimer] = useState(300);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [showPostMatch, setShowPostMatch] = useState(false);
  const [reportTarget, setReportTarget] = useState<Player | null>(null);

  const [matchStarted, setMatchStarted] = useState(false);
  const [captainTimeout, setCaptainTimeout] = useState<number | null>(null);
  const [captainConfirmed, setCaptainConfirmed] = useState(false);
  const [lobbyCode, setLobbyCode] = useState<string | null>(null);
  const [opponentJoined, setOpponentJoined] = useState(false);

  const avg1 = getTeamAvgElo(lobbyData.team1);
  const avg2 = getTeamAvgElo(lobbyData.team2);
  const balance = getBalanceLabel(lobbyData.diff);

  // Determine captain (highest ELO on team 1)
  const captain = lobbyData.team1.length > 0
    ? lobbyData.team1.reduce((max, p) => (p.elo_points > max.elo_points ? p : max), lobbyData.team1[0])
    : null;

  const isCaptain = captain?.id === user?.id;

  // Broadcast start_match to captain channel
  const broadcastStartMatch = useCallback(async () => {
    if (!lobbyData.matchId || !captain || matchStarted) return;
    setMatchStarted(true);

    // Fetch captain's riot_puuid
    const { data: captainProfile } = await supabase
      .from("profiles")
      .select("riot_puuid")
      .eq("user_id", captain.id)
      .maybeSingle();

    const captainPuuid = (captainProfile as any)?.riot_puuid ?? null;

    // Fetch authoritative final_map and mode from DB - never trust local state which may be 'TBD'
    const { data: matchRow } = await supabase
      .from("matches")
      .select("final_map, mode")
      .eq("id", lobbyData.matchId)
      .maybeSingle();

    const finalMap = matchRow?.final_map ?? lobbyData.serverInfo.map;
    if (!finalMap || finalMap === "TBD") {
      console.error("[Lobby] Mapa ainda não definido! Abortando start_match.");
      setMatchStarted(false);
      toast({ title: "Erro", description: "Mapa ainda não foi definido.", variant: "destructive" });
      return;
    }

    // Update match status to 'in_progress'
    await supabase.from("matches").update({ status: "in_progress" }).eq("id", lobbyData.matchId);

    // Broadcast to match-specific channel (subscribe first to avoid REST fallback)
    const channel = supabase.channel(`match-${lobbyData.matchId}`);
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "start_match",
            payload: {
              match_id: lobbyData.matchId,
              map: finalMap,
              mode: matchRow?.mode,
              captain_id: captain.id,
              captain_puuid: captainPuuid,
              team1: lobbyData.team1.map(p => ({ id: p.id, nickname: p.nickname, team: 1 })),
              team2: lobbyData.team2.map(p => ({ id: p.id, nickname: p.nickname, team: 2 })),
            },
          }).then(() => {
            supabase.removeChannel(channel);
            resolve();
          });
        }
      });
    });

    // Update status to 'starting'
    await supabase.from("matches").update({ status: "starting" }).eq("id", lobbyData.matchId);

    toast({ title: "⚔️ Partida solicitada!", description: "O Nexus Client iniciará a partida automaticamente." });

    // Start 60s captain confirmation timeout
    setCaptainTimeout(60);
  }, [lobbyData, captain, matchStarted, toast]);

  // Lobby countdown - triggers broadcast at 0
  useEffect(() => {
    const timer = setInterval(() => {
      setLobbyTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          broadcastStartMatch();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [broadcastStartMatch]);

  // Captain confirmation countdown (60s)
  useEffect(() => {
    if (captainTimeout === null || captainConfirmed) return;
    if (captainTimeout <= 0) {
      toast({
        title: "⚠️ Capitão não confirmou!",
        description: "O capitão não iniciou a partida personalizada em 60 segundos.",
        variant: "destructive",
      });
      setCaptainTimeout(null);
      return;
    }
    const timer = setTimeout(() => setCaptainTimeout((p) => (p !== null ? p - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [captainTimeout, captainConfirmed, toast]);

  // Listen for captain confirmation and lobby code on this match channel
  useEffect(() => {
    if (!lobbyData.matchId) return;
    const channel = supabase
      .channel(`match-confirm-${lobbyData.matchId}`)
      .on("broadcast", { event: "captain_confirmed" }, () => {
        setCaptainConfirmed(true);
        setCaptainTimeout(null);
        toast({ title: "✅ Capitão confirmou!", description: "A partida personalizada foi iniciada." });
      })
      .subscribe();

    const handleCode = (code?: string) => {
      if (code && code !== lobbyCode) {
        setLobbyCode(code);
        toast({ title: "🎮 Código do lobby recebido!", description: code });
      }
    };

    const matchChannel = supabase
      .channel(`match-${lobbyData.matchId}`)
      .on("broadcast", { event: "lobby_code" }, ({ payload }) => {
        handleCode((payload as any)?.code);
      })
      .on("broadcast", { event: "match_started" }, ({ payload }) => {
        handleCode((payload as any)?.lobby_code);
      })
      .on("broadcast", { event: "opponent_joined" }, ({ payload }) => {
        setOpponentJoined(true);
        const nick = (payload as any)?.nickname ?? "Oponente";
        toast({ title: "✅ Oponente entrou no lobby!", description: `${nick} entrou na partida personalizada.` });
      })
      .on("broadcast", { event: "match_error" }, ({ payload }) => {
        const errorMsg = (payload as any)?.message ?? "Erro desconhecido no Nexus Client.";
        setMatchStarted(false);
        setCaptainTimeout(null);
        toast({ title: "❌ Erro no Nexus Client", description: errorMsg, variant: "destructive" });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(matchChannel);
    };
  }, [lobbyData.matchId, toast, lobbyCode]);

  // Realtime chat subscription
  useEffect(() => {
    if (!lobbyData.matchId) return;

    // Load existing messages
    const loadMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("match_id", lobbyData.matchId)
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data.map(m => ({
          id: m.id,
          nickname: m.nickname,
          avatar_url: m.avatar_url ?? "",
          message: m.message,
          timestamp: new Date(m.created_at),
        })));
      }
    };
    loadMessages();

    const channel = supabase
      .channel(`lobby-chat-${lobbyData.matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `match_id=eq.${lobbyData.matchId}`,
        },
        (payload) => {
          const m = payload.new as any;
          setMessages((prev) => [
            ...prev,
            {
              id: m.id,
              nickname: m.nickname,
              avatar_url: m.avatar_url ?? "",
              message: m.message,
              timestamp: new Date(m.created_at),
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyData.matchId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const sendMessage = async () => {
    if (!inputMsg.trim() || !user || !profile || !lobbyData.matchId) return;
    if (inputMsg.length > 200) {
      toast({ title: "Mensagem muito longa", description: "Máximo 200 caracteres.", variant: "destructive" });
      return;
    }

    const filtered = filterMessage(inputMsg);
    await supabase.from("chat_messages").insert({
      match_id: lobbyData.matchId,
      user_id: user.id,
      nickname: profile.nickname,
      avatar_url: profile.avatar_url,
      message: filtered,
    });
    setInputMsg("");
  };

  const getHighestElo = (team: Player[]) => {
    return team.reduce((max, p) => (p.elo_points > max.elo_points ? p : max), team[0]);
  };

  const renderTeam = (team: Player[], teamName: string, avgElo: number) => {
    if (!team.length) return null;
    const captain = getHighestElo(team);
    return (
      <div className="space-y-2">
        <div className="text-center font-display font-bold text-lg text-foreground">
          {teamName}
          <span className="text-muted-foreground text-sm font-normal ml-2">ELO Médio: {avgElo}</span>
        </div>
        {team.map((player, i) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, x: teamName === "TIME 1" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-card border rounded-lg p-3 flex items-center gap-3 ${
              player.id === user?.id ? "border-primary/40 glow-primary" : "border-border"
            }`}
          >
            <div className="relative">
              <img src={player.avatar_url} alt={player.nickname} className="w-10 h-10 rounded-full bg-secondary" />
              {captain.id === player.id && (
                <Crown size={14} className="absolute -top-1 -right-1 text-rank-gold" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-sm text-foreground truncate">
                {player.nickname}
                {player.id === user?.id && <span className="text-primary text-xs ml-1">(Você)</span>}
                {captain.id === player.id && <span className="text-rank-gold text-xs ml-1">Capitão</span>}
              </div>
              <div className="flex items-center gap-2">
                <RankBadge rank={player.rank} division={player.division} size="sm" />
                <span className="text-muted-foreground text-xs">
                  WR: {player.wins + player.losses > 0 ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display font-bold text-foreground text-sm">{player.elo_points}</div>
              {player.id !== user?.id && (
                <button
                  onClick={() => setReportTarget(player)}
                  className="text-muted-foreground hover:text-destructive text-xs flex items-center gap-1 mt-1"
                >
                  <Flag size={10} />
                  Report
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  if (hydrating || !lobbyData.team1.length) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="animate-spin text-primary" size={32} />
          <span className="text-muted-foreground text-sm">Carregando lobby da partida...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground">LOBBY DA PARTIDA</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Scale size={16} className={balance.color} />
              <span className={`font-display font-bold text-sm ${balance.color}`}>
                {balance.label} (±{lobbyData.diff})
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock size={16} />
              <span className="font-display font-bold text-foreground">{formatTime(lobbyTimer)}</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Teams */}
          <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
            {renderTeam(lobbyData.team1, "TIME 1", avg1)}
            {renderTeam(lobbyData.team2, "TIME 2", avg2)}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Server Info */}
            <div className="bg-card border border-primary/30 rounded-lg p-4 glow-primary space-y-3">
              <h3 className="font-display font-bold text-foreground flex items-center gap-2">
                <Server size={18} className="text-primary" />
                Servidor
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm flex items-center gap-1"><Map size={14} /> Mapa</span>
                  <span className="font-display font-bold text-foreground">{lobbyData.serverInfo.map}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm flex items-center gap-1"><Server size={14} /> Modo</span>
                  <span className="font-display font-bold text-foreground">Jogo Personalizado</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm flex items-center gap-1"><Server size={14} /> Servidor</span>
                  <span className="font-display font-bold text-foreground">São Paulo</span>
                </div>
              </div>
              <div className="pt-3 border-t border-border">
                <p className="text-muted-foreground text-xs leading-relaxed text-center">
                  O Nexus Client iniciará a partida automaticamente no Valorant do capitão. Aguarde a notificação.
                </p>
              </div>
            </div>

            {/* Start match button (manual trigger) */}
            {!matchStarted && (
              <div className="space-y-2">
                <button
                  onClick={broadcastStartMatch}
                  className="w-full px-4 py-3 bg-win/20 border-2 border-win text-win rounded-lg font-display font-bold hover:bg-win/30 transition-colors"
                >
                  ⚔️ INICIAR PARTIDA
                </button>
                <p className="text-muted-foreground text-xs text-center">
                  O Nexus Client iniciará a partida automaticamente no Valorant
                </p>
              </div>
            )}

            {/* Captain confirmation status */}
            {matchStarted && captainTimeout !== null && !captainConfirmed && (
              <div className="bg-card border border-primary/30 rounded-lg p-4 text-center space-y-2">
                <div className="text-muted-foreground text-sm">Aguardando capitão iniciar...</div>
                <div className="font-display font-bold text-2xl text-foreground">{captainTimeout}s</div>
                {isCaptain && (
                  <button
                    onClick={async () => {
                      const ch = supabase.channel(`match-confirm-${lobbyData.matchId}`);
                      await new Promise<void>((resolve) => {
                        ch.subscribe((status) => {
                          if (status === "SUBSCRIBED") {
                            ch.send({ type: "broadcast", event: "captain_confirmed", payload: {} })
                              .then(() => { supabase.removeChannel(ch); resolve(); });
                          }
                        });
                      });
                      setCaptainConfirmed(true);
                      setCaptainTimeout(null);
                    }}
                    className="w-full px-4 py-3 bg-gradient-primary text-primary-foreground rounded-lg font-display font-bold hover:opacity-90"
                  >
                    ✅ CONFIRMAR INÍCIO
                  </button>
                )}
              </div>
            )}

            {captainConfirmed && (
              <div className="bg-win/10 border border-win/30 rounded-lg p-4 text-center">
                <span className="text-win font-display font-bold">✅ Partida em andamento!</span>
              </div>
            )}

            {/* Lobby Code (sent by Nexus Client after captain creates the custom game) */}
            {lobbyCode && !isCaptain && (
              <div className="bg-card border-2 border-win rounded-lg p-4 space-y-3 glow-primary">
                <h3 className="font-display font-bold text-foreground text-center">
                  🎮 Entre no lobby do Valorant
                </h3>
                <p className="text-muted-foreground text-xs text-center">Use o código abaixo:</p>
                <div className="bg-secondary rounded-md py-3 text-center font-display font-bold text-2xl text-win tracking-widest select-all">
                  {lobbyCode}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(lobbyCode);
                    toast({ title: "Código copiado!" });
                  }}
                  className="w-full px-4 py-2 bg-gradient-primary text-primary-foreground rounded-md font-display font-bold hover:opacity-90"
                >
                  COPIAR CÓDIGO
                </button>
                <p className="text-muted-foreground text-[11px] text-center leading-relaxed">
                  Valorant → Jogar → Jogo Personalizado → Entrar com código
                </p>
              </div>
            )}

            {lobbyCode && isCaptain && (
              <div className={`border rounded-lg p-4 text-center space-y-1 transition-colors ${
                opponentJoined
                  ? "bg-win/10 border-win/30"
                  : "bg-card border-primary/30"
              }`}>
                <p className={`text-sm font-display font-bold ${opponentJoined ? "text-win" : "text-foreground"}`}>
                  {opponentJoined ? "✅ Oponente entrou no lobby!" : "Aguardando o oponente entrar no lobby..."}
                </p>
                <p className="text-muted-foreground text-xs">
                  Código enviado: <span className="text-win font-bold">{lobbyCode}</span>
                </p>
              </div>
            )}

            <button
              onClick={() => setShowPostMatch(true)}
              className="w-full px-4 py-3 bg-gradient-primary text-primary-foreground rounded-lg font-display font-bold hover:opacity-90 transition-opacity"
            >
              REGISTRAR RESULTADO
            </button>

            {/* Chat */}
            <div className="bg-card border border-border rounded-lg flex flex-col h-[360px]">
              <div className="p-3 border-b border-border flex items-center gap-2">
                <MessageSquare size={16} className="text-primary" />
                <span className="font-display font-bold text-sm text-foreground">Chat do Lobby</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && (
                  <div className="text-muted-foreground text-xs text-center py-8">Nenhuma mensagem ainda...</div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-2">
                    <img src={msg.avatar_url} alt={msg.nickname} className="w-6 h-6 rounded-full bg-secondary mt-0.5" />
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className={`font-display font-bold text-xs ${msg.nickname === profile?.nickname ? "text-primary" : "text-foreground"}`}>
                          {msg.nickname}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-foreground text-xs">{msg.message}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-2 border-t border-border flex gap-2">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Digite sua mensagem..."
                  maxLength={200}
                  className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button onClick={sendMessage} className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PostMatchModal
        open={showPostMatch}
        onClose={() => setShowPostMatch(false)}
        team1={lobbyData.team1}
        team2={lobbyData.team2}
        matchId={lobbyData.matchId}
      />

      <ReportPlayerModal
        open={!!reportTarget}
        player={reportTarget}
        onClose={() => setReportTarget(null)}
        matchId={lobbyData.matchId}
      />
    </Layout>
  );
}
