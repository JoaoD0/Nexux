import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import { RankBadge } from "@/components/RankBadge";
import { MatchCard } from "@/components/MatchCard";
import { PlayerRow } from "@/components/PlayerRow";
import { useProfile, useLeaderboard, useMatchHistory } from "@/hooks/useProfile";
import { getRankFromElo } from "@/lib/mockData";
import { motion } from "framer-motion";
import { Trophy, Target, Percent, TrendingUp, Crosshair, Swords, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { X1InviteModal } from "@/components/X1InviteModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const [showX1Modal, setShowX1Modal] = useState(false);
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: leaderboard } = useLeaderboard();
  const { data: matchHistory } = useMatchHistory();

  if (profileLoading || !profile) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </Layout>
    );
  }

  const winrate = profile.wins + profile.losses > 0
    ? ((profile.wins / (profile.wins + profile.losses)) * 100).toFixed(1)
    : "0.0";
  const kd = (profile.kills / Math.max(profile.deaths, 1)).toFixed(2);

  // Convert match history to MatchCard format
  const recentMatches = (matchHistory ?? []).slice(0, 5).map((mp: any) => ({
    id: mp.id,
    map_name: mp.matches?.map_name ?? "Unknown",
    date: mp.created_at,
    result: (mp.result ?? "loss") as "win" | "loss",
    kills: mp.kills ?? 0,
    deaths: mp.deaths ?? 0,
    assists: mp.assists ?? 0,
    elo_change: (mp.elo_after ?? mp.elo_before) - mp.elo_before,
    score: "",
  }));

  // Convert leaderboard to PlayerRow format
  const topPlayers = (leaderboard ?? []).slice(0, 5).map((p) => ({
    id: p.user_id,
    nickname: p.nickname,
    avatar_url: p.avatar_url ?? "",
    elo_points: p.elo_points,
    wins: p.wins,
    losses: p.losses,
    kills: p.kills,
    deaths: p.deaths,
    region: p.region ?? "BR",
    rank: p.rank,
    division: p.division,
  }));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={profile.avatar_url ?? ""}
              alt={profile.nickname}
              className="w-16 h-16 rounded-full bg-secondary border-2 border-primary/30"
            />
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                {profile.nickname}
              </h1>
              <RankBadge rank={profile.rank} division={profile.division} size="lg" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate("/queue")}
              className="px-8 py-4 rounded-lg font-display font-bold text-lg transition-all bg-gradient-primary text-primary-foreground glow-primary hover:glow-primary-strong animate-pulse-glow"
            >
              <span className="flex items-center gap-2">
                <Crosshair size={20} />
                ENCONTRAR PARTIDA
              </span>
            </button>
            <button
              onClick={() => setShowX1Modal(true)}
              className="px-8 py-4 rounded-lg font-display font-bold text-lg transition-all border-2 border-primary text-primary hover:bg-primary/10"
            >
              <span className="flex items-center gap-2">
                <Swords size={20} />
                JOGAR X1
              </span>
            </button>

          </div>
        </div>

        <X1InviteModal open={showX1Modal} onClose={() => setShowX1Modal(false)} />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard label="ELO" value={profile.elo_points} icon={TrendingUp} trend="up" delay={0} />
          <StatsCard label="Vitórias" value={profile.wins} icon={Trophy} delay={0.1} />
          <StatsCard label="K/D" value={kd} icon={Target} delay={0.2} />
          <StatsCard label="Winrate" value={`${winrate}%`} icon={Percent} delay={0.3} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent matches */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl text-foreground flex items-center gap-2">
                <Swords size={20} className="text-primary" />
                Partidas Recentes
              </h2>
              <Link to="/history" className="text-primary text-sm hover:underline">
                Ver todas
              </Link>
            </div>
            {recentMatches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-card border border-border rounded-lg">
                Nenhuma partida jogada ainda. Clique em ENCONTRAR PARTIDA!
              </div>
            ) : (
              recentMatches.map((match, i) => (
                <MatchCard key={match.id} match={match} index={i} />
              ))
            )}
          </div>

          {/* Mini leaderboard */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl text-foreground flex items-center gap-2">
                <Trophy size={20} className="text-primary" />
                Top Jogadores
              </h2>
              <Link to="/leaderboard" className="text-primary text-sm hover:underline">
                Ver todos
              </Link>
            </div>
            {topPlayers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-card border border-border rounded-lg">
                Nenhum jogador registrado ainda.
              </div>
            ) : (
              topPlayers.map((player, i) => (
                <PlayerRow key={player.id} player={player} position={i + 1} index={i} />
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
