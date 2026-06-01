import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { X1_MAP_POOL, TOTAL_BANS, type MapInfo } from "@/lib/maps";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Loader2, Swords, Crown } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { RankBadge } from "@/components/RankBadge";
import { getRankFromElo } from "@/lib/mockData";

interface BanEntry {
  map_name: string;
  player_id: string;
  ban_order: number;
}

interface PlayerInfo {
  id: string;
  nickname: string;
  avatar_url: string;
  elo: number;
  rank: string;
  division: number;
}

export default function MapBan() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const [bans, setBans] = useState<BanEntry[]>([]);
  const [timer, setTimer] = useState(20);
  const [player1, setPlayer1] = useState<PlayerInfo | null>(null);
  const [player2, setPlayer2] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalMap, setFinalMap] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoBanRef = useRef(false);
  const channelRef = useRef<any>(null);

  // Determine current turn
  const currentBanOrder = bans.length;
  const isPlayer1Turn = currentBanOrder % 2 === 0;
  const currentTurnPlayerId = isPlayer1Turn ? player1?.id : player2?.id;
  const isMyTurn = currentTurnPlayerId === user?.id;

  const remainingMaps = X1_MAP_POOL.filter(
    (m) => !bans.some((b) => b.map_name === m.name)
  );

  // Load match players
  useEffect(() => {
    if (!matchId) return;

    const loadPlayers = async () => {
      const { data: matchPlayers } = await supabase
        .from("match_players")
        .select("user_id, team, elo_before")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (!matchPlayers || matchPlayers.length < 2) {
        toast({ title: "Erro", description: "Partida não encontrada.", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      const p1Data = matchPlayers[0];
      const p2Data = matchPlayers[1];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, avatar_url, elo_x1")
        .in("user_id", [p1Data.user_id, p2Data.user_id]);

      const getProfile = (uid: string) => profiles?.find((p) => p.user_id === uid);

      const makePlayerInfo = (mp: typeof p1Data): PlayerInfo => {
        const prof = getProfile(mp.user_id);
        const { rank, division } = getRankFromElo(mp.elo_before);
        return {
          id: mp.user_id,
          nickname: prof?.nickname ?? "Jogador",
          avatar_url: prof?.avatar_url ?? "",
          elo: mp.elo_before,
          rank,
          division,
        };
      };

      setPlayer1(makePlayerInfo(p1Data));
      setPlayer2(makePlayerInfo(p2Data));

      const { data: existingBans } = await supabase
        .from("map_bans")
        .select("map_name, player_id, ban_order")
        .eq("match_id", matchId)
        .order("ban_order", { ascending: true });

      if (existingBans) {
        setBans(existingBans);
      }

      setLoading(false);
    };

    loadPlayers();
  }, [matchId, navigate, toast]);

  // Subscribe to broadcast channel ONCE for instant ban events
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match-${matchId}`)
      .on("broadcast", { event: "map_banned" }, (payload) => {
        const data = payload.payload as BanEntry;
        setBans((prev) => {
          if (prev.some((b) => b.ban_order === data.ban_order)) return prev;
          return [...prev, { map_name: data.map_name, player_id: data.player_id, ban_order: data.ban_order }];
        });
        setTimer(20);
        autoBanRef.current = false;
      })
      .on("broadcast", { event: "ban_complete" }, (payload) => {
        const data = payload.payload as { match_id: string; final_map: string };
        setFinalMap(data.final_map);
        // Redirect BOTH players immediately on broadcast.
        setTimeout(() => {
          navigate(`/match/${data.match_id}/lobby`, {
            state: {
              matchId: data.match_id,
              serverInfo: { ip: "", password: "", map: data.final_map },
            },
          });
        }, 1500);
      })
      // Fallback garantido: postgres_changes na tabela matches.
      // Se o broadcast falhar, o UPDATE no banco vai disparar isso para AMBOS jogadores.
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const newRow = payload.new as { status?: string; final_map?: string };
          if (newRow?.final_map && newRow.status === "starting") {
            console.log("[MapBan] postgres_changes fallback triggered, navigating to lobby");
            setFinalMap(newRow.final_map);
            setTimeout(() => {
              navigate(`/match/${matchId}/lobby`, {
                state: {
                  matchId,
                  serverInfo: { ip: "", password: "", map: newRow.final_map! },
                },
              });
            }, 800);
          }
        }
      )
      .subscribe((status) => {
        console.log("[MapBan] Channel status:", status);
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [matchId, navigate]);

  // Fallback definitivo: poll DB enquanto estiver na tela de ban.
  useEffect(() => {
    if (!matchId || finalMap) return;

    const interval = setInterval(async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("final_map, status")
        .eq("id", matchId)
        .maybeSingle();

      if (match?.final_map && match.status === "starting") {
        clearInterval(interval);
        console.log("[MapBan] Polling fallback triggered, navigating to lobby");
        setFinalMap(match.final_map);
        navigate(`/match/${matchId}/lobby`, {
          state: {
            matchId,
            serverInfo: { ip: "", password: "", map: match.final_map },
          },
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [matchId, finalMap, navigate]);

  // Timer countdown
  useEffect(() => {
    if (loading || finalMap) return;

    setTimer(20);
    autoBanRef.current = false;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          if (isMyTurn && !autoBanRef.current) {
            autoBanRef.current = true;
            autoRandomBan();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [bans.length, loading, finalMap, isMyTurn]);

  const autoRandomBan = useCallback(() => {
    const remaining = X1_MAP_POOL.filter(
      (m) => !bans.some((b) => b.map_name === m.name)
    );
    if (remaining.length <= 1) return;
    const randomMap = remaining[Math.floor(Math.random() * remaining.length)];
    handleBanMap(randomMap.name, true);
  }, [bans]);

  const handleBanMap = useCallback(
    async (mapName: string, isAuto = false) => {
      if (!matchId || !user || submitting) return;
      if (!isMyTurn && !isAuto) return;
      if (bans.some((b) => b.map_name === mapName)) return;

      setSubmitting(true);

      const banOrder = bans.length;
      const newBan: BanEntry = { map_name: mapName, player_id: user.id, ban_order: banOrder };

      // Optimistic update FIRST
      const updatedBans = [...bans, newBan];
      setBans(updatedBans);

      const remaining = X1_MAP_POOL.filter(
        (m) => !updatedBans.some((b) => b.map_name === m.name)
      );

      // Broadcast map_banned IMMEDIATELY
      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "map_banned",
          payload: newBan,
        });
      }

      // Save ban to DB in parallel
      supabase.from("map_bans").insert({
        match_id: matchId,
        player_id: user.id,
        map_name: mapName,
        ban_order: banOrder,
      }).then(({ error }) => {
        if (error) console.error("[MapBan] Failed to save ban:", error.message);
      });

      if (remaining.length === 1) {
        const finalMapName = remaining[0].name;
        setFinalMap(finalMapName);

        // CRITICAL: Save final_map to DB BEFORE broadcasting ban_complete
        // so that fallback polling works for any player who misses the broadcast
        await supabase
          .from("matches")
          .update({
            banned_maps: updatedBans.map((b) => b.map_name),
            final_map: finalMapName,
            status: "starting",
          })
          .eq("id", matchId);

        // NOW broadcast ban_complete
        if (channelRef.current) {
          await channelRef.current.send({
            type: "broadcast",
            event: "ban_complete",
            payload: { match_id: matchId, final_map: finalMapName },
          });
        }

        navigate(`/match/${matchId}/lobby`, {
          state: {
            matchId,
            serverInfo: { ip: "", password: "", map: finalMapName },
          },
        });
      } else {
        // Just update banned_maps array
        supabase
          .from("matches")
          .update({ banned_maps: updatedBans.map((b) => b.map_name) })
          .eq("id", matchId)
          .then(({ error }) => {
            if (error) console.error("[MapBan] Failed to update banned_maps:", error.message);
          });
      }

      setSubmitting(false);
    },
    [matchId, user, bans, isMyTurn, isPlayer1Turn, player1, player2, submitting, navigate]
  );

  if (loading || !player1 || !player2) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </Layout>
    );
  }

  const turnPlayer = isPlayer1Turn ? player1 : player2;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* VS Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-6 mb-6"
        >
          {/* Player 1 */}
          <div className={`flex items-center gap-3 ${isPlayer1Turn && !finalMap ? "ring-2 ring-primary rounded-lg p-2" : "p-2"}`}>
            <img src={player1.avatar_url} alt={player1.nickname} className="w-12 h-12 rounded-full bg-secondary" />
            <div>
              <div className="font-display font-bold text-foreground text-sm flex items-center gap-1">
                {player1.nickname}
                {player1.id === user?.id && <span className="text-primary text-xs">(Você)</span>}
                <Crown size={12} className="text-rank-gold" />
              </div>
              <div className="flex items-center gap-2">
                <RankBadge rank={player1.rank as any} division={player1.division as any} size="sm" />
                <span className="text-muted-foreground text-xs">{player1.elo}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <Swords size={28} className="text-primary" />
            <span className="text-muted-foreground text-xs font-display">X1</span>
          </div>

          {/* Player 2 */}
          <div className={`flex items-center gap-3 ${!isPlayer1Turn && !finalMap ? "ring-2 ring-primary rounded-lg p-2" : "p-2"}`}>
            <div className="text-right">
              <div className="font-display font-bold text-foreground text-sm flex items-center gap-1 justify-end">
                {player2.id === user?.id && <span className="text-primary text-xs">(Você)</span>}
                {player2.nickname}
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-muted-foreground text-xs">{player2.elo}</span>
                <RankBadge rank={player2.rank as any} division={player2.division as any} size="sm" />
              </div>
            </div>
            <img src={player2.avatar_url} alt={player2.nickname} className="w-12 h-12 rounded-full bg-secondary" />
          </div>
        </motion.div>

        {/* Turn indicator + Timer */}
        {!finalMap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mb-6"
          >
            <div className="text-muted-foreground text-sm mb-1">
              {isMyTurn ? "SUA VEZ de banir" : `Vez de ${turnPlayer.nickname}`}
            </div>
            <div className="flex items-center justify-center gap-2">
              <Clock size={18} className={timer <= 5 ? "text-destructive animate-pulse" : "text-primary"} />
              <span className={`font-display font-bold text-3xl ${timer <= 5 ? "text-destructive" : "text-foreground"}`}>
                {timer}s
              </span>
            </div>
            <div className="w-48 mx-auto mt-2 bg-secondary rounded-full h-1.5 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${timer <= 5 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${(timer / 20) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="text-muted-foreground text-xs mt-1">
              Ban {currentBanOrder + 1} de {TOTAL_BANS}
            </div>
          </motion.div>
        )}

        {/* Final map announcement */}
        {finalMap && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center mb-6"
          >
            <div className="text-2xl font-display font-bold text-foreground mb-1">
              MAPA SELECIONADO
            </div>
            <div className="text-3xl font-display font-bold text-primary animate-pulse">
              {finalMap}
            </div>
            <div className="text-muted-foreground text-sm mt-2">Redirecionando para o lobby...</div>
          </motion.div>
        )}

        {/* Map Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {X1_MAP_POOL.map((map) => {
            const isBanned = bans.some((b) => b.map_name === map.name);
            const isFinal = finalMap === map.name;
            const banEntry = bans.find((b) => b.map_name === map.name);
            const bannedByPlayer1 = banEntry?.player_id === player1.id;

            return (
              <motion.button
                key={map.name}
                layout
                onClick={() => !isBanned && !finalMap && isMyTurn && handleBanMap(map.name)}
                disabled={isBanned || !!finalMap || !isMyTurn || submitting}
                className={`relative rounded-lg overflow-hidden aspect-[16/10] border-2 transition-all group ${
                  isFinal
                    ? "border-rank-gold ring-2 ring-rank-gold/50 animate-pulse"
                    : isBanned
                    ? "border-destructive/40 opacity-60 cursor-not-allowed"
                    : isMyTurn && !finalMap
                    ? "border-border hover:border-primary hover:glow-primary cursor-pointer"
                    : "border-border cursor-not-allowed"
                }`}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${map.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />

                <AnimatePresence>
                  {isBanned && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-destructive/30 flex items-center justify-center"
                    >
                      <X size={40} className="text-destructive" strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {isFinal && (
                  <div className="absolute inset-0 border-2 border-rank-gold rounded-lg shadow-[0_0_20px_hsl(45_90%_55%/0.5)]" />
                )}

                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <div className="font-display font-bold text-foreground text-sm drop-shadow-lg">
                    {map.name}
                  </div>
                  {isBanned && banEntry && (
                    <div className="text-[10px] text-muted-foreground">
                      Banido por {bannedByPlayer1 ? player1.nickname : player2.nickname}
                    </div>
                  )}
                </div>

                {!isBanned && !finalMap && isMyTurn && (
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <X size={32} className="text-primary" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Ban history */}
        {bans.length > 0 && (
          <div className="mt-6">
            <h3 className="font-display font-bold text-sm text-muted-foreground mb-2">Histórico de Bans</h3>
            <div className="flex flex-wrap gap-2">
              {bans.map((ban) => (
                <div
                  key={ban.ban_order}
                  className="bg-card border border-border rounded-md px-3 py-1.5 flex items-center gap-2 text-xs"
                >
                  <span className="text-muted-foreground">#{ban.ban_order + 1}</span>
                  <X size={10} className="text-destructive" />
                  <span className="font-display font-bold text-foreground">{ban.map_name}</span>
                  <span className="text-muted-foreground">
                    por {ban.player_id === player1.id ? player1.nickname : player2.nickname}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
